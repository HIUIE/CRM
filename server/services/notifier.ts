import { getSettingValue } from './settings.js';
import { dbAll } from '../lib/db.js';

const WEBHOOK_SETTING_KEY = 'webhook_url';

export async function getWebhookUrl() {
  return getSettingValue(WEBHOOK_SETTING_KEY, '');
}

export async function sendWebhook(title: string, content: string) {
  const url = await getWebhookUrl();
  if (!url) return;

  const payload = {
    msgtype: 'markdown',
    markdown: {
      content: `### ${title}\n${content}\n---\n*SmartTrade AI CRM 自动通知*`,
    },
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently fail — webhook is best-effort
  }
}

export async function notifyOrderCreated(displayId: string, customerName: string) {
  const baseUrl = process.env.PROJECT_URL || '';
  const link = baseUrl ? `[查看订单](${baseUrl}/orders/${displayId.toLowerCase()})` : '';
  await sendWebhook('📦 新订单创建', `**订单号**: ${displayId}\n**客户**: ${customerName}\n${link}`);
}

export async function notifyPaymentReceived(orderNo: string, amount: number, currency: string) {
  await sendWebhook(
    '💰 收款到账',
    `**订单**: ${orderNo}\n**金额**: ${currency} ${amount}\n**状态**: 已完成`,
  );
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
