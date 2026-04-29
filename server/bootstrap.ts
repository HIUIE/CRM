import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from './lib/db.js';

const LEGACY_ROOT_PASSWORD = 'root';
const PLACEHOLDER_ADMIN_PASSWORD = 'replace-with-a-temporary-root-password';

export async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  if (!initialPassword || initialPassword === PLACEHOLDER_ADMIN_PASSWORD) {
    return;
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

  const hash = await bcrypt.hash(initialPassword, 10);
  await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);
}
