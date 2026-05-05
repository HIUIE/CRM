import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 递归查找 .env 文件的位置 (最多向上查找 3 层)
function findAndLoadEnv() {
  let currentDir = projectRoot;
  for (let i = 0; i < 3; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      // 在生产环境中不打印密钥，仅打印路径
      console.log(`[env] 成功从绝对路径加载配置: ${envPath}`);
      return true;
    }
    currentDir = path.dirname(currentDir);
  }
  return false;
}

if (!findAndLoadEnv()) {
  // 最后回退到默认加载
  dotenv.config();
}
