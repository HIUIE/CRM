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
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none'
    });
    res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { secure: true, sameSite: 'none' });
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

// Middleware to check if user is logged in for protected routes
const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: '无访问权限' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: '令牌失效' });
  }
};

// --- CRM (CUSTOMERS) ROUTES ---
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const customers = await db.all(`SELECT * FROM customers ORDER BY created_at DESC`);
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '读取客户数据失败' });
  }
});

router.post('/customers', requireAuth, async (req: any, res) => {
  const { name, country, contact, logisticsPreference = '', paymentTerms = '' } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, country, contact, logisticsPreference, paymentTerms, req.user.id]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err: any) {
    console.error('Insert Customer Error:', err);
    res.status(500).json({ error: err.message || '创建客户失败' });
  }
});

router.delete('/customers/:id', requireAuth, async (req, res) => {
  try {
    await db.run(`DELETE FROM customers WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

// --- ORDERS ROUTES ---
router.get('/orders', requireAuth, async (req, res) => {
  try {
    // Join with customers to get the customer name
    const orders = await db.all(`
      SELECT o.*, c.name as customer_name, c.country as customer_country
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '读取订单数据失败' });
  }
});

router.post('/orders', requireAuth, async (req: any, res) => {
  const { customerId, details, totalAmount = 0 } = req.body;
  try {
    // Generate a simple Display ID
    const countQuery = await db.get(`SELECT COUNT(*) as c FROM orders`);
    const nextNum = (countQuery.c || 0) + 1;
    const displayId = `ORD-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    const result = await db.run(
      `INSERT INTO orders (display_id, customer_id, status, details, total_amount, created_by) VALUES (?, ?, 'draft', ?, ?, ?)`,
      [displayId, customerId, details, totalAmount, req.user.id]
    );
    res.status(201).json({ id: result.lastID, display_id: displayId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建订单失败' });
  }
});

router.patch('/orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    await db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新订单状态失败' });
  }
});

// --- FINANCE ROUTES ---
router.get('/finance', requireAuth, async (req, res) => {
  try {
    const records = await db.all(`
      SELECT f.*, o.display_id as order_display_id, c.name as customer_name
      FROM finance_records f
      LEFT JOIN orders o ON f.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY f.created_at DESC
    `);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: '读取财务数据失败' });
  }
});

router.post('/finance', requireAuth, async (req, res) => {
  const { orderId, type, amount, target, status, remark } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO finance_records (order_id, type, amount, target, status, remark) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, type, amount, target, status, remark]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: '保存财务数据失败' });
  }
});

router.delete('/finance/:id', requireAuth, async (req, res) => {
  try {
    await db.run(`DELETE FROM finance_records WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

// --- LOGISTICS ROUTES ---
router.get('/logistics', requireAuth, async (req, res) => {
  try {
    const records = await db.all(`
      SELECT l.*, o.display_id as order_display_id, o.status as order_status, c.name as customer_name
      FROM logistics_records l
      LEFT JOIN orders o ON l.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY l.created_at DESC
    `);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: '读取物流数据失败' });
  }
});

router.post('/logistics', requireAuth, async (req, res) => {
  const { orderId, trackingNo, carrier, packingDetails, status } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO logistics_records (order_id, tracking_no, carrier, packing_details, status) VALUES (?, ?, ?, ?, ?)`,
      [orderId, trackingNo, carrier, packingDetails, status]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: '保存物流数据失败' });
  }
});

router.patch('/logistics/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    await db.run(`UPDATE logistics_records SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新物流状态失败' });
  }
});

import { GoogleGenAI } from '@google/genai';

// --- AI INTELLIGENCE ROUTES ---
router.post('/ai/parse-order', requireAuth, async (req, res) => {
  const { text } = req.body;
  
  if (!text) return res.status(400).json({ error: '请提供需要解析的文本' });

  try {
    const keySetting = await db.get(`SELECT value FROM settings WHERE key = 'ai_api_key'`);
    const apiKey = keySetting?.value || process.env.GEMINI_API_KEY;

    if (!apiKey) {
       return res.status(500).json({ error: '请先在系统设置中配置 Gemini API Key' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `你是一个资深外贸业务助理。请从下面这段杂乱的客户消息/邮件中提取关键订单信息。
请以严格的 JSON 格式返回，包含以下字段，并且只能返回 JSON，不要返回 markdown 代码块，也不要返回多余文本：
{
  "customerName": "提取的客户或公司名，如果没有提取到则填 暂无",
  "country": "提取的国家，如果没有填 暂无",
  "logistics": "提取的物流要求，如果没有填无",
  "payment": "付款方式，如 '30%定金'",
  "totalAmount": 提取的总金额的数字(只要数字)，如果没提到写 0,
  "details": "合并关于商品规格、包装、要求等的详细摘要",
  "suggestedReply": "拟写一段简短专业得体的回复客户的邮件（英文）可以用于快速确认订单"
}
需要解析的内容如下：
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });

    let rawText = response.text || '';
    if (rawText.startsWith('\`\`\`json')) {
      rawText = rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    }
    const result = JSON.parse(rawText);

    res.json(result);
  } catch (err: any) {
    console.error('AI Parsing Error:', err);
    res.status(500).json({ error: 'AI 解析失败: ' + err.message });
  }
});

export default router;
