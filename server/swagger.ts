import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SmartTrade AI CRM API',
      version: '1.1.0',
      description: '外贸 CRM/ERP 系统后端 API',
    },
    servers: [{ url: '/api' }],
  },
  apis: ['./server/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
