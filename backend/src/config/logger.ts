// Pino structured logger - never log secrets, passwords, tokens, CPF full or document content
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: (process.env.LOG_LEVEL || "info") as pino.Level,
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
  redact: ["req.headers.authorization", "req.body.password", "req.body.confirmPassword", "req.headers.cookie"],
});

export type Logger = pino.Logger;
