import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../shared/errors";
import { PERMISSIONS, rolePermissions, type Permission } from "../modules/auth/permissions";
import { AuthRequest } from "./auth.middleware";

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return next(new ForbiddenError("Usuário não autenticado", "USER_NOT_AUTHENTICATED"));
    }
    const perms = rolePermissions[authReq.user.role as keyof typeof rolePermissions];
    if (!perms || !perms.includes(permission as Permission)) {
      return next(new ForbiddenError("Permissão insuficiente", "INSUFFICIENT_PERMISSION"));
    }
    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return next(new ForbiddenError("Usuário não autenticado", "USER_NOT_AUTHENTICATED"));
    }
    const perms = rolePermissions[authReq.user.role as keyof typeof rolePermissions];
    if (!perms || !permissions.some((p) => perms.includes(p as Permission))) {
      return next(new ForbiddenError("Permissão insuficiente", "INSUFFICIENT_PERMISSION"));
    }
    next();
  };
}

export { PERMISSIONS };
