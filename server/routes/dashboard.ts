import { Router } from 'express';
import { db } from '../db.js';
import { handleRouteError } from '../lib/http.js';

export function createDashboardRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const overview = await db.get<{
        totalOrders: number;
        activeOrders: number;
      }>(`
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS activeOrders
        FROM orders
      `);

      const financeStats = await db.get<{
        receiptUsd: number;
        pendingReceiptUsd: number;
        pendingCount: number;
      }>(`
        SELECT
          SUM(CASE WHEN status = 'completed' AND type = 'receipt' AND currency = 'USD' THEN amount ELSE 0 END) as receiptUsd,
          SUM(CASE WHEN status = 'pending' AND type = 'receipt' AND currency = 'USD' THEN amount ELSE 0 END) as pendingReceiptUsd,
          SUM(CASE WHEN status = 'pending' AND type = 'receipt' THEN 1 ELSE 0 END) as pendingCount
        FROM finance_records
      `);

      const activeLogistics = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM logistics_records WHERE status != 'arrived'`,
      );

      const overduePayments = await db.all<{
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
          CAST((julianday('now') - julianday(f.created_at)) AS INTEGER) as days_pending
        FROM finance_records f
        JOIN orders o ON f.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE f.type = 'receipt' AND f.status = 'pending'
        ORDER BY f.created_at ASC
        LIMIT 3
      `);

      const missingCustoms = await db.all<{
        id: number;
        order_display_id: string;
        customer_name: string;
      }[]>(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN customs_records cr ON cr.order_id = o.id
        WHERE o.status IN ('customs', 'shipping') AND cr.id IS NULL
        LIMIT 2
      `);

      const missingLogistics = await db.all<{
        id: number;
        order_display_id: string;
        customer_name: string;
      }[]>(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN logistics_records lr ON lr.order_id = o.id
        WHERE o.status IN ('shipping') AND lr.id IS NULL
        LIMIT 2
      `);

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

      const activitiesRows = await db.all<{
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
        WHERE f.status = 'completed'
        UNION ALL
        SELECT 'logistics' as type, l.id, o.display_id, c.name as customer_name,
          '物流更新' as title, '货物已发出 · ' || l.carrier as desc, l.created_at,
          CASE WHEN l.status = 'arrived' THEN '已送达' WHEN l.status = 'shipped' THEN '运输中' ELSE '备货中' END as value,
          'text-slate-500' as valueColor
        FROM logistics_records l JOIN orders o ON l.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        UNION ALL
        SELECT 'customs' as type, cr.id, o.display_id, c.name as customer_name,
          '报关完成' as title, '报关单号 ' || cr.declaration_no as desc, cr.created_at,
          '' as value, '' as valueColor
        FROM customs_records cr JOIN orders o ON cr.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        UNION ALL
        SELECT 'order' as type, o.id, o.display_id, c.name as customer_name,
          '新建订单' as title, o.product_summary as desc, o.created_at,
          'USD ' || o.total_amount as value,
          'text-primary-navy dark:text-white' as valueColor
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
        ORDER BY 7 DESC
        LIMIT 8
      `);

      const activities = activitiesRows.map(a => ({
        ...a,
        order_display_id: a.display_id
      }));

      const statusRows = await db.all<{ status: string, count: number }[]>(`
        SELECT status, COUNT(*) as count FROM orders GROUP BY status
      `);

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

      res.json({
        overview: {
          totalOrders,
          activeOrders: overview?.activeOrders || 0,
          receiptUsd: financeStats?.receiptUsd || 0,
          pendingReceiptUsd: financeStats?.pendingReceiptUsd || 0,
          pendingFinanceCount: financeStats?.pendingCount || 0,
          activeLogistics: activeLogistics?.count || 0,
        },
        todos,
        activities,
        statusDistribution,
      });
    } catch (error) {
      return handleRouteError(res, error, '读取控制台数据失败');
    }
  });

  return router;
}
