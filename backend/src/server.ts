import { createApp, applyErrorHandling } from "./app";
import { ensureBootstrapAdmin } from "./bootstrap";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { invalidationService } from "./shared/cache/invalidation.service";
import { disconnectPrisma } from "./config/prisma";
import { disconnectRedis } from "./config/redis";

const app = createApp();

applyErrorHandling(app);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "backend iniciado");
  void ensureBootstrapAdmin().catch((err) => {
    logger.error({ err }, "falha ao garantir administrador inicial");
  });
});

// Worker de invalidação de cache (outbox consumer). Roda periodicamente para
// aplicar eventos de invalidação registrados na mesma transação dos dados.
const INVALIDATION_INTERVAL_MS = 5000;
const invalidationTimer = setInterval(async () => {
  try {
    await invalidationService.processPending();
  } catch (err) {
    logger.warn({ err }, "cache invalidation worker error");
  }
}, INVALIDATION_INTERVAL_MS);
if (invalidationTimer.unref) invalidationTimer.unref();

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandledRejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM recebido, encerrando...");
  clearInterval(invalidationTimer);
  server.close(() => {
    void disconnectPrisma();
    void disconnectRedis();
    process.exit(0);
  });
});

export default app;
