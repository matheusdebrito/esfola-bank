import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.debug(
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
      "http request",
    );
  });
  next();
}
