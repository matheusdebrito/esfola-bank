import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import cookieParser from "cookie-parser";
import { requestLogger } from "./middlewares/request-logger.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { env } from "./config/env";
import { logger } from "./config/logger";
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

export function registerRoutes(app: Application): void {
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
}

export function createApp(): Application {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    }),
  );

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: true, message: "Muitas tentativas. Tente novamente mais tarde.", statusCode: 429, code: "RATE_LIMITED" },
    }),
  );

  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "emprestimo-backend", env: env.NODE_ENV });
  });

  registerRoutes(app);

  return app;
}

export function applyErrorHandling(app: Application): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}

export { logger };
