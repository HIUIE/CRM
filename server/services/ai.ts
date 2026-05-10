import { GoogleGenAI } from '@google/genai';
import { parseJsonObject } from './json.js';
import { sanitizeForAI } from '../lib/sanitizer.js';

export type AiProvider = 'gemini' | 'deepseek' | 'openai-compatible';

export function resolveAiProvider(model: string): AiProvider {
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

export function resolveAiProviderApiKey(provider: AiProvider, configuredKey?: string | null) {
  const fromSettings = (configuredKey || '').trim();
  if (fromSettings) return fromSettings;
  if (provider === 'gemini') return (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (provider === 'deepseek') return (process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '').trim();
  return (process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '').trim();
}

export async function runOpenAiCompatibleModel({
  model,
  apiKey,
  baseUrl,
  prompt,
  history = [],
  jsonMode = true,
}: {
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  jsonMode?: boolean;
}) {
  let normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  
  if (normalizedBaseUrl.includes('deepseek.com')) {
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1$/, '');
  } else if (normalizedBaseUrl.includes('api.openai.com') && !normalizedBaseUrl.endsWith('/v1')) {
    normalizedBaseUrl += '/v1';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.1,
      messages: [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: prompt }
      ],
    };

    // 只有在 jsonMode 为 true 时才发送 response_format
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SmartTrade-CRM/2.0',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += `: ${errorJson.error?.message || errorText}`;
      } catch (_e) {
        errorMessage += `: ${errorText}`;
      }
      throw new Error(`AI 服务端返回错误 (${errorMessage})`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const content = (data as Record<string, any>).choices?.[0]?.message?.content || '';
    
    // 如果不是 JSON 模式，直接返回文字内容，不要尝试解析
    if (!jsonMode) {
      return content;
    }

    const cleanContent = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    return parseJsonObject(cleanContent);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildOrderParsingPrompt(text: string) {
  // Pre-sanitize raw text input to prevent leaking contacts in the free-text prompt
  const safeText = sanitizeForAI(text);

  return `你是一个资深外贸业务助理。请从下面这段杂乱的客户消息或邮件中提取关键订单信息。
请以严格 JSON 格式返回，且只能返回 JSON，不要包含 markdown 代码块或额外说明：
{
  "customerName": "提取的客户或公司名，如果没有提取到则填 暂无",
  "country": "提取的国家，如果没有填 暂无",
  "logistics": "提取的物流要求，如果没有填 无",
  "payment": "付款方式，如 30%定金",
  "totalAmount": 只保留数字金额，如果没提到则填 0,
  "currency": 订单结算币种，如 USD/CNY/EUR，未提到默认 USD,
  "details": "关于商品规格、包装、要求等的详细摘要",
  "suggestedReply": "拟写一段简短、专业、得体的英文回复，可用于快速确认订单"
}
需要解析的内容如下：
"""
${safeText}
"""`;
}

export function buildOrderAnalysisPrompt(data: unknown) {
  // Deeply sanitize all fields recursively (names, contacts, precise addresses)
  const safeData = sanitizeForAI(data);
  const dataJson = JSON.stringify(safeData, null, 2);

  return `你是一个资深的国际贸易与供应链专家。请根据以下订单数据进行深度分析，识别潜在风险并给出执行建议。

数据详情（已严格脱敏，不含任何真实姓名、电话或详细门牌）：
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

export function sanitizeOrderData(data: unknown) {
  return sanitizeForAI(data);
}

export async function runGeminiModel(
  model: string, 
  apiKey: string, 
  prompt: string, 
  jsonMode = true,
  history: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
) {
  const ai = new GoogleGenAI({ apiKey });
  const contents = [
    ...history.filter(h => h.role !== 'system').map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const response = await ai.models.generateContent({
    model,
    contents
  });
  const text = response.text || '';
  if (!jsonMode) {
    return text;
  }
  return parseJsonObject(text);
}
