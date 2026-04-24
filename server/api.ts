import { Router } from 'express';
import { DB_PATH } from './db.js';
import { requireAuth } from './lib/auth.js';
import { UPLOADS_DIR } from './paths.js';
import { createAiRouter } from './routes/ai.js';
import { createAttachmentsRouter } from './routes/attachments.js';
import { createAuthRouter } from './routes/auth.js';
import { createCustomersRouter } from './routes/customers.js';
import { createCustomsRouter } from './routes/customs.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createFinanceRouter } from './routes/finance.js';
import { createLogisticsRouter } from './routes/logistics.js';
import { createOrdersRouter } from './routes/orders.js';
import { createPartnersRouter } from './routes/partners.js';
import { createSettingsRouter } from './routes/settings.js';
import { createUsersRouter } from './routes/users.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    database: 'sqlite',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    dbPath: DB_PATH,
    uploadsPath: UPLOADS_DIR,
    uploadsUrl: '/uploads',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', createAuthRouter());
router.use(requireAuth);
router.use('/dashboard', createDashboardRouter());
router.use('/settings', createSettingsRouter());
router.use('/users', createUsersRouter());
router.use('/customers', createCustomersRouter());
router.use('/partners', createPartnersRouter());
router.use('/orders', createOrdersRouter());
router.use('/finance', createFinanceRouter());
router.use('/logistics', createLogisticsRouter());
router.use('/', createCustomsRouter());
router.use('/attachments', createAttachmentsRouter());
router.use('/ai', createAiRouter());

export default router;
