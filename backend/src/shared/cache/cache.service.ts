import { redis } from "../../config/redis";
import { logger } from "../../config/logger";

const VERSION_PREFIX = "v1";

export const cacheService = {
  buildKey(domain: string, ...parts: string[]): string {
    return `cache:${VERSION_PREFIX}:${domain}:${parts.join(":")}`;
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn({ err, key }, "cache read failed");
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, "cache write failed");
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, "cache delete failed");
    }
  },

  async flushDomain(domain: string): Promise<void> {
    try {
      const keys = await redis.keys(`cache:${VERSION_PREFIX}:${domain}:*`);
      if (keys.length) await redis.del(...keys);
    } catch (err) {
      logger.warn({ err, domain }, "cache domain flush failed");
    }
  },
};

export type CacheDomain = "clients" | "loans" | "installments" | "payments" | "dashboards" | "reports" | "permissions";
