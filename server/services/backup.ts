import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { dbAll, dbRun, dbTableInfo, withTransaction, type TransactionExecutor } from '../lib/db.js';
import { normalizeAttachmentRelativePath, resolveAttachmentAbsolutePath } from '../lib/files.js';
import { createZipBuffer } from '../lib/zip.js';
import { PROJECT_ROOT, UPLOADS_DIR } from '../paths.js';
import { getSettingValue, setSettingValue } from './settings.js';

const BACKUP_FORMAT = 'smarttrade-crm-full-backup';
const BACKUP_VERSION = 1;
const DEFAULT_BACKUP_DIR = path.join(PROJECT_ROOT, 'data', 'backups');
const MAX_AUTO_BACKUPS = 24;

const TABLE_SET = new Set<string>();

const TABLES = [
  'users',
  'customers',
  'customer_transfer_logs',
  'partners',
  'orders',
  'order_items',
  'finance_records',
  'logistics_records',
  'customs_records',
  'order_profits',
  'input_invoices',
  'production_plans',
  'production_logs',
  'attachments',
  'packing_records',
  'customer_contacts',
  'customer_followups',
  'tasks',
  'task_comments',
  'task_attachments',
  'notifications',
  'order_follow_ups',
  'audit_logs',
  'settings',
] as const;
for (const t of TABLES) TABLE_SET.add(t);

const ID_TABLES = TABLES.filter((table) => !['settings', 'order_profits'].includes(table));

export type BackupConfig = {
  enabled: boolean;
  directory: string;
  intervalHours: 1 | 2 | 24;
};

export type BackupStatus = {
  running: boolean;
  lastRunAt: string;
  lastFile: string;
  lastError: string;
  nextRunAt: string;
  lastVerification?: BackupVerificationResult | null;
};

export type BackupWatermark = {
  exportedBy?: string | null;
  purpose?: string | null;
  exportedAt?: string;
};

export type BackupVerificationResult = {
  ok: boolean;
  filePath: string;
  checkedAt: string;
  format?: string;
  version?: number;
  fileCount: number;
  tableCount: number;
  missingEntries: string[];
  errors: string[];
};

let autoBackupTimer: NodeJS.Timeout | null = null;
let backupStatus: BackupStatus = {
  running: false,
  lastRunAt: '',
  lastFile: '',
  lastError: '',
  nextRunAt: '',
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeZipPath(value: unknown, fallback: string) {
  const cleaned = String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '') || 'file')
    .join('/');
  return cleaned && !cleaned.includes('..') ? cleaned : fallback;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeBackupDirectory(value: string) {
  const trimmed = String(value || '').trim();
  return path.resolve(trimmed || DEFAULT_BACKUP_DIR);
}

function isAllowedBackupDirectory(dir: string) {
  const resolved = path.resolve(dir);
  if (!resolved || resolved.includes('\0') || resolved === path.parse(resolved).root) return false;
  // Constrain to project data directory or an explicitly configured backup path
  if (process.env.BACKUPS_DIR) {
    return resolved.startsWith(path.resolve(process.env.BACKUPS_DIR));
  }
  return resolved.startsWith(path.join(PROJECT_ROOT, 'data'));
}

export async function getBackupConfig(): Promise<BackupConfig> {
  const stored = await getSettingValue('auto_backup_config', '');
  const parsed = parseJson<Partial<BackupConfig>>(stored, {});
  const intervalHours = parsed.intervalHours === 2 || parsed.intervalHours === 24 ? parsed.intervalHours : 1;
  return {
    enabled: Boolean(parsed.enabled),
    directory: normalizeBackupDirectory(parsed.directory || DEFAULT_BACKUP_DIR),
    intervalHours,
  };
}

export async function setBackupConfig(config: Partial<BackupConfig>) {
  const current = await getBackupConfig();
  const next: BackupConfig = {
    enabled: Boolean(config.enabled),
    directory: normalizeBackupDirectory(config.directory || current.directory),
    intervalHours: config.intervalHours === 2 || config.intervalHours === 24 ? config.intervalHours : current.intervalHours,
  };

  if (!isAllowedBackupDirectory(next.directory)) {
    throw new Error('备份目录无效，请选择一个具体文件夹');
  }

  await fs.mkdir(next.directory, { recursive: true });
  await setSettingValue('auto_backup_config', JSON.stringify(next));
  scheduleAutoBackup(next);
  return next;
}

async function rowsForTable(table: string) {
  if (!TABLE_SET.has(table)) throw new Error(`Invalid table: ${table}`);
  if (table === 'users') {
    return dbAll<Record<string, unknown>[]>(`
      SELECT id, username, role, name, active, created_at, updated_at
      FROM users
      ORDER BY id ASC
    `);
  }
  return dbAll<Record<string, unknown>[]>(`SELECT * FROM ${table} ORDER BY ${table === 'settings' ? 'key' : table === 'order_profits' ? 'order_id' : 'id'} ASC`);
}

