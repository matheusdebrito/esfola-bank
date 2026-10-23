import { prisma } from "../../config/prisma";
import type { AuditAction } from "@prisma/client";

export interface AuditLogInput {
  userId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const auditService = {
  async log(input: AuditLogInput) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: input.userId ?? undefined,
          action: input.action as AuditAction,
          entityType: input.entityType,
          entityId: input.entityId ?? undefined,
          oldValues: (input.oldValues ?? undefined) as any,
          newValues: (input.newValues ?? undefined) as any,
          metadata: (input.metadata ?? undefined) as any,
          ip: input.ip ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });
    } catch (err) {
      // auditoria nunca deve quebrar o fluxo principal
      console.error("audit log failure:", err);
      return null;
    }
  },

  async list({
    page = 1,
    pageSize = 20,
    action,
    entityType,
    entityId,
    userId,
    from,
    to,
  }: {
    page?: number;
    pageSize?: number;
    action?: AuditAction | string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    from?: Date;
    to?: Date;
  }) {
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize));
    const take = Math.min(100, Math.max(1, pageSize));

    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: { page: Math.max(1, page), pageSize: take, total, totalPages: Math.ceil(total / take) },
    };
  },
};
