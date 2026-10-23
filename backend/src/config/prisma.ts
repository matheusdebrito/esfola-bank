import { env } from "./env";
import { logger } from "./logger";
import type { PrismaClient } from "@prisma/client";

// Importado preguiçosamente para não instanciar o Prisma Client no carregamento do módulo em testes.
let prismaInstance: PrismaClient | null = null;

export function getPrisma() {
  if (!prismaInstance) {
    const { PrismaClient } = require("@prisma/client");
    const client = new PrismaClient({
      log: env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
    } as unknown as PrismaClient);
    (client as any).$on("query", (e: any) => {
      if (env.NODE_ENV === "development") {
        logger.debug({ query: e.query, params: e.params, duration: e.duration }, "prisma query");
      }
    });
    (client as any).$on("error", (e: any) => {
      logger.error({ target: e.target, message: e.message }, "prisma error");
    });
    prismaInstance = client;
  }
  return prismaInstance!;
}

export const prisma = getPrisma();

export function disconnectPrisma() {
  if (prismaInstance) {
    return prismaInstance.$disconnect();
  }
  return Promise.resolve();
}
