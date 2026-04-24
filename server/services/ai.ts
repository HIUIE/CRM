import { GoogleGenAI } from '@google/genai';
import { parseJsonObject } from './json.js';

export function resolveAiProvider(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes('gemini')) {
    return 'gemini';
  }
  if (normalized.includes('deepseek')) {
    return 'deepseek';
  }
  if (normalized.includes('gpt')) {
    return 'openai-compatible';
  }
  return 'openai-compatible';
}

export async function runOpenAiCompatibleModel({
  model,
  apiKey,
  baseUrl,
  prompt,
}: {
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string | null } }>;
      }
    | null;

  if (!response.ok) {
    throw new Error(data?.error?.message || `兼容模型请求失败 (${response.status})`);
  }

  const content = data?.choices?.[0]?.message?.content || '';
  return parseJsonObject(content);
}

export function buildOrderParsingPrompt(text: string) {
  return `你是一个资深外贸业务助理。请从下面这段杂乱的客户消息或邮件中提取关键订单信息。
请以严格 JSON 格式返回，且只能返回 JSON，不要包含 markdown 代码块或额外说明：
{
  "customerName": "提取的客户或公司名，如果没有提取到则填 暂无",
  "country": "提取的国家，如果没有填 暂无",
  "logistics": "提取的物流要求，如果没有填 无",
  "payment": "付款方式，如 30%定金",
  "totalAmount": 只保留数字金额，如果没提到则填 0,
  "details": "关于商品规格、包装、要求等的详细摘要",
  "suggestedReply": "拟写一段简短、专业、得体的英文回复，可用于快速确认订单"
}
需要解析的内容如下：
"""
${text}
"""`;
}

export function buildOrderAnalysisPrompt(data: any) {
  const dataJson = JSON.stringify(data, null, 2);
  return `你是一个资深的国际贸易与供应链专家。请根据以下订单数据进行深度分析，识别潜在风险并给出执行建议。

数据详情（已脱敏）：
${dataJson}

请严格按以下 JSON 格式返回分析结果，不要包含任何 Markdown 格式：
{
  "score": 85,
  "risks": [
    { "level": "high", "content": "风险描述" }
  ],
  "suggestions": [
    { "content": "建议内容" }
  ],
  "summary": "一句话核心总结"
}

分析重点：
1. 支付风险：是否逾期未付，收款比例是否过低。
2. 物流风险：交期是否临近，物流是否有更新。
3. 报关风险：是否及时录入报关单号。
4. 生产进度：工厂交期是否正常。`;
}

export function sanitizeOrderData(data: any) {
  const s = JSON.parse(JSON.stringify(data));
  if (s.customer) {
    s.customer.name = '客户 A (脱敏)';
    s.customer.contact = 'PII_REMOVED';
  }
  if (s.order) {
    delete s.order.details;
  }
  if (s.items) {
    s.items.forEach((i: any) => {
      delete i.image_url;
      delete i.imageUrl;
    });
  }
  if (s.financeRecords) {
    s.financeRecords.forEach((f: any) => {
      delete f.remark;
      delete f.attachments;
    });
  }
  if (s.logisticsRecords) {
    s.logisticsRecords.forEach((l: any) => {
      delete l.remark;
      delete l.trackingNo;
      delete l.attachments;
    });
  }
  if (s.customs) {
    delete s.customs.declarationNo;
    delete s.customs.remark;
    delete s.customs.attachments;
  }
  return s;
}

export async function runGeminiModel(model: string, apiKey: string, prompt: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  return parseJsonObject(response.text || '');
}