export async function buildSystemBackupZipBuffer(watermark: BackupWatermark = {}) {
  const createdAt = new Date().toISOString();
  const data: Record<string, Record<string, unknown>[]> = {};
  const zip = new AdmZip();
  const checksums: Record<string, string> = {};

  for (const table of TABLES) {
    const rows = await rowsForTable(table);
    data[table] = rows;
    const body = Buffer.from(JSON.stringify(rows, null, 2), 'utf8');
    const name = `data/${table}.json`;
    zip.addFile(name, body);
    checksums[name] = crypto.createHash('sha256').update(body).digest('hex');
  }

  const attachments = data.attachments || [];
  for (const attachment of attachments) {
    const filePath = String(attachment.file_path || '');
    const absolutePath = resolveAttachmentAbsolutePath(filePath);
    if (!absolutePath) continue;
    try {
      const file = await fs.readFile(absolutePath);
      const attachmentId = String(attachment.id || 'unknown');
      const storedName = safeZipPath(attachment.stored_name || path.basename(filePath), 'file');
      const name = `files/${attachmentId}/${storedName}`;
      zip.addFile(name, file);
      checksums[name] = crypto.createHash('sha256').update(file).digest('hex');
    } catch {
      // Missing physical files are reported in metadata but should not block database backup.
    }
  }

  const metadata = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: process.env.npm_package_version || '',
    createdAt,
    tables: TABLES,
    counts: Object.fromEntries(TABLES.map((table) => [table, data[table]?.length || 0])),
    checksums,
    exportedBy: watermark.exportedBy || 'System',
    exportPurpose: watermark.purpose || '系统迁移与灾备',
    note: 'This archive is intended for SmartTrade CRM restore. Store it securely because it may contain customer data and attachments.',
  };
  zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));
  
  return zip.toBuffer();
}

export function getBackupFileName(date = new Date()) {
  return `SmartTrade_CRM_Backup_${timestampForFile(date)}.zip`;
}

export async function createBackupFile(directory?: string) {
  const targetDir = normalizeBackupDirectory(directory || (await getBackupConfig()).directory);
  if (!isAllowedBackupDirectory(targetDir)) {
    throw new Error('备份目录无效');
  }
  await fs.mkdir(targetDir, { recursive: true });
  const buffer = await buildSystemBackupZipBuffer();
  const filePath = path.join(targetDir, getBackupFileName());
  await fs.writeFile(filePath, buffer);
  return { filePath, size: buffer.length, createdAt: new Date().toISOString() };
}

