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
        draftOrders: number;
        completedOrders: number;
      }>(`
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS activeOrders,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draftOrders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedOrders
        FROM orders
      `);

      const financeRows = await db.all<{ type: string; currency: string; total: number }[]>(`
        SELECT type, currency, COALESCE(SUM(amount), 0) AS total
        FROM finance_records
        WHERE status = 'completed'
        GROUP BY type, currency
      `);

      const recentFinance = await db.all(`
        SELECT
          f.id,
          f.type,
          f.amount,
          f.currency,
          f.status,
          f.created_at,
          o.display_id AS order_display_id,
          c.name AS customer_name
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY datetime(f.created_at) DESC, f.id DESC
        LIMIT 6
      `);

      const recentLogistics = await db.all(`
        SELECT
          l.id,
          l.carrier,
          l.tracking_no,
          l.status,
          l.created_at,
          o.display_id AS order_display_id,
          c.name AS customer_name
        FROM logistics_records l
        LEFT JOIN orders o ON o.id = l.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY datetime(l.created_at) DESC, l.id DESC
        LIMIT 6
      `);

      const pendingFinance = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM finance_records WHERE status = 'pending'`,
      );
      const pendingLogistics = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM logistics_records WHERE status != 'arrived'`,
      );

      const financeSummary = financeRows.reduce(
        (summary, row) => {
          const bucket = row.type === 'receipt' ? summary.receipt : summary.payment;
          bucket[row.currency as 'USD' | 'CNY'] = row.total;
          return summary;
        },
        {
          receipt: {} as Partial<Record<'USD' | 'CNY', number>>,
          payment: {} as Partial<Record<'USD' | 'CNY', number>>,
        },
      );

      res.json({
        overview: {
          totalOrders: overview?.totalOrders || 0,
          activeOrders: overview?.activeOrders || 0,
          draftOrders: overview?.draftOrders || 0,
          completedOrders: overview?.completedOrders || 0,
        },
        financeSummary,
        pendingFinanceCount: pendingFinance?.count || 0,
        pendingLogisticsCount: pendingLogistics?.count || 0,
        recentFinance,
        recentLogistics,
      });
    } catch (error) {
      return handleRouteError(res, error, '读取控制台数据失败');
    }
  });

  return router;
}
