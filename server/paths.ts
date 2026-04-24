import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.join(__dirname, '..');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(PROJECT_ROOT, 'uploads');
