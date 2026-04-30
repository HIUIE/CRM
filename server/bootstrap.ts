import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from './lib/db.js';

const LEGACY_ROOT_PASSWORD = 'root';
const PLACEHOLDER_ADMIN_PASSWORD = 'replace-with-a-temporary-root-password';

export async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

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

  if (!initialPassword || initialPassword === PLACEHOLDER_ADMIN_PASSWORD) {
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
