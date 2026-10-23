export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 404, code, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 409, code, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 401, code, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 403, code, true);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 429, code, true);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
