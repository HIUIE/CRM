import { Router } from 'express';
import { buildOrderAnalysisPrompt, buildOrderParsingPrompt, resolveAiProvider, runGeminiModel, runOpenAiCompatibleModel, sanitizeOrderData } from '../services/ai.js';
import { buildOrderDetail } from '../services/order-detail.js';
import { getSettingValue } from '../services/settings.js';
import { readString } from '../lib/values.js';
import { fail, handleRouteError } from '../lib/http.js';

export function createAiRouter() {
  const router = Router();

  // 1. 聊天对话路由 (由 AI 向导页面使用)
  router.post('/chat', async (req, res) => {
    const message = readString(req.body?.message);
    if (!message) return fail(res, 400, '请输入对话内容', 'INVALID_AI_INPUT');

    try {
      const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey = (await getSettingValue('ai_api_key')) || process.env.AI_API_KEY;
      const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
      
      let baseUrl = configuredBaseUrl;
      if (!baseUrl) {
        if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com';
        else if (provider === 'openai-compatible') baseUrl = 'https://api.openai.com';
      }

      if (provider !== 'gemini' && !apiKey) {
        return fail(res, 400, '请先在系统设置中配置可用的 AI API Key', 'AI_KEY_MISSING');
      }

      // 对话模式不强制要求 JSON 格式，解决 DeepSeek 400 校验报错
      const safeMessage = sanitizeOrderData(message);
      const prompt = `你是一个外贸实战专家。用户向你咨询业务问题，请给出专业、简练、有针对性的回答。用户消息：\n"""\n${safeMessage}\n"""`;
      
      const result = provider === 'gemini'
        ? await runGeminiModel(selectedModel, apiKey, prompt)
        : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt, jsonMode: false });

      // 如果 jsonMode 为 false，result 可能是字符串或包含 content 的对象
      const content = typeof result === 'string' ? result : (result.content || result.summary || JSON.stringify(result));
      res.json({ content });
    } catch (error) {
      return handleRouteError(res, error, 'AI 助手暂时无法响应');
    }
  });

  // 2. 订单解析路由
  router.post('/parse-order', async (req, res) => {
    const text = readString(req.body?.text);
    if (!text) return fail(res, 400, '请先输入客户消息内容', 'INVALID_AI_INPUT');

    try {
      const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey = (await getSettingValue('ai_api_key')) || process.env.AI_API_KEY;
      const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
      
      let baseUrl = configuredBaseUrl;
      if (!baseUrl) {
        if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com';
        else if (provider === 'openai-compatible') baseUrl = 'https://api.openai.com';
      }

      if (provider !== 'gemini' && !apiKey) {
        return fail(res, 400, '请配置 AI API Key', 'AI_KEY_MISSING');
      }

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

      const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey = (await getSettingValue('ai_api_key')) || process.env.AI_API_KEY;
      const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
      
      let baseUrl = configuredBaseUrl;
      if (!baseUrl) {
        if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com';
        else if (provider === 'openai-compatible') baseUrl = 'https://api.openai.com';
      }

      if (provider !== 'gemini' && !apiKey) {
        return fail(res, 400, '请配置 AI API Key', 'AI_KEY_MISSING');
      }

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
