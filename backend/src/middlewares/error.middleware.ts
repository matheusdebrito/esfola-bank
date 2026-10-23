import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isAppError, AppError } from "../shared/errors";
import { isProduction } from "../config/env";
import { logger } from "../config/logger";

export interface ApiErrorResponse {
  error: boolean;
  message: string;
  code?: string;
  statusCode: number;
  details?: unknown;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const message = Array.from(new Set(issues.map((issue) => issue.message))).join("; ") || "Dados inválidos";

    logger.warn({ issues }, "validation error");
    res.status(400).json({
      error: true,
      message,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: issues,
    });
    return;
  }

  const isOperational = isAppError(err) ? err.isOperational : false;
  const statusCode = isAppError(err) ? err.statusCode : 500;
  const message = isAppError(err) ? err.message : "Erro interno do servidor";
  const code = isAppError(err) ? err.code : undefined;

  const response: ApiErrorResponse = {
    error: true,
    message,
    statusCode,
  };
  if (code) response.code = code;

  // Log operacional vs erro inesperado
  const log = isOperational ? logger.warn.bind(logger) : logger.error.bind(logger);
  log(
    {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      statusCode,
      isOperational,
    },
    "request error",
  );

  // Em produção não exibe stack trace nem detalhes internos
  if (!isProduction() && err instanceof Error) {
    response.details = { stack: err.stack };
  }

  res.status(statusCode).json(response);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Rota não encontrada", 404, "ROUTE_NOT_FOUND"));
}
