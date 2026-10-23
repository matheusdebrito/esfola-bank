import { createApp, applyErrorHandling } from "./app";
import { ensureBootstrapAdmin } from "./bootstrap";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { invalidationService } from "./shared/cache/invalidation.service";
import { disconnectPrisma } from "./config/prisma";
import { disconnectRedis } from "./config/redis";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import clientsRoutes from "./modules/clients/clients.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import dashboardsRoutes from "./modules/dashboards/dashboards.routes";
import auditRoutes from "./modules/audit/audit.routes";
import financialPolicyRoutes from "./modules/financial-policy/financial-policy.routes";
import loansRoutes from "./modules/loans/loans.routes";
import paymentsRoutes from "./modules/payments/payments.routes";
import installmentsRoutes from "./modules/installments/installments.routes";

const app = createApp();

// Rotas da API (prefixo /api/v1)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/clients", clientsRoutes);
app.use("/api/v1", documentsRoutes);
app.use("/api/v1/financial-policies", financialPolicyRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use("/api/v1/dashboards", dashboardsRoutes);
app.use("/api/v1/loans", loansRoutes);
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/installments", installmentsRoutes);

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
