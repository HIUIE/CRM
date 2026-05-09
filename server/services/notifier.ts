import crypto from 'crypto';
import { getSettingValue } from './settings.js';
import { dbAll, dbRun } from '../lib/db.js';
import { emitToAll } from '../lib/socket.js';

const WEBHOOK_SETTING_KEY = 'webhook_url';
const WEBHOOK_SECRET_KEY = 'webhook_secret';

export async function getWebhookUrl() {
  return getSettingValue(WEBHOOK_SETTING_KEY, '');
}

export async function sendWebhook(title: string, content: string) {
  const url = await getWebhookUrl();
  const secret = await getSettingValue(WEBHOOK_SECRET_KEY, '');
  if (!url) return;

  const payload = {
    msgtype: 'markdown',
    markdown: {
      content: `### ${title}\n${content}\n---\n*SmartTrade AI CRM 自动通知*`,
    },
    timestamp: Date.now(),
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // P4: Add HMAC signature if secret is configured
  if (secret) {
    const bodyStr = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    headers['X-SmartTrade-Signature'] = signature;
    headers['X-SmartTrade-Timestamp'] = String(payload.timestamp);
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently fail — webhook is best-effort
  }
}

export async function notifyOrderCreated(displayId: string, customerName: string) {
  const baseUrl = process.env.PROJECT_URL || '';
  const link = baseUrl ? `[查看订单](${baseUrl}/orders/${displayId.toLowerCase()})` : '';
  
  // 1. 外部推送
  await sendWebhook('📦 新订单创建', `**订单号**: ${displayId}\n**客户**: ${customerName}\n${link}`);

  // 2. 存入数据库通知中心 (持久化给管理员)
  try {
    const admins = await dbAll<{ id: number }[]>(`SELECT id FROM users WHERE role = 'admin'`);
    for (const admin of admins) {
      await dbRun(
        `INSERT INTO notifications (user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?)`,
        [admin.id, '📦 新订单创建', `来自 ${customerName} 的新订单 ${displayId} 已录入`, `/orders/${displayId.toLowerCase()}`, 'system']
      );
    }
  } catch (e) { console.error('Failed to persist order notification', e); }

  // 3. 站内实时广播 (WebSocket)
  emitToAll('new-notification', {
    title: '📦 新订单提醒',
    message: `来自 ${customerName} 的新订单 ${displayId} 已录入`,
    link: `/orders/${displayId.toLowerCase()}`
  });
}

export async function notifyPaymentReceived(orderNo: string, amount: number, currency: string) {
  // 1. 外部推送
  await sendWebhook(
    '💰 收款到账',
    `**订单**: ${orderNo}\n**金额**: ${currency} ${amount}\n**状态**: 已完成`,
  );

  // 2. 存入数据库通知中心 (持久化给管理员)
  try {
    const admins = await dbAll<{ id: number }[]>(`SELECT id FROM users WHERE role = 'admin'`);
    for (const admin of admins) {
      await dbRun(
        `INSERT INTO notifications (user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?)`,
        [admin.id, '💰 收款到账', `订单 ${orderNo} 已收到 ${currency} ${amount}`, `/orders/${orderNo.toLowerCase()}?section=finance`, 'finance']
      );
    }
  } catch (e) { console.error('Failed to persist finance notification', e); }

  // 3. 站内推送
  emitToAll('new-notification', {
    title: '💰 收款成功',
    message: `订单 ${orderNo} 已收到款项 ${currency} ${amount}`,
    link: `/orders/${orderNo.toLowerCase()}?section=finance`
  });
}

export async function notifyTaskAssigned(title: string, assignee: string) {
  await sendWebhook(
    '📋 新任务指派',
    `**任务**: ${title}\n**负责人**: ${assignee}`,
  );
}

/**
 * 扫描并通知逾期回款订单
 * 逻辑：已发货 (shipped) 超过 30 天且未全额回款的订单
 */
export async function scanAndNotifyOverduePayments() {
  try {
    const query = `
      SELECT o.id, o.display_id, o.total_amount, c.name as customer_name,
             COALESCE((SELECT SUM(amount) FROM finance_records WHERE order_id = o.id AND type = 'receipt' AND status = 'completed' AND deleted_at IS NULL), 0) as paid_amount
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'shipped' 
        AND o.deleted_at IS NULL
        AND datetime(o.created_at) < datetime('now', '-30 days')
    `;
    const candidates = await dbAll<{ id: number; display_id: string; total_amount: number; customer_name: string; paid_amount: number }[]>(query);
    
    for (const order of candidates) {
      const remaining = order.total_amount - order.paid_amount;
      if (remaining > 0.01) {
        await sendWebhook(
          '⚠️ 回款逾期预警',
          `**订单号**: ${order.display_id}\n**客户**: ${order.customer_name}\n**订单总额**: USD ${order.total_amount}\n**待收余额**: USD ${remaining.toFixed(2)}\n**预警原因**: 已发货超过 30 天未结清`
        );
      }
    }
  } catch (error) {
    console.error('[notifier] Failed to scan overdue payments:', error);
  }
}

export async function scanAndNotifyInputInvoiceRisks() {
  try {
    const rows = await dbAll<{
      id: number;
      display_id: string;
      tax_mode: 'A' | 'C';
      customer_name: string;
      etd: string | null;
      shipping_date: string | null;
      has_qualified_invoice: number;
    }[]>(`
      SELECT
        o.id,
        o.display_id,
        COALESCE(NULLIF(o.tax_mode, ''), 'A') AS tax_mode,
        c.name AS customer_name,
        (
          SELECT COALESCE(NULLIF(l.etd, ''), NULLIF(l.shipping_date, ''))
          FROM logistics_records l
          WHERE l.order_id = o.id AND l.deleted_at IS NULL
          ORDER BY CASE WHEN l.segment_type = 'international' THEN 0 ELSE 1 END, l.id DESC
          LIMIT 1
        ) AS etd,
        (
          SELECT NULLIF(l.shipping_date, '')
          FROM logistics_records l
          WHERE l.order_id = o.id AND l.deleted_at IS NULL
          ORDER BY l.id DESC
          LIMIT 1
        ) AS shipping_date,
        CASE WHEN EXISTS (
          SELECT 1 FROM input_invoices ii
          WHERE ii.order_id = o.id
            AND ii.deleted_at IS NULL
            AND ii.invoice_type = 'vat_special'
            AND ii.invoice_status IN ('received', 'verified')
        ) THEN 1 ELSE 0 END AS has_qualified_invoice
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.deleted_at IS NULL
        AND COALESCE(NULLIF(o.tax_mode, ''), 'A') IN ('A', 'C')
    `);

    const admins = await dbAll<{ id: number }[]>(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC`);
    const assigneeId = admins[0]?.id;
    if (!assigneeId) return;
    const today = new Date();

    for (const order of rows) {
      if (Number(order.has_qualified_invoice) === 1) continue;
      let dueDate = '';
      let title = '';
      let description = '';

      if (order.tax_mode === 'A') {
        if (!order.etd) continue;
        const due = new Date(order.etd);
        if (Number.isNaN(due.getTime())) continue;
        due.setDate(due.getDate() + 30);
        if (today <= due) continue;
        dueDate = due.toISOString().slice(0, 10);
        title = `进项专票逾期催收：${order.display_id}`;
        description = `该订单已超过 ETD + 30 天，工厂进项专票仍未收齐，可能影响出口退税到账。客户：${order.customer_name || '未命名客户'}`;
      } else {
        const anchor = order.shipping_date || order.etd;
        if (!anchor) continue;
        const due = new Date(anchor);
        if (Number.isNaN(due.getTime())) continue;
        due.setDate(25);
        if (today <= due) continue;
        dueDate = due.toISOString().slice(0, 10);
        title = `内销抵扣专票催收：${order.display_id}`;
        description = `本月需申报内销增值税，请尽快催收进项专票进行抵扣。客户：${order.customer_name || '未命名客户'}`;
      }

      const existing = await dbAll<{ id: number }[]>(
        `SELECT id FROM tasks WHERE entity_type = 'ORDER' AND entity_id = ? AND title = ? AND status != 'done' LIMIT 1`,
        [order.display_id, title],
      );
      if (existing.length) continue;

      await dbRun(
        `INSERT INTO tasks (title, assignee_id, due_date, priority, entity_type, entity_id, description, created_by)
         VALUES (?, ?, ?, 'P1', 'ORDER', ?, ?, ?)`,
        [title, assigneeId, dueDate, order.display_id, description, assigneeId],
      );
      await dbRun(
        `INSERT INTO notifications (user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?)`,
        [assigneeId, '进项发票预警', description, `/orders/${order.display_id.toLowerCase()}?section=invoices`, 'system'],
      );
      await sendWebhook('⚠️ 进项发票预警', `**订单号**: ${order.display_id}\n**客户**: ${order.customer_name || '-'}\n**预警原因**: ${description}`);
    }
  } catch (error) {
    console.error('[notifier] Failed to scan input invoice risks:', error);
  }
}
