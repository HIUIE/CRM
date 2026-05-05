import { Router } from 'express';
import { dbAll, dbGet, SQL } from '../lib/db.js';
import { handleRouteError } from '../lib/http.js';
import { getDataScopeConstraint, type AuthedRequest } from '../lib/auth.js';

export function createDashboardRouter() {
  const router = Router();

  router.get('/', async (req: AuthedRequest, res) => {
    try {
      const [orderScopeSql, orderScopeParams] = getDataScopeConstraint(req.user, 'orders');
      const overview = await dbGet<{
        totalOrders: number;
        activeOrders: number;
      }>(`
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS activeOrders
        FROM orders
        WHERE deleted_at IS NULL ${orderScopeSql}
      `, orderScopeParams);

      const [financeScopeSql, financeScopeParams] = getDataScopeConstraint(req.user, 'f');
      const financeStats = await dbGet<{
        receiptUsd: number;
        pendingReceiptUsd: number;
        pendingCount: number;
      }>(`
        SELECT
          SUM(CASE WHEN f.status = 'completed' AND f.type = 'receipt' AND f.currency = 'USD' THEN f.amount ELSE 0 END) as receiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' AND f.currency = 'USD' THEN f.amount ELSE 0 END) as pendingReceiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' THEN 1 ELSE 0 END) as pendingCount
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ?)' : ''}
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

      const activeLogistics = await dbGet<{ count: number }>(
        `
          SELECT COUNT(*) AS count
          FROM logistics_records l
          JOIN orders o ON o.id = l.order_id
          WHERE l.status != 'arrived' AND l.deleted_at IS NULL AND o.deleted_at IS NULL
          ${req.user?.role !== 'admin' ? ' AND (l.created_by = ? OR o.created_by = ?)' : ''}
        `,
        req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []
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
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ?)' : ''}
        ORDER BY f.created_at ASC
        LIMIT 3
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

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
        ${req.user?.role !== 'admin' ? ' AND o.created_by = ?' : ''}
        LIMIT 2
      `, req.user?.role !== 'admin' ? [req.user?.id] : []);

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
        ${req.user?.role !== 'admin' ? ' AND o.created_by = ?' : ''}
        LIMIT 2
      `, req.user?.role !== 'admin' ? [req.user?.id] : []);

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
        ...missingLogistics.map(l => ({
          id: `logistics-${l.id}`,
          type: 'logistics_pending',
          order_display_id: l.order_display_id,
          customer_name: l.customer_name,
          desc: '已发运，待创建物流单',
          days: 0,
          actionLabel: '创建物流',
          urgency: 'medium'
        }))
      ].slice(0, 5);

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
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ?)' : ''}
        UNION ALL
        SELECT 'logistics' as type, l.id, o.display_id, c.name as customer_name,
          '物流更新' as title, '货物已发出 · ' || l.carrier as desc, l.created_at,
          CASE WHEN l.status = 'arrived' THEN '已送达' WHEN l.status = 'shipped' THEN '运输中' ELSE '备货中' END as value,
          'text-slate-500' as valueColor
        FROM logistics_records l JOIN orders o ON l.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE l.deleted_at IS NULL AND o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND (l.created_by = ? OR o.created_by = ?)' : ''}
        UNION ALL
        SELECT 'customs' as type, cr.id, o.display_id, c.name as customer_name,
          '报关完成' as title, '报关单号 ' || cr.declaration_no as desc, cr.created_at,
          '' as value, '' as valueColor
        FROM customs_records cr JOIN orders o ON cr.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND o.created_by = ?' : ''}
        UNION ALL
        SELECT 'order' as type, o.id, o.display_id, c.name as customer_name,
          '新建订单' as title, o.product_summary as desc, o.created_at,
          'USD ' || o.total_amount as value,
          'text-primary-navy dark:text-white' as valueColor
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND o.created_by = ?' : ''}
        ORDER BY 7 DESC
        LIMIT 8
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id, req.user?.id] : []);

      const activities = activitiesRows.map(a => ({
        ...a,
        order_display_id: a.display_id
      }));

      const statusRows = await dbAll<{ status: string, count: number }[]>(`
        SELECT status, COUNT(*) as count FROM orders WHERE deleted_at IS NULL 
        ${req.user?.role !== 'admin' ? ' AND created_by = ?' : ''}
        GROUP BY status
      `, req.user?.role !== 'admin' ? [req.user?.id] : []);

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
          ${SQL.date('created_at', '%Y-%m')} AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE created_at >= ${SQL.monthsAgo(6)} AND deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND created_by = ?' : ''}
        GROUP BY month ORDER BY month ASC
      `, req.user?.role !== 'admin' ? [req.user?.id] : []);

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
        WHERE f.created_at >= ${SQL.monthsAgo(6)} AND f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
        ${req.user?.role !== 'admin' ? ' AND (f.created_by = ? OR o.created_by = ?)' : ''}
        GROUP BY month ORDER BY month ASC
      `, req.user?.role !== 'admin' ? [req.user?.id, req.user?.id] : []);

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
      const customerCount = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM customers WHERE deleted_at IS NULL ${req.user?.role !== 'admin' ? ' AND created_by = ?' : ''}`, req.user?.role !== 'admin' ? [req.user?.id] : []);

      // Risk detection: low margin (< 8%) and freight inversion
      const profitRows = await dbAll<{ order_id: number; display_id: string; customer_name: string; data: any }[]>(`
        SELECT o.id as order_id, o.display_id, c.name as customer_name, op.data
        FROM order_profits op
        JOIN orders o ON o.id = op.order_id
        JOIN customers c ON c.id = o.customer_id
        WHERE o.deleted_at IS NULL
        ${req.user?.role !== 'admin' ? ' AND o.created_by = ?' : ''}
        ORDER BY op.updated_at DESC
        LIMIT 20
      `, req.user?.role !== 'admin' ? [req.user?.id] : []);

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
