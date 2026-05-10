import { Router } from 'express';
import { dbAll, dbGet, SQL } from '../lib/db.js';
import { handleRouteError } from '../lib/http.js';
import { getOrderScopeConstraint, type AuthedRequest } from '../lib/auth.js';

export function createDashboardRouter() {
  const router = Router();

  router.get('/', async (req: AuthedRequest, res) => {
    try {
      const [orderScopeSql, orderScopeParams] = getOrderScopeConstraint(req.user, 'o', 'c');
      const overview = await dbGet<{
        totalOrders: number;
        activeOrders: number;
      }>(`
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN o.status != 'completed' THEN 1 ELSE 0 END) AS activeOrders
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.deleted_at IS NULL ${orderScopeSql}
      `, orderScopeParams);

      const financeStats = await dbGet<{
        receiptUsd: number;
        pendingReceiptUsd: number;
        pendingCount: number;
      }>(`
        SELECT
          SUM(CASE WHEN f.status = 'completed' AND f.type = 'receipt' THEN
            CASE
              WHEN f.currency = 'CNY' THEN f.amount / 7.2
              WHEN f.currency = 'EUR' THEN f.amount / 0.92
              WHEN f.currency = 'GBP' THEN f.amount / 0.78
              WHEN f.currency = 'HKD' THEN f.amount / 7.8
              WHEN f.currency = 'JPY' THEN f.amount / 155
              ELSE f.amount
            END
          ELSE 0 END) as receiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' THEN
            CASE
              WHEN f.currency = 'CNY' THEN f.amount / 7.2
              WHEN f.currency = 'EUR' THEN f.amount / 0.92
              WHEN f.currency = 'GBP' THEN f.amount / 0.78
              WHEN f.currency = 'HKD' THEN f.amount / 7.8
              WHEN f.currency = 'JPY' THEN f.amount / 155
              ELSE f.amount
            END
          ELSE 0 END) as pendingReceiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' THEN 1 ELSE 0 END) as pendingCount
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id] : []);

      const activeLogistics = await dbGet<{ count: number }>(
        `
          SELECT COUNT(*) AS count
          FROM logistics_records l
          JOIN orders o ON o.id = l.order_id
          LEFT JOIN customers c ON c.id = o.customer_id
          WHERE l.status != 'arrived' AND l.deleted_at IS NULL AND o.deleted_at IS NULL
          ${req.user?.role !== 'admin' ? ' AND (l.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        `,
        req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id] : []
      );

      const overduePayments = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
        amount: number;
        currency: string;
        created_at: string;
        days_pending: number;
      }[]>(`
        SELECT
          f.id, o.display_id as order_display_id, c.name as customer_name, f.amount, f.currency, f.created_at,
          ${SQL.daysBetween('f.created_at')} as days_pending
        FROM finance_records f
        JOIN orders o ON f.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE f.type = 'receipt' AND f.status = 'pending' AND f.deleted_at IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        ORDER BY f.created_at ASC
        LIMIT 3
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id] : []);

      const missingCustoms = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
      }[]>(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN customs_records cr ON cr.order_id = o.id AND cr.deleted_at IS NULL
        WHERE o.status IN ('customs', 'shipping') AND cr.id IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        LIMIT 2
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const missingLogistics = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
      }[]>(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN logistics_records lr ON lr.order_id = o.id
        WHERE o.status IN ('shipping') AND lr.id IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        LIMIT 2
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const staleLogistics = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
        carrier: string;
        tracking_no: string;
        days_pending: number;
      }[]>(`
        SELECT
          l.id, o.display_id as order_display_id, c.name as customer_name, l.carrier, l.tracking_no,
          ${SQL.daysBetween('l.created_at')} as days_pending
        FROM logistics_records l
        JOIN orders o ON l.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE l.status != 'arrived' AND l.deleted_at IS NULL AND o.deleted_at IS NULL
          AND l.created_at < NOW() - INTERVAL '7 days'
        ${req.user?.role !== 'admin' ? ' AND (l.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        ORDER BY l.created_at ASC
        LIMIT 3
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id] : []);

      const invoiceCandidates = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
        tax_mode: 'A' | 'C';
        etd: string | null;
        shipping_date: string | null;
      }[]>(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name,
          COALESCE(NULLIF(o.tax_mode, ''), 'A') AS tax_mode,
          (
            SELECT NULLIF(l.etd, '')
            FROM logistics_records l
            WHERE l.order_id = o.id AND l.deleted_at IS NULL AND NULLIF(l.etd, '') IS NOT NULL
            ORDER BY l.etd DESC, l.id DESC
            LIMIT 1
          ) AS etd,
          (
            SELECT NULLIF(l.shipping_date, '')
            FROM logistics_records l
            WHERE l.order_id = o.id AND l.deleted_at IS NULL AND NULLIF(l.shipping_date, '') IS NOT NULL
            ORDER BY l.shipping_date DESC, l.id DESC
            LIMIT 1
          ) AS shipping_date
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.status IN ('customs', 'shipping', 'completed')
          AND COALESCE(NULLIF(o.tax_mode, ''), 'A') IN ('A', 'C')
          AND o.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM input_invoices ii
            WHERE ii.order_id = o.id
              AND ii.deleted_at IS NULL
              AND ii.invoice_type = 'vat_special'
              AND ii.invoice_status IN ('received', 'verified')
          )
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
        LIMIT 20
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const documentCandidates = await dbAll<{
        id: number;
        order_display_id: string;
        customer_name: string;
        tax_mode: 'A' | 'B' | 'C';
        doc_types: string | null;
      }[]>(`
        SELECT
          o.id,
          o.display_id AS order_display_id,
          c.name AS customer_name,
          COALESCE(NULLIF(o.tax_mode, ''), 'A') AS tax_mode,
          COALESCE(string_agg(REPLACE(a.remark, 'docType:', ''), ','), '') AS doc_types
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN attachments a ON a.entity_type = 'order_document'
          AND CAST(a.entity_id AS INTEGER) = o.id
          AND a.remark LIKE 'docType:%'
        WHERE o.status IN ('customs', 'shipping', 'completed')
          AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        GROUP BY o.id, o.display_id, c.name, o.tax_mode, o.updated_at, o.created_at
        ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
        LIMIT 20
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const requiredDocumentsByMode: Record<string, string[]> = {
        A: ['CI', 'PL', 'BL', 'CUSTOMS_DECLARATION', 'TAX_REFUND_COPY'],
        B: ['LOGISTICS_VOUCHER'],
        C: ['CI', 'PL', 'CUSTOMS_DECLARATION'],
      };
      const documentLabels: Record<string, string> = {
        CI: '商业发票',
        PL: '装箱单',
        BL: '提单',
        CUSTOMS_DECLARATION: '报关单',
        TAX_REFUND_COPY: '退税联',
        LOGISTICS_VOUCHER: '物流凭证',
      };
      const documentAlerts = documentCandidates
        .map(row => {
          const present = new Set(String(row.doc_types || '').split(',').map(item => item.trim()).filter(Boolean));
          const required = requiredDocumentsByMode[row.tax_mode] || requiredDocumentsByMode.A;
          const missing = required.filter(docType => !present.has(docType));
          if (!missing.length) return null;
          return {
            id: row.id,
            order_display_id: row.order_display_id,
            customer_name: row.customer_name,
            desc: `缺少 ${missing.slice(0, 3).map(docType => documentLabels[docType] || docType).join('、')}`,
            days: 0,
            actionLabel: '补单据',
            urgency: missing.includes('BL') || missing.includes('CUSTOMS_DECLARATION') ? 'high' : 'medium',
          };
        })
        .filter(Boolean)
        .slice(0, 4);

      const toDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };
      const today = new Date();
      const inputInvoiceAlerts = invoiceCandidates
        .map(row => {
          const anchor = toDate(row.tax_mode === 'A' ? row.etd : (row.shipping_date || row.etd));
          if (!anchor) return null;
          const due = new Date(anchor);
          if (row.tax_mode === 'A') {
            due.setDate(due.getDate() + 30);
          } else {
            due.setDate(25);
          }
          const days = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
          if (days < 0) return null;
          return {
            id: row.id,
            order_display_id: row.order_display_id,
            customer_name: row.customer_name,
            desc: row.tax_mode === 'A'
              ? 'ETD 后 30 天仍未收齐可抵扣专票'
              : '本月内销纳税申报前需催收进项专票',
            days,
            actionLabel: '催发票',
            urgency: days > 7 ? 'high' : 'medium'
          };
        })
        .filter(Boolean)
        .slice(0, 3);

      const todos = [
        ...overduePayments.map(p => ({
          id: `payment-${p.id}`,
          type: 'payment_overdue',
          order_display_id: p.order_display_id,
          customer_name: p.customer_name,
          desc: `未收款 ${p.currency} ${p.amount}`,
          days: Math.max(0, p.days_pending),
          actionLabel: '去催款',
          urgency: 'high'
        })),
        ...missingCustoms.map(c => ({
          id: `customs-${c.id}`,
          type: 'customs_missing',
          order_display_id: c.order_display_id,
          customer_name: c.customer_name,
          desc: '缺少商业发票、装箱单',
          days: 0,
          actionLabel: '去上传',
          urgency: 'medium'
        })),
        ...documentAlerts.map((d: any) => ({
          id: `documents-${d.id}`,
          type: 'document_missing',
          order_display_id: d.order_display_id,
          customer_name: d.customer_name,
          desc: d.desc,
          days: d.days,
          actionLabel: d.actionLabel,
          urgency: d.urgency
        })),
        ...missingLogistics.map(l => ({
          id: `logistics-${l.id}`,
          type: 'logistics_pending',
          order_display_id: l.order_display_id,
          customer_name: l.customer_name,
          desc: '已发运，待创建物流单',
          days: 0,
          actionLabel: '创建物流',
          urgency: 'medium'
        })),
        ...staleLogistics.map(l => ({
          id: `logistics-stale-${l.id}`,
          type: 'logistics_stale',
          order_display_id: l.order_display_id,
          customer_name: l.customer_name,
          desc: `${l.carrier || '物流'} ${l.tracking_no || ''} 超 7 天未送达`,
          days: Math.max(0, l.days_pending),
          actionLabel: '查物流',
          urgency: l.days_pending > 14 ? 'high' : 'medium'
        })),
        ...inputInvoiceAlerts.map((i: any) => ({
          id: `input-invoice-${i.id}`,
          type: 'input_invoice_risk',
          order_display_id: i.order_display_id,
          customer_name: i.customer_name,
          desc: i.desc,
          days: Math.max(0, i.days),
          actionLabel: i.actionLabel,
          urgency: i.urgency
        }))
      ].sort((a, b) => {
        const score = (t: any) => (t.urgency === 'high' ? 1000 : t.urgency === 'medium' ? 100 : 10) + Math.max(0, t.days || 0);
        return score(b) - score(a);
      }).slice(0, 6);

      const activitiesRows = await dbAll<{
        type: string;
        id: number;
        display_id: string;
        customer_name: string;
        title: string;
        desc: string;
        created_at: string;
        value: string;
        valueColor: string;
      }[]>(`
        SELECT 'finance' as type, f.id, o.display_id, c.name as customer_name,
          CASE WHEN f.type = 'receipt' THEN '收款完成' ELSE '付款完成' END as title,
          '' as desc, f.created_at as created_at,
          CASE WHEN f.type = 'receipt' THEN '+' ELSE '-' END || f.currency || ' ' || f.amount as value,
          CASE WHEN f.type = 'receipt' THEN 'text-emerald-500' ELSE 'text-red-500' END as valueColor
        FROM finance_records f JOIN orders o ON f.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE f.status = 'completed' AND f.deleted_at IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        UNION ALL
        SELECT 'logistics' as type, l.id, o.display_id, c.name as customer_name,
          '物流更新' as title, '货物已发出 · ' || l.carrier as desc, l.created_at,
          CASE WHEN l.status = 'arrived' THEN '已送达' WHEN l.status = 'shipped' THEN '运输中' ELSE '备货中' END as value,
          'text-slate-500' as valueColor
        FROM logistics_records l JOIN orders o ON l.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE l.deleted_at IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (l.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        UNION ALL
        SELECT 'customs' as type, cr.id, o.display_id, c.name as customer_name,
          '报关完成' as title, '报关单号 ' || cr.declaration_no as desc, cr.created_at,
          '' as value, '' as valueColor
        FROM customs_records cr JOIN orders o ON cr.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        UNION ALL
        SELECT 'order' as type, o.id, o.display_id, c.name as customer_name,
          '新建订单' as title, o.product_summary as desc, o.created_at,
          COALESCE(NULLIF(o.currency, ''), 'USD') || ' ' || o.total_amount as value,
          'text-primary-navy dark:text-white' as valueColor
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        ORDER BY 7 DESC
        LIMIT 8
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id] : []);

      const activities = activitiesRows.map(a => ({
        ...a,
        order_display_id: a.display_id
      }));

      const statusRows = await dbAll<{ status: string, count: number }[]>(`
        SELECT o.status, COUNT(*) as count
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        GROUP BY o.status
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const totalOrders = overview?.totalOrders || 0;
      
      const COLORS: Record<string, string> = {
        'draft': '#94A3B8', // slate-400
        'production': '#0F172A', // primary-navy
        'customs': '#EAB308', // yellow-500
        'shipping': '#3B82F6', // blue-500
        'completed': '#10B981', // emerald-500
      };

      const LABELS: Record<string, string> = {
        'draft': '待确认',
        'production': '生产中',
        'customs': '报关中',
        'shipping': '运输中',
        'completed': '已完成',
      };

      const statusDistribution = statusRows.map(r => ({
        status: r.status,
        label: LABELS[r.status] || r.status,
        count: r.count,
        percentage: totalOrders > 0 ? Math.round((r.count / totalOrders) * 1000) / 10 : 0,
        color: COLORS[r.status] || '#CBD5E1'
      })).sort((a, b) => b.count - a.count);

      // Monthly trends (last 6 months)
      const monthlyTrends = await dbAll<{ month: string; orders: number; revenue: number }[]>(`
        SELECT
          ${SQL.date('o.created_at', '%Y-%m')} AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(CASE
            WHEN COALESCE(NULLIF(o.currency, ''), 'USD') = 'CNY' THEN o.total_amount / 7.2
            WHEN COALESCE(NULLIF(o.currency, ''), 'USD') = 'EUR' THEN o.total_amount / 0.92
            WHEN COALESCE(NULLIF(o.currency, ''), 'USD') = 'GBP' THEN o.total_amount / 0.78
            WHEN COALESCE(NULLIF(o.currency, ''), 'USD') = 'HKD' THEN o.total_amount / 7.8
            WHEN COALESCE(NULLIF(o.currency, ''), 'USD') = 'JPY' THEN o.total_amount / 155
            ELSE o.total_amount
          END), 0) AS revenue
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.created_at >= ${SQL.monthsAgo(6)} AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        GROUP BY month ORDER BY month ASC
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      // Monthly Profit Trends
      const profitTrends = await dbAll<{ month: string; revenue: number; cost: number; profit: number }[]>(`
        SELECT
          ${SQL.date('f.created_at', '%Y-%m')} AS month,
          SUM(CASE WHEN f.type = 'receipt' AND f.status = 'completed' THEN 
            CASE WHEN f.currency = 'CNY' THEN f.amount / 7.2 ELSE f.amount END
          ELSE 0 END) AS revenue,
          SUM(CASE WHEN f.type = 'payment' AND f.status = 'completed' THEN 
            CASE WHEN f.currency = 'CNY' THEN f.amount / 7.2 ELSE f.amount END
          ELSE 0 END) AS cost
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE f.created_at >= ${SQL.monthsAgo(6)} AND f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)' : ''}
        GROUP BY month ORDER BY month ASC
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id] : []);

      // Add profit to profitTrends
      const trendsWithProfit = profitTrends.map(t => ({
        ...t,
        profit: t.revenue - t.cost
      }));

      // Calculate MoM growth
      const currentMonth = new Date().toISOString().slice(0, 7);
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);

      const getMonthStats = (month: string) => trendsWithProfit.find(t => t.month === month) || { revenue: 0, profit: 0 };
      const currStats = getMonthStats(currentMonth);
      const prevStats = getMonthStats(lastMonth);

      const calcGrowth = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10;
      };

      const growth = {
        revenue: calcGrowth(currStats.revenue, prevStats.revenue),
        profit: calcGrowth(currStats.profit, prevStats.profit),
      };

      // Total customer count
      const customerCount = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM customers WHERE deleted_at IS NULL ${req.user?.role !== 'admin' ? ' AND owner_user_id = ?' : ''}`, req.user?.role !== 'admin' ? [req.user?.id] : []);

      // Risk detection: low margin (< 8%) and freight inversion
      const profitRows = await dbAll<{ order_id: number; display_id: string; customer_name: string; data: any }[]>(`
        SELECT o.id as order_id, o.display_id, c.name as customer_name, op.data
        FROM order_profits op
        JOIN orders o ON o.id = op.order_id
        JOIN customers c ON c.id = o.customer_id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (o.created_by = ? OR c.owner_user_id = ?)' : ''}
        ORDER BY op.updated_at DESC
        LIMIT 20
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const risks: { orderId: number; displayId: string; customerName: string; riskType: 'low_margin' | 'freight_inversion'; value: number; threshold: number }[] = [];
      for (const row of profitRows) {
        const d = row.data;
        if (!d || !d.receipts) continue;
        const receiptsTotalCny = (d.receipts || []).reduce((sum: number, r: any) => sum + ((r.net || 0) * (r.exchangeRate || 7.2)), 0);
        const freightCny = d.freightCurrency === 'USD' ? (d.freightValue || 0) * ((d.receipts?.[0]?.exchangeRate) || 7.2) : (d.freightValue || 0);
        const totalCost = (d.factoryCostCny || 0) + (d.domesticFees || 0) + freightCny + (d.customsMisc || 0)
          + (d.miscFees || []).reduce((s: number, f: any) => s + (f.amount || 0), 0);
        const profit = receiptsTotalCny + (d.otherIncomeCny || 0) - totalCost;
        const margin = d.invoiceAmount > 0 ? (profit / d.invoiceAmount) * 100 : 0;

        if (margin < 8 && margin > 0) {
          risks.push({ orderId: row.order_id, displayId: row.display_id, customerName: row.customer_name, riskType: 'low_margin', value: Math.round(margin * 10) / 10, threshold: 8 });
        }
        if (freightCny > (d.factoryCostCny || 0) && (d.factoryCostCny || 0) > 0) {
          risks.push({ orderId: row.order_id, displayId: row.display_id, customerName: row.customer_name, riskType: 'freight_inversion', value: Math.round(freightCny), threshold: Math.round(d.factoryCostCny) });
        }
      }

      res.json({
        overview: {
          totalOrders,
          activeOrders: overview?.activeOrders || 0,
          receiptUsd: financeStats?.receiptUsd || 0,
          pendingReceiptUsd: financeStats?.pendingReceiptUsd || 0,
          pendingFinanceCount: financeStats?.pendingCount || 0,
          activeLogistics: activeLogistics?.count || 0,
          customerCount: customerCount?.count || 0,
          estProfit: currStats.profit,
          growth,
          risks,
        },
        todos,
        activities,
        statusDistribution,
        monthlyTrends,
        profitTrends: trendsWithProfit,
      });
    } catch (error) {
      return handleRouteError(res, error, '读取控制台数据失败');
    }
  });

  return router;
}
