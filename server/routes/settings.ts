import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { normalizeBrandText, sanitizeBrandAssetUrl } from '../lib/brand.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';
import { PROJECT_ROOT } from '../paths.js';
import { buildLegacyExportZip, getExportFileName, streamCustomerArchiveZip } from '../services/export.js';
import { buildExcelWorkbook } from '../services/excel-export.js';
import { getOrderNumberPrefix, getSettingValue, setSettingValue } from '../services/settings.js';
import { resolveAiProvider, runGeminiModel, runOpenAiCompatibleModel } from '../services/ai.js';

const BRAND_DIR = path.join(PROJECT_ROOT, 'data', 'brand');
const DEFAULT_SYSTEM_UPDATE_STATUS_PATH = path.join(PROJECT_ROOT, 'data', 'system-update-status.json');
const MAX_UPDATE_HISTORY_ITEMS = 10;
type UpdatePhase = 'idle' | 'running' | 'failed' | 'completed' | 'restarting';
type UpdateStatus = {
  id: string;
  phase: UpdatePhase;
  steps: string[];
  logs: string[];
  currentStep: string;
  error: string;
  startedAt: string;
  finishedAt: string;
};
type UpdateStatusEnvelope = {
  current: UpdateStatus;
  history: UpdateStatus[];
};

type CommandRunner = (command: string, args: string[]) => Promise<string[] | void>;
type RestartScheduler = () => void;
const MAX_UPDATE_LOG_LINES = 120;

const createIdleUpdateStatus = (): UpdateStatus => ({
  id: '',
  phase: 'idle',
  steps: [],
  logs: [],
  currentStep: '',
  error: '',
  startedAt: '',
  finishedAt: '',
});

let systemUpdateStatus: UpdateStatus = createIdleUpdateStatus();
let systemUpdateHistory: UpdateStatus[] = [];
let commandRunner: CommandRunner = runCommand;
let restartScheduler: RestartScheduler = scheduleRestart;
let systemUpdateStatusPath = DEFAULT_SYSTEM_UPDATE_STATUS_PATH;
let systemUpdateStatusLoaded = false;

export function setSystemUpdateInProgressForTest(value: boolean) {
  systemUpdateStatus = value
    ? {
        phase: 'running',
        steps: ['系统更新正在进行中'],
        logs: [],
        currentStep: '系统更新正在进行中',
        error: '',
        startedAt: new Date().toISOString(),
        finishedAt: '',
        id: 'test-update',
      }
    : createIdleUpdateStatus();
  systemUpdateHistory = [];
  systemUpdateStatusLoaded = true;
}

export function setSystemUpdateCommandRunnerForTest(runner: CommandRunner | null) {
  commandRunner = runner ?? runCommand;
}

export function setSystemUpdateRestartSchedulerForTest(scheduler: RestartScheduler | null) {
  restartScheduler = scheduler ?? scheduleRestart;
}

export function setSystemUpdateStatusFilePathForTest(filePath: string | null) {
  systemUpdateStatusPath = filePath ?? DEFAULT_SYSTEM_UPDATE_STATUS_PATH;
  systemUpdateStatusLoaded = false;
  systemUpdateStatus = createIdleUpdateStatus();
  systemUpdateHistory = [];
}

function isSystemUpdateRunning() {
  return systemUpdateStatus.phase === 'running' || systemUpdateStatus.phase === 'restarting';
}

async function persistSystemUpdateStatus() {
  await fs.mkdir(path.dirname(systemUpdateStatusPath), { recursive: true });
  const envelope: UpdateStatusEnvelope = {
    current: systemUpdateStatus,
    history: systemUpdateHistory,
  };
  await fs.writeFile(systemUpdateStatusPath, JSON.stringify(envelope, null, 2), 'utf8');
}

function appendUpdateLog(lines: string[]) {
  if (!lines.length) return;
  systemUpdateStatus.logs.push(...lines);
  if (systemUpdateStatus.logs.length > MAX_UPDATE_LOG_LINES) {
    systemUpdateStatus.logs = systemUpdateStatus.logs.slice(-MAX_UPDATE_LOG_LINES);
  }
}

function normalizeLoadedUpdateStatus(status: UpdateStatus): UpdateStatus {
  const normalizedLogs = Array.isArray(status.logs) ? status.logs : [];
  if (status.phase === 'restarting') {
    return {
      ...status,
      logs: normalizedLogs,
      phase: 'completed',
      currentStep: '上次更新已完成，服务已重新启动',
      steps: [...status.steps, '上次更新已完成，服务已重新启动'],
    };
  }
  if (status.phase === 'running') {
    return {
      ...status,
      logs: normalizedLogs,
      phase: 'failed',
      error: status.error || '更新任务在服务重启前中断，请重新发起',
      finishedAt: status.finishedAt || new Date().toISOString(),
      currentStep: '检测到未完成的更新任务，请重新发起',
      steps: [...status.steps, '检测到未完成的更新任务，请重新发起'],
    };
  }
  return { ...status, logs: normalizedLogs };
}

function archiveUpdateStatus(status: UpdateStatus) {
  if (!status.id || status.phase === 'idle') return;
  const archived = normalizeLoadedUpdateStatus(status);
  systemUpdateHistory = [
    archived,
    ...systemUpdateHistory.filter((entry) => entry.id !== archived.id),
  ].slice(0, MAX_UPDATE_HISTORY_ITEMS);
}

