import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cwd = process.cwd();

/**
 * 终极自修复加载逻辑
 */
function superLoad() {
  const searchPaths = [
    path.join(projectRoot, '.env'),
    path.join(cwd, '.env'),
    path.resolve('.env')
  ];

  for (const envPath of searchPaths) {
    if (fs.existsSync(envPath)) {
      try {
        // 读取并检查是否含有 BOM 头 (常见于 Windows 拷贝过来的文件)
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        
        // 手动解析并注入，绕过可能失败的 dotenv 默认行为
        const config = dotenv.parse(content);
        for (const key in config) {
          process.env[key] = config[key];
        }
        
        console.log(`[env] 🚀 成功加载配置: ${envPath}`);
        return true;
      } catch (e) {
        console.error(`[env] ❌ 加载出错 (${envPath}):`, e);
      }
    }
  }

  // 辅助诊断：打印目录内容
  console.warn(`[env] ⚠️ 警告：在尝试的所有路径中均未找到 .env 文件。`);
  console.log(`[env] 检查路径 1 (代码根目录): ${projectRoot}`);
  try { console.log(`[env] 目录文件列表: ${fs.readdirSync(projectRoot).filter(f => !f.startsWith('node_modules')).join(', ')}`); } catch(e){}
  
  return false;
}

if (!superLoad()) {
  dotenv.config();
}
