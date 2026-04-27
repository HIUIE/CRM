import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';
import { PROJECT_ROOT } from '../paths.js';
import { buildLegacyExportZip, getExportFileName, streamCustomerArchiveZip } from '../services/export.js';
import { buildExcelWorkbook } from '../services/excel-export.js';
import { getOrderNumberPrefix, getSettingValue, setSettingValue } from '../services/settings.js';
import { resolveAiProvider, runGeminiModel, runOpenAiCompatibleModel } from '../services/ai.js';

const BRAND_DIR = path.join(PROJECT_ROOT, 'data', 'brand');
const brandUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(BRAND_DIR, { recursive: true });
      cb(null, BRAND_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${file.fieldname}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export function createSettingsRouter() {
  const router = Router();

  router.post('/brand/upload', requireAdmin, brandUpload.single('file'), async (req, res) => {
    if (!req.file) return fail(res, 400, '请上传图片文件', 'NO_FILE');
    const fileUrl = `/brand/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  });

  router.post('/basic', requireAdmin, async (req, res) => {
    const siteName = readString(req.body?.siteName) || 'SmartTrade AI CRM';
    const siteSlogan = readString(req.body?.siteSlogan) || '专业的外贸业务管理专家';
    const siteLogo = readString(req.body?.siteLogo);
    const siteFavicon = readString(req.body?.siteFavicon);
    try {
      await setSettingValue('site_name', siteName);
      await setSettingValue('site_slogan', siteSlogan);
      if (siteLogo) await setSettingValue('site_logo', siteLogo);
      if (siteFavicon) await setSettingValue('site_favicon', siteFavicon);
      res.json({ success: true, siteName, siteSlogan });
    } catch (error) {
      return handleRouteError(res, error, '保存站点设置失败');
    }
  });

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

  router.post('/ai/test', requireAdmin, async (_req, res) => {
    try {
      const selectedModel = (await getSettingValue('current_ai_model', 'deepseek-v4-flash')).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey = (await getSettingValue('ai_api_key')) || process.env.AI_API_KEY;
      const configuredBaseUrl = await getSettingValue('ai_base_url');

      if (!apiKey && provider !== 'gemini') {
        return fail(res, 400, '未配置 API 密钥，无法测试连接', 'AI_KEY_MISSING');
      }

      const testMessage = 'Respond with only the word "ok" if you can read this.';

      if (provider === 'gemini') {
        const result = await runGeminiModel(selectedModel, apiKey || '', testMessage);
        res.json({ success: true, response: String(result).slice(0, 100) });
      } else {
        const compatBaseUrl = configuredBaseUrl || (provider === 'deepseek' ? 'https://api.deepseek.com' : '');
        const result = await runOpenAiCompatibleModel({
          model: selectedModel,
          apiKey: apiKey || '',
          baseUrl: compatBaseUrl,
          prompt: testMessage,
          jsonMode: false,
        });
        res.json({ success: true, response: String(result).slice(0, 100) });
      }
    } catch (error) {
      return fail(res, 502, `连接测试失败: ${error instanceof Error ? error.message : String(error)}`, 'AI_TEST_FAILED');
    }
  });

  router.get('/export/xlsx', requireAdmin, async (_req, res) => {
    try {
      const wb = await buildExcelWorkbook();
      const fileName = `SmartTrade_CRM_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      return handleRouteError(res, error, '导出 Excel 失败');
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