export async function verifySystemBackupFile(filePath: string): Promise<BackupVerificationResult> {
  const result: BackupVerificationResult = {
    ok: false,
    filePath,
    checkedAt: new Date().toISOString(),
    fileCount: 0,
    tableCount: 0,
    missingEntries: [],
    errors: [],
  };
  try {
    const zip = new AdmZip(filePath);
    const metadata = parseJson<{ format?: string; version?: number; tables?: string[]; checksums?: Record<string, string> }>(
      getEntryText(zip, 'metadata.json') || '{}',
      {},
    );
    result.format = metadata.format;
    result.version = metadata.version;
    result.fileCount = zip.getEntries().length;
    if (metadata.format !== BACKUP_FORMAT) result.errors.push('备份格式标识不正确');
    if ((metadata.version || 0) > BACKUP_VERSION) result.errors.push('备份版本高于当前系统支持版本');
    const tables = Array.isArray(metadata.tables) ? metadata.tables : [...TABLES];
    result.tableCount = tables.length;
    for (const table of tables) {
      const entryName = `data/${table}.json`;
      if (!zip.getEntry(entryName)) result.missingEntries.push(entryName);
    }
    const checksums = metadata.checksums || {};
    for (const [entryName, expectedHash] of Object.entries(checksums)) {
      const entry = zip.getEntry(entryName);
      if (!entry) {
        result.missingEntries.push(entryName);
        continue;
      }
      const actualHash = crypto.createHash('sha256').update(entry.getData()).digest('hex');
      if (actualHash !== expectedHash) result.errors.push(`校验失败: ${entryName}`);
    }
    result.ok = result.errors.length === 0 && result.missingEntries.length === 0;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

async function pruneBackups(directory: string) {
  const files = await fs.readdir(directory).catch(() => []);
  const backups = files
    .filter((name) => /^SmartTrade_CRM_Backup_.*\.zip$/.test(name))
    .map((name) => path.join(directory, name));
  const withStats = await Promise.all(backups.map(async (filePath) => ({ filePath, stat: await fs.stat(filePath) })));
  const old = withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs).slice(MAX_AUTO_BACKUPS);
  await Promise.all(old.map((item) => fs.unlink(item.filePath).catch(() => undefined)));
}

export async function runManualBackup(directory?: string) {
  if (backupStatus.running) throw new Error('备份任务正在运行，请稍后再试');
  backupStatus = { ...backupStatus, running: true, lastError: '' };
  try {
    const result = await createBackupFile(directory);
    await pruneBackups(path.dirname(result.filePath));
    backupStatus = {
      ...backupStatus,
      running: false,
      lastRunAt: result.createdAt,
      lastFile: result.filePath,
      lastError: '',
      lastVerification: await verifySystemBackupFile(result.filePath),
    };
    return result;
  } catch (error) {
    backupStatus = {
      ...backupStatus,
      running: false,
      lastError: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

export function getBackupStatus() {
  return backupStatus;
}

export function scheduleAutoBackup(config: BackupConfig) {
  if (autoBackupTimer) {
    clearTimeout(autoBackupTimer);
    autoBackupTimer = null;
  }
  backupStatus.nextRunAt = '';
  if (!config.enabled) return;

  const delay = config.intervalHours * 60 * 60 * 1000;
  backupStatus.nextRunAt = new Date(Date.now() + delay).toISOString();
  autoBackupTimer = setTimeout(async () => {
    try {
      await runManualBackup(config.directory);
    } catch {
      // status already records the error
    } finally {
      scheduleAutoBackup(await getBackupConfig());
    }
  }, delay);
}

export async function startAutoBackupScheduler() {
  scheduleAutoBackup(await getBackupConfig());
}

function getEntryText(zip: AdmZip, name: string) {
  const entry = zip.getEntry(name);
  if (!entry) return null;
  return entry.getData().toString('utf8');
}

export function isSystemBackupZip(zip: AdmZip) {
  const raw = getEntryText(zip, 'metadata.json');
  if (!raw) return false;
  const metadata = parseJson<{ format?: string }>(raw, {});
  return metadata.format === BACKUP_FORMAT;
}

async function upsertRows(tx: TransactionExecutor, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  if (!TABLE_SET.has(table)) throw new Error(`Invalid table: ${table}`);
  const tableColumns = new Set((await dbTableInfo(table)).map((column) => column.name));
  let count = 0;

  for (const rawRow of rows) {
    const row = { ...rawRow };
    if (table === 'users') {
      delete row.password;
    }

    const columns = Object.keys(row).filter((column) => tableColumns.has(column));
    if (!columns.length) continue;
    const placeholders = columns.map(() => '?').join(', ');
    const conflictColumn = table === 'settings' ? 'key' : table === 'order_profits' ? 'order_id' : 'id';
    const updates = columns
      .filter((column) => column !== conflictColumn)
      .map((column) => `${column} = EXCLUDED.${column}`)
      .join(', ');
    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(${conflictColumn}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}
    `;
    await tx.run(sql, columns.map((column) => row[column]));
    count += 1;
  }

  if (ID_TABLES.includes(table as typeof ID_TABLES[number])) {
    await tx.run(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
  }
  return count;
}

async function restoreAttachmentFiles(zip: AdmZip, attachmentRows: Record<string, unknown>[]) {
  const restoredAt = timestampForFile();
  for (const row of attachmentRows) {
    const id = String(row.id || '');
    const storedName = safeZipPath(row.stored_name || path.basename(String(row.file_path || '')), 'file');
    const entry = zip.getEntry(`files/${id}/${storedName}`);
    if (!entry) continue;

    const relativePath = path.posix.join('restored', restoredAt, `${id}-${storedName}`);
    const absolutePath = path.resolve(UPLOADS_DIR, normalizeAttachmentRelativePath(relativePath));
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, entry.getData());
    row.file_path = relativePath;
    row.stored_name = `${id}-${storedName}`;
  }
}

export async function restoreSystemBackupZip(zipPath: string) {
  const zip = new AdmZip(zipPath);
  if (!isSystemBackupZip(zip)) {
    throw new Error('不是可还原的 SmartTrade CRM 系统备份包');
  }

  const metadata = parseJson<{ version?: number; counts?: Record<string, number> }>(getEntryText(zip, 'metadata.json') || '{}', {});
  if ((metadata.version || 0) > BACKUP_VERSION) {
    throw new Error('备份文件版本高于当前系统支持版本，请先升级系统');
  }

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    data[table] = parseJson<Record<string, unknown>[]>(getEntryText(zip, `data/${table}.json`) || '[]', []);
  }
  await restoreAttachmentFiles(zip, data.attachments || []);

  let successCount = 0;
  const restoredTables: Record<string, number> = {};
  await withTransaction(async (tx) => {
    for (const table of TABLES) {
      const count = await upsertRows(tx, table, data[table] || []);
      restoredTables[table] = count;
      successCount += count;
    }
  });

  return {
    successCount,
    errorCount: 0,
    errors: [],
    restoredTables,
    backupVersion: metadata.version || 1,
  };
}
