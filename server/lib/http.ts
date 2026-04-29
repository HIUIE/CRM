import type { Request, Response } from 'express';
import { logger } from './logger.js';

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function fail(res: Response, status: number, message: string, code = 'REQUEST_FAILED') {
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

export function handleRouteError(res: Response, error: unknown, fallbackMessage: string, req?: Request) {
  if (error instanceof AppError) {
    return fail(res, error.status, error.message, error.code);
  }

  const message = error instanceof Error ? error.message : String(error);
  const logMeta = {
    method: req?.method,
    path: req?.originalUrl,
    userId: (req as any)?.user?.id,
    err: error,
  };
  logger.error(logMeta, `[Route Error] ${fallbackMessage}`);

  // 生产环境仅返回通用错误信息，避免泄露内部细节（SQL、文件路径等）
  const clientMessage = process.env.NODE_ENV === 'production'
    ? fallbackMessage
    : `${fallbackMessage}: ${message}`;
  return fail(res, 500, clientMessage, 'INTERNAL_ERROR');
}
