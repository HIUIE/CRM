import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from './lib/db.js';
import { logger } from './lib/logger.js';

const LEGACY_PASSWORDS = new Set([
  'root',
  'SmartTrade@2026'
]);

const PLACEHOLDER_ADMIN_PASSWORDS = new Set([
  'replace-with-a-temporary-root-password',
  'local-admin-change-me-1234',
]);

export async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  
  const root = await dbGet<{ id: number; password: string | null }>(
    `SELECT id, password FROM users WHERE username = ?`,
    ['root'],
  );
  if (!root?.password) return;

  // 检查当前密码是否为任何已知的“默认值”
  let isDefault = false;
  for (const pwd of LEGACY_PASSWORDS) {
    if (await bcrypt.compare(pwd, root.password)) {
      isDefault = true;
      break;
    }
  }

  // 如果已经是自定义密码，则跳过初始化，保护安全性
  if (!isDefault) return;

  // 如果 .env 中没有设置新密码，或者设置的是占位符，则不执行覆盖
  if (!initialPassword || PLACEHOLDER_ADMIN_PASSWORDS.has(initialPassword)) {
    return;
  }

  // 安全校验：生产环境至少 8 位
  if (process.env.NODE_ENV === 'production' && initialPassword.length < 8) {
    logger.warn('INITIAL_ADMIN_PASSWORD 过短，已跳过初始化。请设置至少 8 位密码。');
    return;
  }

  const hash = await bcrypt.hash(initialPassword, 10);
  await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);
  logger.info('检测到默认密码，已根据 .env 自动初始化 root 账号。');
}
