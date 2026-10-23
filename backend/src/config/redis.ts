import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redisInstance: Redis | null = null;

export function getRedis() {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    redisInstance.on("error", (err) => {
      logger.warn({ err: err.message }, "redis connection error");
    });
  }
  return redisInstance;
}

export const redis = getRedis();

export function disconnectRedis() {
  if (redisInstance) {
    return redisInstance.quit();
  }
  return Promise.resolve();
}
