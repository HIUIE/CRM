import { dbAll, dbGet, dbRun } from '../lib/db.js';
import type { UserRole } from '../domain.js';
import { getDataScopeConstraint, getOrderScopeConstraint } from '../lib/auth.js';

interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export type AiToolCall = { tool: string; params: Record<string, string> };
export type AiToolContext = { userId: number; role: UserRole };
type ToolHandler = (params: Record<string, string>, context: AiToolContext) => Promise<ToolResult>;

export const AI_TOOLS: Record<string, { description: string; params: string; mutating?: boolean; requiredRole?: UserRole; handler: ToolHandler }> = {
  create_task: {
    description: '创建新任务并指派给指定成员',
    params: 'title (任务标题), assignee_username (负责人用户名), due_date (截止日期 YYYY-MM-DD), priority (P0/P1/P2, 默认 P2), description (描述, 可选)',
    mutating: true,
    handler: async (p, context) => {
      const user = await dbGet<{ id: number }>('SELECT id FROM users WHERE username = ? AND active != 0', [p.assignee_username]);
      if (!user) return { success: false, message: `未找到用户"${p.assignee_username}"` };
      await dbRun(
        `INSERT INTO tasks (title, assignee_id, due_date, priority, status, description, created_by) VALUES (?, ?, ?, ?, 'todo', ?, ?)`,
        [p.title, user.id, p.due_date, p.priority || 'P2', p.description || '', context.userId],
      );
      return { success: true, message: `任务"${p.title}"已创建，指派给 ${p.assignee_username}` };
    },
  },

  create_followup: {
    description: '为指定客户添加跟进记录',
    params: 'customer_id (客户ID), content (跟进内容), channel (渠道,如电话/邮件/会面, 可选)',
    mutating: true,
    handler: async (p, context) => {
      const [scopeSql, scopeParams] = getDataScopeConstraint(context, 'c', 'owner_user_id');
      const customer = await dbGet<{ id: number; display_id: string; name: string }>(`SELECT id, display_id, name FROM customers c WHERE deleted_at IS NULL ${scopeSql} AND (id = ? OR display_id = ?)`, [...scopeParams, p.customer_id, p.customer_id]);
      if (!customer) return { success: false, message: `未找到客户"${p.customer_id}"或无权访问` };
      await dbRun(
        `INSERT INTO customer_followups (customer_id, content, channel, created_by) VALUES (?, ?, ?, ?)`,
        [customer.id, p.content, p.channel || 'other', context.userId],
      );
      return { success: true, message: `客户"${customer.name}"的跟进记录已添加` };
    },
  },

  add_production_log: {
    description: '为指定订单添加生产进度日志',
    params: 'order_id (订单ID), content (进度内容)',
    mutating: true,
    handler: async (p, context) => {
      const [scopeSql, scopeParams] = getOrderScopeConstraint(context, 'o', 'c');
      const plan = await dbGet<{ id: number }>(
        `SELECT pp.id FROM production_plans pp INNER JOIN orders o ON o.id = pp.order_id LEFT JOIN customers c ON c.id = o.customer_id WHERE o.deleted_at IS NULL ${scopeSql} AND o.id = ?`,
        [...scopeParams, Number(p.order_id)],
      );
      if (!plan) return { success: false, message: `订单 ${p.order_id} 暂无生产安排或无权访问` };
      await dbRun(
        `INSERT INTO production_logs (plan_id, content, created_by) VALUES (?, ?, ?)`,
        [plan.id, p.content, context.userId],
      );
      return { success: true, message: `订单 ${p.order_id} 的生产日志已记录` };
    },
  },

  get_order_status: {
    description: '查询指定订单的完整状态摘要',
    params: 'order_no (订单显示编号, 如 ORD-2026-...)',
    handler: async (p, context) => {
      const [scopeSql, scopeParams] = getOrderScopeConstraint(context, 'o', 'c');
      const order = await dbGet(`
        SELECT o.*, c.name AS customer_name, c.country
        FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.display_id = ? AND o.deleted_at IS NULL ${scopeSql}
      `, [p.order_no, ...scopeParams]);
      if (!order) return { success: false, message: `未找到订单 ${p.order_no} 或无权访问` };
      const finance = await dbAll('SELECT type, SUM(amount) AS total FROM finance_records WHERE order_id = ? AND deleted_at IS NULL GROUP BY type', [order.id]);
      const logistics = await dbAll('SELECT COUNT(*) AS count, status FROM logistics_records WHERE order_id = ? AND deleted_at IS NULL GROUP BY status', [order.id]);
      const production = await dbGet('SELECT production_status, inspection_status FROM production_plans WHERE order_id = ?', [order.id]);
      return {
        success: true,
        message: `订单 ${p.order_no} 当前状态：${order.status}，客户：${order.customer_name}，金额：${order.currency || 'USD'} ${Number(order.total_amount).toLocaleString()}${production ? `，生产：${production.production_status}` : ''}`,
        data: { order: order as Record<string, unknown>, finance, logistics, production: production as Record<string, unknown> || null },
      };
    },
  },

  list_tasks: {
    description: '查看当前所有待办任务',
    params: '无 (无需参数)',
    handler: async (p, context) => {
      let whereSql = 'WHERE t.status != \'done\'';
      const params = [];
      if (context.role !== 'admin') {
        whereSql += ' AND (t.assignee_id = ? OR t.created_by = ?)';
        params.push(context.userId, context.userId);
      }
      const tasks = await dbAll(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id ${whereSql} ORDER BY datetime(t.created_at) DESC LIMIT 10`, params);
      if (!tasks.length) return { success: true, message: '当前没有待办任务。' };
      const lines = tasks.map((t: any) => `#${t.id} ${t.title}（负责人：${t.assignee_name}，优先级：${t.priority}，截止：${t.due_date}）`);
      return { success: true, message: `当前有 ${tasks.length} 个待办任务：\n${lines.join('\n')}` };
    },
  },

  list_overdue_payments: {
    description: '查看所有逾期未收款项',
    params: '无 (无需参数)',
    handler: async (p, context) => {
      const [scopeSql, scopeParams] = getOrderScopeConstraint(context, 'o', 'c');
      const items = await dbAll(`
        SELECT *
        FROM (
          SELECT o.display_id, c.name AS customer_name, COALESCE(NULLIF(o.currency, ''), 'USD') AS currency, o.total_amount, o.created_at,
            COALESCE((SELECT SUM(amount) FROM finance_records WHERE order_id = o.id AND type = 'receipt' AND status = 'completed' AND currency = COALESCE(NULLIF(o.currency, ''), 'USD') AND deleted_at IS NULL), 0) AS paid
          FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
          WHERE o.status != 'completed' AND o.deleted_at IS NULL ${scopeSql}
        ) overdue_orders
        WHERE paid < total_amount
        ORDER BY created_at ASC
      `, scopeParams);
      if (!items.length) return { success: true, message: '没有逾期未收款。' };
      const lines = items.map((i: any) => `${i.display_id} ${i.customer_name} 应收 ${i.currency || 'USD'} ${Number(i.total_amount).toLocaleString()} 已收 ${i.currency || 'USD'} ${Number(i.paid).toLocaleString()}`);
      return { success: true, message: `以下 ${items.length} 笔订单尚未结清：\n${lines.join('\n')}` };
    },
  },

  list_customers: {
    description: '查看客户列表',
    params: 'keyword (关键词搜索, 可选)',
    handler: async (p, context) => {
      const [scopeSql, scopeParams] = getDataScopeConstraint(context, 'c', 'owner_user_id');
      const sql = p.keyword
        ? `SELECT id, name, country FROM customers c WHERE deleted_at IS NULL ${scopeSql} AND (name LIKE ? OR country LIKE ?) ORDER BY created_at DESC LIMIT 10`
        : `SELECT id, name, country FROM customers c WHERE deleted_at IS NULL ${scopeSql} ORDER BY created_at DESC LIMIT 10`;
      const params = p.keyword ? [...scopeParams, `%${p.keyword}%`, `%${p.keyword}%`] : scopeParams;
      const customers = await dbAll(sql, params);
      if (!customers.length) return { success: true, message: '未找到匹配的客户。' };
      const lines = customers.map((c: any) => `#${c.id} ${c.name}（${c.country || '未知国家'}）`);
      return { success: true, message: `找到 ${customers.length} 个客户：\n${lines.join('\n')}` };
    },
  },
};

export const AI_TOOLS_SYSTEM_PROMPT = `你是一个嵌入在 SmartTrade CRM 系统中的 AI 业务助手。除了回答问题，你还可以执行以下操作：

${Object.entries(AI_TOOLS).map(([name, tool]) => `- ${name}: ${tool.description}。参数：${tool.params}`).join('\n')}

如果你检测到用户想要执行操作，调用正确的工具并返回结果。如果用户只是提问，直接回答即可。
回答时保持专业、简洁，使用中文。`;
