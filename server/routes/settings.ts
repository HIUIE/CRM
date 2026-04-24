import { Router } from 'express';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';
import { buildLegacyExportZip, getExportFileName, streamCustomerArchiveZip } from '../services/export.js';
import { getOrderNumberPrefix, getSettingValue, setSettingValue } from '../services/settings.js';

export function createSettingsRouter() {
  const router = Router();

  router.get('/ai', requireAuth, async (_req, res) => {
    try {
      const model = await getSettingValue('current_ai_model', 'gemini-2.5-flash');
      const apiKey = await getSettingValue('ai_api_key');
      const baseUrl = await getSettingValue('ai_base_url');

      res.json({
        model,
        apiKey: apiKey ? '***' : '',
        hasApiKey: Boolean(apiKey || process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY),
        baseUrl,
      });
    } catch (error) {
      return handleRouteError(res, error, '无法读取设置');
    }
  });

  router.post('/ai', requireAdmin, async (req, res) => {
    const model = readString(req.body?.model) || 'gemini-2.5-flash';
    const apiKey = readString(req.body?.apiKey);
    const baseUrl = readString(req.body?.baseUrl);

    try {
      await setSettingValue('current_ai_model', model);
      if (apiKey && apiKey !== '***') {
        await setSettingValue('ai_api_key', apiKey);
      }
      await setSettingValue('ai_base_url', baseUrl);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '保存设置失败');
    }
  });

  router.get('/document', requireAdmin, async (_req, res) => {
    try {
      const prefix = await getOrderNumberPrefix();
      res.json({ orderNumberPrefix: prefix });
    } catch (error) {
      return handleRouteError(res, error, '读取单据编码规则失败');
    }
  });

  router.post('/document', requireAdmin, async (req, res) => {
    const prefix = readString(req.body?.orderNumberPrefix) || 'ORD-';
    try {
      await setSettingValue('order_number_prefix', prefix);
      res.json({ success: true, orderNumberPrefix: prefix });
    } catch (error) {
      return handleRouteError(res, error, '保存单据编码规则失败');
    }
  });

  router.get('/export', requireAdmin, async (req, res) => {
    const format = readString(req.query.format) || 'customer-archive';
    if (!['customer-archive', 'zip-csv'].includes(format)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EXPORT_FORMAT',
          message: '仅支持 customer-archive 或 zip-csv 导出格式',
        },
      });
    }

    try {
      const fileName = getExportFileName(format as 'customer-archive' | 'zip-csv');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      if (format === 'zip-csv') {
        const zipBuffer = await buildLegacyExportZip();
        res.setHeader('Content-Length', String(zipBuffer.length));
        res.end(zipBuffer);
        return;
      }

      await streamCustomerArchiveZip(res);
    } catch (error) {
      return handleRouteError(res, error, '导出数据失败');
    }
  });

  return router;
}
