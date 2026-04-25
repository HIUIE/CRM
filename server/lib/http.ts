import type { Response } from 'express';

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

export function handleRouteError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return fail(res, error.status, error.message, error.code);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Route Error] ${fallbackMessage}:`, error);
  
  return fail(res, 500, `${fallbackMessage}: ${message}`, 'INTERNAL_ERROR');
}
