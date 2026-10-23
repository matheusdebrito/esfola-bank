import { prisma } from "../../config/prisma";
import { cacheService } from "./cache.service";
import { logger } from "../../config/logger";

export type InvalidationDomain = "clients" | "loans" | "installments" | "payments" | "dashboards" | "reports" | "permissions";

export const invalidationService = {
  async mark(domain: InvalidationDomain, key: string, payload?: any) {
    try {
      await prisma.cacheInvalidationEvent.create({
        data: { domain: domain.toUpperCase() as any, key, payload: payload ?? null, processed: false },
      });
    } catch (err) {
      logger.warn({ err, domain, key }, "failed to record invalidation event");
    }
  },

  async processPending(): Promise<void> {
    const events = await prisma.cacheInvalidationEvent.findMany({
      where: { processed: false },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const ev of events) {
      try {
        await cacheService.del(ev.key);
        // também invalida variações de chave do domínio quando a chave é um padrão
        if (String(ev.domain) === "DASHBOARDS") {
          await cacheService.flushDomain("dashboards");
        }
        await prisma.cacheInvalidationEvent.update({ where: { id: ev.id }, data: { processed: true, processedAt: new Date() } });
      } catch (err) {
        await prisma.cacheInvalidationEvent.update({
          where: { id: ev.id },
          data: { attempts: { increment: 1 }, lastError: String(err) },
        });
        logger.warn({ err, id: ev.id }, "failed to process invalidation event");
      }
    }
  },
};
