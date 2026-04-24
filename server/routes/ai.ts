import { Router } from 'express';
import { buildOrderAnalysisPrompt, buildOrderParsingPrompt, resolveAiProvider, runGeminiModel, runOpenAiCompatibleModel, sanitizeOrderData } from '../services/ai.js';
import { buildOrderDetail } from '../services/order-detail.js';
import { getSettingValue } from '../services/settings.js';
import { readString } from '../lib/values.js';
import { fail, handleRouteError } from '../lib/http.js';

export function createAiRouter() {
  const router = Router();

  router.post('/parse-order', async (req, res) => {
    const text = readString(req.body?.text);
    if (!text) {
      return fail(res, 400, '请先输入客户消息或邮件内容', 'INVALID_AI_INPUT');
    }

    try {
      const selectedModel = (await getSettingValue('current_ai_model', 'gemini-2.5-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey =
        (await getSettingValue('ai_api_key')) ||
        process.env.AI_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY;
      const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
      const baseUrl =
        configuredBaseUrl ||
        (provider === 'deepseek'
          ? 'https://api.deepseek.com/v1'
          : provider === 'openai-compatible'
            ? 'https://api.openai.com/v1'
            : '');

      if (!apiKey) {
        return fail(res, 400, '请先在系统设置中配置可用的 AI API Key', 'AI_KEY_MISSING');
      }

      const prompt = buildOrderParsingPrompt(text);
      const result =
        provider === 'gemini'
          ? await runGeminiModel(selectedModel, apiKey, prompt)
          : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });

      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, 'AI 解析失败');
    }
  });

  router.post('/analyze-order', async (req, res) => {
    const orderNo = readString(req.body?.orderNo);
    if (!orderNo) {
      return fail(res, 400, '请提供需要分析的订单编号', 'INVALID_AI_INPUT');
    }

    try {
      const rawData = await buildOrderDetail(orderNo);
      if (!rawData) {
        return fail(res, 404, '订单不存在', 'ORDER_NOT_FOUND');
      }

      const selectedModel = (await getSettingValue('current_ai_model', 'gemini-2.5-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey =
        (await getSettingValue('ai_api_key')) ||
        process.env.AI_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY;
      const configuredBaseUrl = readString(await getSettingValue('ai_base_url'));
      const baseUrl =
        configuredBaseUrl ||
        (provider === 'deepseek'
          ? 'https://api.deepseek.com/v1'
          : provider === 'openai-compatible'
            ? 'https://api.openai.com/v1'
            : '');

      if (!apiKey) {
        return fail(res, 400, '请先在系统设置中配置可用的 AI API Key', 'AI_KEY_MISSING');
      }

      const prompt = buildOrderAnalysisPrompt(sanitizeOrderData(rawData));
      const result =
        provider === 'gemini'
          ? await runGeminiModel(selectedModel, apiKey, prompt)
          : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });

      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, 'AI 分析失败');
    }
  });

  return router;
}
