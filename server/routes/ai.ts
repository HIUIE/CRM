import { Router } from 'express';
import { buildOrderAnalysisPrompt, buildOrderParsingPrompt, resolveAiProvider, runGeminiModel, runOpenAiCompatibleModel, sanitizeOrderData } from '../services/ai.js';
import { AI_TOOLS, AI_TOOLS_SYSTEM_PROMPT } from '../services/ai-tools.js';
import { buildOrderDetail } from '../services/order-detail.js';
import { getSettingValue } from '../services/settings.js';
import { readString } from '../lib/values.js';
import { fail, handleRouteError } from '../lib/http.js';

async function resolveModel() {
  const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
  const provider = resolveAiProvider(selectedModel);
  const apiKey = (await getSettingValue('ai_api_key')) || process.env.AI_API_KEY;
  const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
  let baseUrl = configuredBaseUrl;
  if (!baseUrl) {
    if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com';
    else if (provider === 'openai-compatible') baseUrl = 'https://api.openai.com';
  }
  if (provider !== 'gemini' && !apiKey) throw new Error('AI_API_KEY_MISSING');
  return { selectedModel, provider, apiKey: apiKey || '', baseUrl };
}

function findToolCall(text: string): { tool: string; params: Record<string, string> } | null {
  const match = text.match(/\[ACTION:\s*(\w+)\s*(.*?)\]/s);
  if (!match) return null;
  const tool = match[1];
  const raw = match[2].trim();
  const params: Record<string, string> = {};
  // Parse key="value" pairs
  const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
  let pm: RegExpExecArray | null;
  while ((pm = paramRegex.exec(raw)) !== null) {
    params[pm[1]] = pm[2];
  }
  return AI_TOOLS[tool] ? { tool, params } : null;
}

export function createAiRouter() {
  const router = Router();

  // 1. 聊天对话路由 (由 AI 向导页面使用) — 支持工具调用
  router.post('/chat', async (req, res) => {
    const message = readString(req.body?.message);
    if (!message) return fail(res, 400, '请输入对话内容', 'INVALID_AI_INPUT');

    try {
      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const safeMessage = sanitizeOrderData(message);
      const prompt = `${AI_TOOLS_SYSTEM_PROMPT}\n\n用户消息：\n"""\n${safeMessage}\n"""\n\n如果你需要执行操作，请以 [ACTION: 工具名 参数名="参数值"] 的格式输出。例如创建任务：[ACTION: create_task title="测试任务" assignee_username="root" due_date="2026-05-01"]。如果需要查数据也同理。不执行操作时直接回复即可。`;

      const result = provider === 'gemini'
        ? await runGeminiModel(selectedModel, apiKey, prompt)
        : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt, jsonMode: false });

      const rawContent = typeof result === 'string' ? result : (result.content || result.summary || JSON.stringify(result));

      // Check if AI wants to call a tool
      const toolCall = findToolCall(rawContent);
      if (toolCall) {
        const toolResult = await AI_TOOLS[toolCall.tool].handler(toolCall.params);
        // Second AI call: summarize the result
        const summaryPrompt = `你刚刚执行了操作"${toolCall.tool}"，结果是：${toolResult.message}。请用自然语言简要告知用户结果，保持专业简洁。`;
        const summaryResult = provider === 'gemini'
          ? await runGeminiModel(selectedModel, apiKey, summaryPrompt)
          : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt: summaryPrompt, jsonMode: false });
        const summary = typeof summaryResult === 'string' ? summaryResult : (summaryResult.content || toolResult.message);
        // Clean the ACTION tag from output
        const cleanSummary = summary.replace(/\[ACTION:.*?\]/gs, '').trim();
        res.json({ content: cleanSummary || toolResult.message, action: { tool: toolCall.tool, result: toolResult } });
        return;
      }

      const content = rawContent.replace(/\[ACTION:.*?\]/gs, '').trim();
      res.json({ content: content || '已收到您的消息。' });
    } catch (error: any) {
      if (error.message === 'AI_API_KEY_MISSING') {
        return fail(res, 400, '请先在系统设置中配置可用的 AI API Key', 'AI_KEY_MISSING');
      }
      return handleRouteError(res, error, 'AI 助手暂时无法响应');
    }
  });

  // 2. 订单解析路由
  router.post('/parse-order', async (req, res) => {
    const text = readString(req.body?.text);
    if (!text) return fail(res, 400, '请先输入客户消息内容', 'INVALID_AI_INPUT');

    try {
      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const prompt = buildOrderParsingPrompt(text);
      const result = provider === 'gemini'
        ? await runGeminiModel(selectedModel, apiKey, prompt)
        : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });

      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, '订单解析失败');
    }
  });

  // 3. 订单分析路由
  router.post('/analyze-order', async (req, res) => {
    const orderNo = readString(req.body?.orderNo);
    if (!orderNo) return fail(res, 400, '请提供订单编号', 'INVALID_AI_INPUT');

    try {
      const rawData = await buildOrderDetail(orderNo);
      if (!rawData) return fail(res, 404, '订单不存在');

      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const prompt = buildOrderAnalysisPrompt(sanitizeOrderData(rawData));
      const result = provider === 'gemini'
        ? await runGeminiModel(selectedModel, apiKey, prompt)
        : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });

      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, '风险分析失败');
    }
  });

  return router;
}
