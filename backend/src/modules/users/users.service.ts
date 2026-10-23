import { prisma } from "../../config/prisma";
import { passwordService } from "../auth/password.service";
import { auditService } from "../audit/audit.service";
import { ConflictError, NotFoundError, ForbiddenError } from "../../shared/errors";
import type {
  UserCreateInput,
  UserUpdateInput,
  PasswordChangeInput,
  PasswordResetInput,
  UserListQuery,
} from "./users.schema";

type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toSafeUser(user: any): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const usersService = {
  async create(input: UserCreateInput, actorId: string, ip?: string, userAgent?: string) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError("E-mail já cadastrado", "EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await passwordService.hash(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: input.role,
        active: true,
      },
    });

    await auditService.log({
      userId: actorId,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, name: user.name, role: user.role },
      ip,
      userAgent,
    });

    return toSafeUser(user);
  },

  async list(query: UserListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.active !== undefined) where.active = query.active;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map(toSafeUser),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }
    return toSafeUser(user);
  },

  async update(id: string, input: UserUpdateInput, actorId: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing && existing.id !== id) {
        throw new ConflictError("E-mail já cadastrado", "EMAIL_ALREADY_EXISTS");
      }
      updateData.email = input.email;
    }
    if (input.role !== undefined) updateData.role = input.role;
    if (input.active !== undefined) updateData.active = input.active;

    if (Object.keys(updateData).length === 0) {
      return toSafeUser(user);
    }

    const updated = await prisma.user.update({ where: { id }, data: updateData });

    await auditService.log({
      userId: actorId,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      oldValues: { name: user.name, email: user.email, role: user.role, active: user.active },
      newValues: { name: updated.name, email: updated.email, role: updated.role, active: updated.active },
      ip,
      userAgent,
    });

    return toSafeUser(updated);
  },

  async changePassword(userId: string, input: PasswordChangeInput, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }

    const valid = await passwordService.verify(user.passwordHash, input.currentPassword);
    if (!valid) {
      throw new ForbiddenError("Senha atual inválida", "INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await passwordService.hash(input.newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // revoga todos os tokens de refresh do usuário (força novo login)
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditService.log({
      userId,
      action: "PASSWORD_CHANGE",
      entityType: "User",
      entityId: userId,
      ip,
      userAgent,
    });

    return { message: "Senha alterada com sucesso" };
  },

  async resetPassword(userId: string, input: PasswordResetInput, actorId: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }

    const passwordHash = await passwordService.hash(input.newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditService.log({
      userId: actorId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      ip,
      userAgent,
    });

    return { message: "Senha redefinida com sucesso" };
  },

  async setActive(id: string, active: boolean, actorId: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }
    if (user.active === active) {
      return toSafeUser(user);
    }

    const updated = await prisma.user.update({ where: { id }, data: { active } });

    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditService.log({
      userId: actorId,
      action: active ? "USER_STATUS_CHANGE" : "USER_STATUS_CHANGE",
      entityType: "User",
      entityId: id,
      oldValues: { active: user.active },
      newValues: { active: updated.active },
      ip,
      userAgent,
    });

    return toSafeUser(updated);
  },
};
