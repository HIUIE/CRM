import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from './lib/db.js';

const LEGACY_ROOT_PASSWORD = 'root';
const PLACEHOLDER_ADMIN_PASSWORDS = new Set([
  'replace-with-a-temporary-root-password',
  'local-admin-change-me-1234',
]);

export async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  if (initialPassword && PLACEHOLDER_ADMIN_PASSWORDS.has(initialPassword)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境检测到 INITIAL_ADMIN_PASSWORD 使用了已知占位符，请更换为强密码');
    }
    console.warn('INITIAL_ADMIN_PASSWORD 使用了开发占位符，生产环境将被拒绝');
  }

  const root = await dbGet<{ id: number; password: string | null }>(
    `SELECT id, password FROM users WHERE username = ?`,
    ['root'],
  );
  if (!root?.password) {
    return;
  }

  const stillUsingLegacyPassword = await bcrypt.compare(LEGACY_ROOT_PASSWORD, root.password);
  if (!stillUsingLegacyPassword) {
    return;
  }

  if (!initialPassword || PLACEHOLDER_ADMIN_PASSWORDS.has(initialPassword)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境检测到 root 仍使用默认密码，请设置 INITIAL_ADMIN_PASSWORD 完成初始化后再启动');
    }
    return;
  }
  if (process.env.NODE_ENV === 'production' && initialPassword.length < 12) {
    throw new Error('生产环境 INITIAL_ADMIN_PASSWORD 至少需要 12 位');
  }

  const hash = await bcrypt.hash(initialPassword, 10);
  await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);
}
