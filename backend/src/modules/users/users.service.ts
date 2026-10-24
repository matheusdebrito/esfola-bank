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
  OwnProfileInput,
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

    const where: any = { deletedAt: null };
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
      where: { id, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
    }
    return toSafeUser(user);
  },

  async updateOwnProfile(userId: string, input: OwnProfileInput, ip?: string, userAgent?: string) {
    const old = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, active: true } });
    if (!old) throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });
    await auditService.log({
      userId, action: "USER_UPDATE", entityType: "User", entityId: userId,
      oldValues: { name: old.name }, newValues: { name: updated.name }, ip, userAgent,
    });
    return toSafeUser(updated);
  },

  async update(id: string, input: UserUpdateInput, actorId: string, ip?: string, userAgent?: string) {
    if (id === actorId) throw new ForbiddenError("Altere seu nome em Meu perfil. Não é permitido modificar seu próprio acesso administrativo.", "SELF_USER_MANAGEMENT_DENIED");
    const updated = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");

      // Nunca deixar o sistema sem ao menos um administrador ativo.
      if (user.role === "ADMIN" && user.active && (input.role && input.role !== "ADMIN" || input.active === false)) {
        const admins = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null } });
        if (admins <= 1) throw new ForbiddenError("O último administrador ativo não pode ser removido", "LAST_ADMIN");
      }

      const updateData: { name?: string; role?: UserUpdateInput["role"]; active?: boolean } = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.active !== undefined) updateData.active = input.active;
      const result = await tx.user.update({ where: { id }, data: updateData });
      if (input.active === false || input.role !== undefined && input.role !== user.role) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return { user, result };
    }, { isolationLevel: "Serializable" });

    await auditService.log({
      userId: actorId, action: "USER_UPDATE", entityType: "User", entityId: id,
      oldValues: { name: updated.user.name, role: updated.user.role, active: updated.user.active },
      newValues: { name: updated.result.name, role: updated.result.role, active: updated.result.active },
      ip, userAgent,
    });
    return toSafeUser(updated.result);
  },

  /** Exclusão lógica intencional: todas as referências financeiras permanecem intactas. */
  async delete(id: string, actorId: string, ip?: string, userAgent?: string) {
    if (id === actorId) throw new ForbiddenError("Você não pode excluir sua própria conta", "CANNOT_DELETE_SELF");
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
      if (user.role === "ADMIN" && user.active) {
        const admins = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null } });
        if (admins <= 1) throw new ForbiddenError("O último administrador ativo não pode ser excluído", "LAST_ADMIN");
      }
      const removed = await tx.user.update({
        where: { id }, data: { active: false, deletedAt: new Date() },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return removed;
    }, { isolationLevel: "Serializable" });
    await auditService.log({
      userId: actorId, action: "USER_DELETE", entityType: "User", entityId: id,
      oldValues: { name: result.name, email: result.email, role: result.role },
      newValues: { deleted: true }, ip, userAgent,
    });
    return { message: "Usuário excluído da operação; histórico preservado" };
  },

  async changePassword(userId: string, input: PasswordChangeInput, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
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
    const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
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
    if (id === actorId) throw new ForbiddenError("Não é permitido alterar seu próprio acesso", "SELF_USER_MANAGEMENT_DENIED");
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new NotFoundError("Usuário não encontrado", "USER_NOT_FOUND");
      if (user.active === active) return { before: user, after: user };
      if (!active && user.role === "ADMIN") {
        const count = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null } });
        if (count <= 1) throw new ForbiddenError("O último administrador ativo não pode ser desativado", "LAST_ADMIN");
      }
      const after = await tx.user.update({ where: { id }, data: { active } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return { before: user, after };
    }, { isolationLevel: "Serializable" });
    if (result.before.active !== active) {
      await auditService.log({
        userId: actorId, action: "USER_STATUS_CHANGE", entityType: "User", entityId: id,
        oldValues: { active: result.before.active }, newValues: { active }, ip, userAgent,
      });
    }
    return toSafeUser(result.after);
  },
};
