import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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

function generateStrongPassword(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  const root = await dbGet<{ id: number; password: string | null }>(
    `SELECT id, password FROM users WHERE username = ?`,
    ['root'],
  );

  // root 用户不存在——数据库异常，静默退出让初始化流程继续
  if (!root) return;

  // ==================== 场景 A：密码为空 (NULL) ====================
  // 此场景发生在：
  //   - 全新安装（迁移文件不再硬编码密码）
  //   - 数据库手动重置
  // bootstrap 必须设置一个密码，否则任何人都可以无密码登录。
  if (!root.password) {
    // 生产环境：必须通过环境变量设置
    if (process.env.NODE_ENV === 'production') {
      if (!initialPassword || PLACEHOLDER_ADMIN_PASSWORDS.has(initialPassword)) {
        logger.error(
          '生产环境检测到 root 密码为空！' +
          '请在 .env 中设置 INITIAL_ADMIN_PASSWORD 为至少 8 位的强密码。'
        );
        throw new Error(
          'FATAL: root password is NULL. Set INITIAL_ADMIN_PASSWORD in .env'
        );
      }
      if (initialPassword.length < 8) {
        throw new Error('FATAL: INITIAL_ADMIN_PASSWORD must be at least 8 characters');
      }
    }

    // 开发环境：未设置则自动生成本地密码
    const newPassword = initialPassword || generateStrongPassword();
    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);

    if (initialPassword) {
      logger.info('root 密码已从 INITIAL_ADMIN_PASSWORD 初始化。');
    } else {
      logger.warn(`root 密码为空，已自动生成：${newPassword}。请立即登录并修改密码！`);
    }
    return;
  }

  // ==================== 场景 B：密码已知为弱密码 ====================
  let isWeak = false;
  for (const pwd of LEGACY_PASSWORDS) {
    if (await bcrypt.compare(pwd, root.password)) {
      isWeak = true;
      break;
    }
  }
  if (!isWeak) return; // 已经是自定义密码，跳过

  // .env 中没有新密码或为占位符——跳过不覆盖
  if (!initialPassword || PLACEHOLDER_ADMIN_PASSWORDS.has(initialPassword)) {
    logger.warn(
      '检测到 root 仍使用默认弱密码，但 .env 中未设置 INITIAL_ADMIN_PASSWORD。' +
      '请登录后立即修改密码！'
    );
    return;
  }

  if (process.env.NODE_ENV === 'production' && initialPassword.length < 8) {
    logger.warn('INITIAL_ADMIN_PASSWORD 过短（< 8 位），已跳过初始化。');
    return;
  }

  const hash = await bcrypt.hash(initialPassword, 10);
  await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);
  logger.info('检测到默认弱密码，已根据 INITIAL_ADMIN_PASSWORD 自动更新。');
}
