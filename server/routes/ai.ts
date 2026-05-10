import { Router } from 'express';
import { buildOrderAnalysisPrompt, buildOrderParsingPrompt, resolveAiProvider, resolveAiProviderApiKey, runGeminiModel, runOpenAiCompatibleModel, sanitizeOrderData } from '../services/ai.js';
import { AI_TOOLS, AI_TOOLS_SYSTEM_PROMPT, type AiToolCall } from '../services/ai-tools.js';
import { buildOrderDetail } from '../services/order-detail.js';
import { getSettingValue } from '../services/settings.js';
import { readString } from '../lib/values.js';
import { fail, handleRouteError } from '../lib/http.js';
import { checkOrderAccess, requireAuth, type AuthedRequest } from '../lib/auth.js';

async function resolveModel() {
  const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
  const provider = resolveAiProvider(selectedModel);
  const apiKey = resolveAiProviderApiKey(provider, await getSettingValue('ai_api_key'));
  const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
  let baseUrl = configuredBaseUrl;
  if (!baseUrl) {
    if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com';
    else if (provider === 'openai-compatible') baseUrl = 'https://api.openai.com';
  }
  if (!apiKey) throw new Error('AI_API_KEY_MISSING');
  return { selectedModel, provider, apiKey: apiKey || '', baseUrl };
}

function findToolCall(text: string): AiToolCall | null {
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

function readPendingAction(raw: unknown): AiToolCall | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { tool?: unknown; params?: unknown };
  const tool = readString(candidate.tool);
  if (!tool || !AI_TOOLS[tool]) return null;
  const params: Record<string, string> = {};
  if (candidate.params && typeof candidate.params === 'object') {
    for (const [key, value] of Object.entries(candidate.params as Record<string, unknown>)) {
      params[key] = readString(value);
    }
  }
  return { tool, params };
}

function describeToolCall(toolCall: AiToolCall) {
  const tool = AI_TOOLS[toolCall.tool];
  const params = Object.entries(toolCall.params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join('，');
  return `${tool.description}${params ? `（${params}）` : ''}`;
}

async function executeToolCall(req: AuthedRequest, toolCall: AiToolCall) {
  const tool = AI_TOOLS[toolCall.tool];
  if (!tool) {
    throw new Error('AI_TOOL_NOT_FOUND');
  }
  if (tool.requiredRole && req.user?.role !== tool.requiredRole) {
    throw new Error('AI_TOOL_FORBIDDEN');
  }
  return tool.handler(toolCall.params, { userId: req.user!.id, role: req.user!.role });
}

export function createAiRouter() {
  const router = Router();

  // 1. 聊天对话路由 (由 AI 向导页面使用) — 支持工具调用
  router.post('/chat', requireAuth, async (req: AuthedRequest, res) => {
    const message = readString(req.body?.message);
    const history = (req.body?.history || []) as { role: 'user' | 'assistant'; content: string }[];
    const pendingAction = readPendingAction(req.body?.pendingAction);
    const confirmAction = req.body?.confirmAction === true;
    if (!message && !pendingAction) return fail(res, 400, '请输入对话内容', 'INVALID_AI_INPUT');

    try {
      if (pendingAction) {
        if (!confirmAction) {
          return res.json({
            content: `请确认是否执行：${describeToolCall(pendingAction)}`,
            requiresConfirmation: true,
            pendingAction,
          });
        }
        const toolResult = await executeToolCall(req, pendingAction);
        return res.json({ content: toolResult.message, action: { tool: pendingAction.tool, result: toolResult } });
      }

      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const safeMessage = sanitizeOrderData(message);
      
      // P12: Backend context management - limit history to last 10 messages
      const limitedHistory = history.slice(-10);
      
      const prompt = `${AI_TOOLS_SYSTEM_PROMPT}\n\n用户消息：\n"""\n${safeMessage}\n"""\n\n如果你需要执行操作，请以 [ACTION: 工具名 参数名="参数值"] 的格式输出。例如创建任务：[ACTION: create_task title="测试任务" assignee_username="root" due_date="2026-05-01"]。如果需要查数据也同理。不执行操作时直接回复即可。`;

      const result = provider === 'gemini'
        ? await runGeminiModel(selectedModel, apiKey, prompt, false, limitedHistory)
        : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt, jsonMode: false, history: limitedHistory });

      const rawContent = typeof result === 'string' ? result : (result.content || result.summary || JSON.stringify(result));

      // Check if AI wants to call a tool
      const toolCall = findToolCall(rawContent);
      if (toolCall) {
        if (AI_TOOLS[toolCall.tool].mutating && !confirmAction) {
          return res.json({
            content: `AI 请求执行：${describeToolCall(toolCall)}。请确认后再执行。`,
            requiresConfirmation: true,
            pendingAction: toolCall,
          });
        }

        const toolResult = await executeToolCall(req, toolCall);
        // Second AI call: summarize the result
        const summaryPrompt = `你刚刚执行了操作"${toolCall.tool}"，结果是：${toolResult.message}。请用自然语言简要告知用户结果，保持专业简洁。`;
        const summaryResult = provider === 'gemini'
          ? await runGeminiModel(selectedModel, apiKey, summaryPrompt, false)
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
      if (error.message === 'AI_TOOL_FORBIDDEN') {
        return fail(res, 403, '当前账号无权执行该 AI 操作', 'AI_TOOL_FORBIDDEN');
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
  router.post('/analyze-order', async (req: AuthedRequest, res) => {
    const orderNo = readString(req.body?.orderNo);
    if (!orderNo) return fail(res, 400, '请提供订单编号', 'INVALID_AI_INPUT');

    try {
      const allowedOrder = await checkOrderAccess(req, orderNo);
      if (!allowedOrder) {
        return fail(res, 404, '订单不存在或无权访问', 'ORDER_NOT_FOUND');
      }
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
