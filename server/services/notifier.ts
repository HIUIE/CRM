import { getSettingValue } from './settings.js';

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
