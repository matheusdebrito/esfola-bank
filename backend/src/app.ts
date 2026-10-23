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

  return app;
}

export function applyErrorHandling(app: Application): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}

export { logger };
