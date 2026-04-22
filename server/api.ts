import { Router } from 'express';
import { db } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-preview-only';

// --- AUTH ROUTES ---
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) {
      return res.status(401).json({ error: '无效的用户名或密码' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '无效的用户名或密码' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/auth/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await db.get(`SELECT id, username, role, name FROM users WHERE id = ?`, [decoded.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: '无效的令牌' });
  }
});

// --- SETTINGS (AI GATEWAY) ---
router.get('/settings/ai', async (req, res) => {
  try {
    const modelSetting = await db.get(`SELECT value FROM settings WHERE key = 'current_ai_model'`);
    const keySetting = await db.get(`SELECT value FROM settings WHERE key = 'ai_api_key'`);
    const baseSetting = await db.get(`SELECT value FROM settings WHERE key = 'ai_base_url'`);
    
    res.json({
      model: modelSetting?.value || 'gemini',
      apiKey: keySetting?.value ? '***' : '', // Never send real key back literally, or let UI know it exists
      baseUrl: baseSetting?.value || ''
    });
  } catch (err) {
    res.status(500).json({ error: '无法读取设置' });
  }
});

router.post('/settings/ai', async (req, res) => {
  const { model, apiKey, baseUrl } = req.body;
  try {
    await db.run(`INSERT INTO settings (key, value) VALUES ('current_ai_model', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [model]);
    if (apiKey && apiKey !== '***') {
      await db.run(`INSERT INTO settings (key, value) VALUES ('ai_api_key', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [apiKey]);
    }
    await db.run(`INSERT INTO settings (key, value) VALUES ('ai_base_url', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [baseUrl]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '保存设置失败' });
  }
});

export default router;
