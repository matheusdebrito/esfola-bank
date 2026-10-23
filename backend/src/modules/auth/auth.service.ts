import { prisma } from "../../config/prisma";
import { jwtService } from "./jwt.service";
import { passwordService } from "./password.service";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../shared/errors";
import type { LoginInput } from "./auth.schema";

const ACCESS_TOKEN_NAME = "access_token";
const REFRESH_TOKEN_NAME = "refresh_token";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const authService = {
  async login(input: LoginInput, ip?: string, userAgent?: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.active) {
      // não revela se o e-mail existe
      await this.recordAuthEvent(undefined, "LOGIN_FAILED", ip, userAgent, { reason: "user_not_found_or_inactive" });
      throw new AppError("E-mail ou senha inválidos", 401, "INVALID_CREDENTIALS");
    }

    const valid = await passwordService.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.recordAuthEvent(user.id, "LOGIN_FAILED", ip, userAgent, { reason: "invalid_password" });
      throw new AppError("E-mail ou senha inválidos", 401, "INVALID_CREDENTIALS");
    }

    const tokens = await this.issueTokens(user);
    await this.recordAuthEvent(user.id, "LOGIN", ip, userAgent, {});
    return { user: this.mapUser(user), tokens };
  },

  async issueTokens(user: { id: string; email: string; name: string; role: string }): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = jwtService.signAccess(payload);
    const refreshToken = jwtService.signRefresh(payload);

    const refreshTokenHash = await passwordService.hash(refreshToken);
    const expiresAt = new Date(Date.now() + parseTtl(env.JWT_REFRESH_TTL));

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    logger.info({ userId: user.id }, "tokens issued");
    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: any;
    try {
      payload = jwtService.verifyRefresh(refreshToken);
    } catch {
      throw new AppError("Token de atualização inválido ou expirado", 401, "REFRESH_TOKEN_INVALID");
    }

    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!stored) {
      throw new AppError("Token de atualização revogado ou expirado", 401, "REFRESH_TOKEN_REVOKED");
    }

    const valid = await passwordService.verify(stored.tokenHash, refreshToken);
    if (!valid) {
      throw new AppError("Token de atualização inválido", 401, "REFRESH_TOKEN_INVALID");
    }

    // rotaciona: revoga o antigo e emite um novo
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new AppError("Usuário inativo", 401, "USER_INACTIVE");
    }

    return this.issueTokens({ id: user.id, email: user.email, name: user.name, role: user.role });
  },

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      let payload: any;
      try {
        payload = jwtService.decode(refreshToken);
      } catch {
        payload = null;
      }
      if (payload?.sub) {
        await prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  },

  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  mapUser(user: { id: string; email: string; name: string; role: string; active: boolean }): AuthUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  },

  async recordAuthEvent(
    userId: string | undefined,
    action: string,
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          entityType: "auth",
          entityId: userId,
          metadata: (metadata ?? {}) as any,
          ip,
          userAgent,
        },
      });
    } catch (err) {
      logger.warn({ err }, "falha ao registrar evento de autenticação");
    }
  },

  setTokenCookies(res: any, tokens: TokenPair): void {
    const isSecure = env.COOKIE_SECURE;
    const sameSite = env.COOKIE_SAME_SITE as "lax" | "strict" | "none";
    const accessTtlMs = parseTtl(env.JWT_ACCESS_TTL);
    const refreshTtlMs = parseTtl(env.JWT_REFRESH_TTL);

    res.cookie(ACCESS_TOKEN_NAME, tokens.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: "/",
      maxAge: accessTtlMs,
      domain: env.COOKIE_DOMAIN || undefined,
    });
    res.cookie(REFRESH_TOKEN_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: "/",
      maxAge: refreshTtlMs,
      domain: env.COOKIE_DOMAIN || undefined,
    });
  },

  clearTokenCookies(res: any): void {
    res.clearCookie(ACCESS_TOKEN_NAME, { path: "/", domain: env.COOKIE_DOMAIN || undefined });
    res.clearCookie(REFRESH_TOKEN_NAME, { path: "/", domain: env.COOKIE_DOMAIN || undefined });
  },
};

function parseTtl(ttl: string): number {
  const match = /^(\d+)(m|h|d)$/.exec(ttl);
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const mult = ({ m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 } as Record<string, number>)[unit] ?? 60 * 1000;
  return value * mult;
}
