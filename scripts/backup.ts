import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DB_PATH } from '../server/db.js';
import { UPLOADS_DIR } from '../server/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const backupRoot = process.env.BACKUP_DIR || path.join(projectRoot, 'backups');
  const outputDir = path.join(backupRoot, timestamp());
  await fs.mkdir(outputDir, { recursive: true });

  if (await exists(DB_PATH)) {
    await fs.copyFile(DB_PATH, path.join(outputDir, path.basename(DB_PATH)));
  } else {
    console.warn(`Database file not found: ${DB_PATH}`);
  }

  if (await exists(UPLOADS_DIR)) {
    await fs.cp(UPLOADS_DIR, path.join(outputDir, 'uploads'), { recursive: true });
  } else {
    await fs.mkdir(path.join(outputDir, 'uploads'), { recursive: true });
  }

  console.log(`Backup created at ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
