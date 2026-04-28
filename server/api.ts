import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import { csrfProtection, requireAuth } from './lib/auth.js';
import { createAiRouter } from './routes/ai.js';
import { createAttachmentsRouter } from './routes/attachments.js';
import { createAuthRouter } from './routes/auth.js';
import { createCustomersRouter } from './routes/customers.js';
import { createCustomsRouter } from './routes/customs.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createFinanceRouter } from './routes/finance.js';
import { createFilesRouter } from './routes/files.js';
import { createLogisticsRouter } from './routes/logistics.js';
import { createOrdersRouter } from './routes/orders.js';
import { createPartnersRouter } from './routes/partners.js';
import { createSettingsRouter } from './routes/settings.js';
import { createUsersRouter } from './routes/users.js';
import { createAuditRouter } from './routes/audit.js';
import { createTasksRouter } from './routes/tasks.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createImportRouter } from './routes/import.js';

const router = Router();

const SERVER_START_TIME = Date.now();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    database: 'sqlite',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    timestamp: new Date().toISOString(),
    startupTime: SERVER_START_TIME,
  });
});

import { getSettingValue } from './services/settings.js';

router.use('/auth', createAuthRouter());

// Public settings endpoint for login page (site name, logo, etc.)
router.get('/settings/basic', async (_req, res) => {
  try {
    const siteName = await getSettingValue('site_name', 'SmartTrade AI CRM');
    const siteSlogan = await getSettingValue('site_slogan', '');
    const siteLogo = await getSettingValue('site_logo', '');
    const siteFavicon = await getSettingValue('site_favicon', '');
    res.json({ siteName, siteSlogan, siteLogo, siteFavicon });
  } catch (error) {
    res.json({ siteName: 'SmartTrade AI CRM', siteSlogan: '', siteLogo: '/logo.png', siteFavicon: '' });
  }
});

router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

router.use(requireAuth);
router.use(csrfProtection);
router.use('/dashboard', createDashboardRouter());
router.use('/settings', createSettingsRouter());
router.use('/audit', createAuditRouter());
router.use('/users', createUsersRouter());
router.use('/tasks', createTasksRouter());
router.use('/notifications', createNotificationsRouter());
router.use('/customers', createCustomersRouter());
router.use('/partners', createPartnersRouter());
router.use('/orders', createOrdersRouter());
router.use('/finance', createFinanceRouter());
router.use('/logistics', createLogisticsRouter());
router.use('/files', createFilesRouter());
router.use('/import', createImportRouter());
router.use('/', createCustomsRouter());
router.use('/attachments', createAttachmentsRouter());
router.use('/ai', createAiRouter());

export default router;
