import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { env, isProduction } from "../../config/env";
import { logger } from "../../config/logger";

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
};

const accessSignOptions: SignOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  expiresIn: env.JWT_ACCESS_TTL as any,
};

const refreshSignOptions: SignOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  expiresIn: env.JWT_REFRESH_TTL as any,
};

const verifyOptions: VerifyOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export const jwtService = {
  signAccess(payload: Omit<TokenPayload, "sub"> & { sub: string }): string {
    return jwt.sign(payload, env.JWT_SECRET, accessSignOptions);
  },
  signRefresh(payload: Omit<TokenPayload, "sub"> & { sub: string }): string {
    return jwt.sign(payload, env.JWT_SECRET, refreshSignOptions);
  },
  verifyAccess(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_SECRET, verifyOptions) as TokenPayload;
  },
  verifyRefresh(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_SECRET, verifyOptions) as TokenPayload;
  },
  decode(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  },
};

// Log se JWT_SECRET for fraco/desenvolvimento
if (!isProduction() && env.JWT_SECRET === "sua_chave_secreta_minimo_32_caracteres_dev") {
  logger.warn("JWT_SECRET usando valor padrão de desenvolvimento. Altere em produção.");
}
