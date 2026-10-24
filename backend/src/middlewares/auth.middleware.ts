import { Request, Response, NextFunction } from "express";
import { jwtService } from "../modules/auth/jwt.service";
import { UnauthorizedError } from "../shared/errors";
import { prisma } from "../config/prisma";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;
  if (!token) {
    return next(new UnauthorizedError("Token de acesso não fornecido", "TOKEN_MISSING"));
  }

  let payload: any;
  try {
    payload = jwtService.verifyAccess(token);
  } catch {
    return next(new UnauthorizedError("Token de acesso inválido ou expirado", "TOKEN_INVALID"));
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
  next();
}

export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;
  if (!token) return next();
  try {
    const payload = jwtService.verifyAccess(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    // token inválido em rota opcional: segue sem usuário
  }
  next();
}

export async function loadFreshUser(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next();
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, role: true, active: true, deletedAt: true } });
    if (!user || !user.active || user.deletedAt) {
      return next(new UnauthorizedError("Usuário inativo ou não encontrado", "USER_INACTIVE"));
    }
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch (err) {
    if (err instanceof Error && (err as any).name === "AppError") throw err;
    next(err);
  }
  next();
}