function normalizeLoadedEnvelope(data: unknown): UpdateStatusEnvelope {
  if (data && typeof data === 'object' && 'current' in data) {
    const envelope = data as Partial<UpdateStatusEnvelope>;
    const current = normalizeLoadedUpdateStatus((envelope.current as UpdateStatus) ?? createIdleUpdateStatus());
    const history = Array.isArray(envelope.history)
      ? envelope.history.map((entry) => normalizeLoadedUpdateStatus(entry as UpdateStatus))
      : [];
    return { current, history };
  }

  const legacyStatus = normalizeLoadedUpdateStatus((data as UpdateStatus) ?? createIdleUpdateStatus());
  return {
    current: legacyStatus,
    history: legacyStatus.id && legacyStatus.phase !== 'idle' ? [legacyStatus] : [],
  };
}

async function ensureSystemUpdateStatusLoaded() {
  if (systemUpdateStatusLoaded) return;
  systemUpdateStatusLoaded = true;
  try {
    const raw = await fs.readFile(systemUpdateStatusPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const envelope = normalizeLoadedEnvelope(parsed);
    systemUpdateStatus = envelope.current;
    systemUpdateHistory = envelope.history;
  } catch {
    systemUpdateStatus = createIdleUpdateStatus();
    systemUpdateHistory = [];
  }
}

async function pushUpdateStep(step: string) {
  systemUpdateStatus.steps.push(step);
  systemUpdateStatus.currentStep = step;
  await persistSystemUpdateStatus();
}

function scheduleRestart() {
  setTimeout(() => process.exit(0), 1000);
}

function runCommand(command: string, args: string[]) {
  return new Promise<string[]>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(compactCommandOutput(stdout, stderr));
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function compactCommandOutput(stdout: string, stderr: string) {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-20);
}

async function runSystemUpdateJob() {
  systemUpdateStatus = {
    id: `update-${Date.now()}`,
    phase: 'running',
    steps: [],
    logs: [],
    currentStep: '准备开始系统更新',
    error: '',
    startedAt: new Date().toISOString(),
    finishedAt: '',
  };
  await persistSystemUpdateStatus();

  const commands: Array<{ step: string; command: string; args: string[] }> = [
    { step: '正在拉取最新代码...', command: 'git', args: ['pull', 'origin', 'main'] },
    { step: '正在安装依赖...', command: 'npm', args: ['install'] },
    { step: '正在构建前端...', command: 'npm', args: ['run', 'build'] },
  ];

  try {
    for (const item of commands) {
      await pushUpdateStep(item.step);
      appendUpdateLog([`$ ${item.command} ${item.args.join(' ')}`]);
      await persistSystemUpdateStatus();
      const output = await commandRunner(item.command, item.args);
      appendUpdateLog(Array.isArray(output) ? output : []);
      await persistSystemUpdateStatus();
    }

    await pushUpdateStep('更新完成，正在重启服务...');
    systemUpdateStatus.phase = 'restarting';
    systemUpdateStatus.finishedAt = new Date().toISOString();
    archiveUpdateStatus(systemUpdateStatus);
    await persistSystemUpdateStatus();
    restartScheduler();
  } catch (error) {
    systemUpdateStatus.phase = 'failed';
    systemUpdateStatus.error = error instanceof Error ? error.message : String(error);
    systemUpdateStatus.finishedAt = new Date().toISOString();
    appendUpdateLog([`ERROR: ${systemUpdateStatus.error}`]);
    await pushUpdateStep('更新失败，请查看错误信息');
    archiveUpdateStatus(systemUpdateStatus);
  }
}

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
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
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
    const siteName = normalizeBrandText(readString(req.body?.siteName), 'SmartTrade AI CRM');
    const siteSlogan = normalizeBrandText(readString(req.body?.siteSlogan), '专业的外贸业务管理专家', 160);
    const siteLogo = sanitizeBrandAssetUrl(readString(req.body?.siteLogo), '/logo.png');
    const siteFavicon = sanitizeBrandAssetUrl(readString(req.body?.siteFavicon), '');
    try {
      await setSettingValue('site_name', siteName);
      await setSettingValue('site_slogan', siteSlogan);
      await setSettingValue('site_logo', siteLogo);
      await setSettingValue('site_favicon', siteFavicon);
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

  router.get('/webhook', async (_req, res) => {
    const url = await getSettingValue('webhook_url', '');
    res.json({ webhookUrl: url });
  });

  router.post('/webhook', requireAdmin, async (req, res) => {
    const url = readString(req.body?.webhookUrl);
    try {
      await setSettingValue('webhook_url', url);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '保存失败');
    }
  });

  router.get('/check-update', async (_req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN || '';
      const url = 'https://api.github.com/repos/HIUIE/CRM/commits?per_page=1';
      const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const ghRes = await fetch(url, { headers });
      if (!ghRes.ok) return res.json({ error: `GitHub API: ${ghRes.status}` });
      const data = await ghRes.json();
      if (Array.isArray(data) && data[0]?.sha) {
        res.json({ version: data[0].sha.slice(0, 7), buildTime: data[0].commit?.author?.date || '', commit: data[0].sha.slice(0, 7) });
      } else {
        res.json({ error: '无法解析版本信息' });
      }
    } catch (error) {
      return handleRouteError(res, error, '检查更新失败');
    }
  });

  router.get('/system/update/status', requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    res.json(systemUpdateStatus);
  });

  router.get('/system/update/history', requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    res.json(systemUpdateHistory);
  });

  router.post('/system/update', requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    if (isSystemUpdateRunning()) {
      return fail(res, 409, '系统更新正在进行中，请稍后再试', 'SYSTEM_UPDATE_IN_PROGRESS');
    }

    try {
      void runSystemUpdateJob();
      res.status(202).json({
        success: true,
        message: '系统更新任务已启动，请稍候查看进度',
        status: 'running',
      });
    } catch (error) {
      return handleRouteError(res, error, '系统更新失败');
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
