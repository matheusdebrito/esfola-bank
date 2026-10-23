import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  JWT_SECRET: z.string().min(1),
  JWT_ISSUER: z.string().default("sistema-emprestimo"),
  JWT_AUDIENCE: z.string().default("sistema-emprestimo-app"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  STORAGE_BASE_PATH: z.string().default("./storage/clients"),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ADMIN_EMAIL: z.string().email().default("admin@emprestimo.local"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin@12345"),
});

const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  console.error("❌ Variáveis de ambiente inválidas:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;

export function isTest() {
  return env.NODE_ENV === "test";
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
