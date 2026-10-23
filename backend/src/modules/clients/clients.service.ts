import { prisma } from "../../config/prisma";
import { auditService } from "../audit/audit.service";
import { normalizeCpf, maskCpf } from "./cpf.util";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { invalidationService } from "../../shared/cache/invalidation.service";
import type { ClientCreateInput, ClientUpdateInput, ClientListQuery } from "./clients.schema";

type SafeClient = {
  id: string;
  name: string;
  cpf: string;
  cpfMasked: string;
  phone: string | null;
  birthDate: Date;
  cep: string;
  address: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toSafeClient(client: any): SafeClient {
  return {
    id: client.id,
    name: client.name,
    cpf: client.cpf,
    cpfMasked: maskCpf(client.cpf),
    phone: client.phone ?? null,
    birthDate: client.birthDate,
    cep: client.cep,
    address: client.address,
    number: client.number,
    complement: client.complement,
    neighborhood: client.neighborhood,
    city: client.city,
    state: client.state,
    active: client.active,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export const clientsService = {
  async create(input: ClientCreateInput, actorId: string, ip?: string, userAgent?: string) {
    const cpf = normalizeCpf(input.cpf);
    const existing = await prisma.client.findUnique({ where: { cpf } });
    if (existing) {
      throw new ConflictError("CPF já cadastrado", "CPF_ALREADY_EXISTS");
    }

    const client = await prisma.client.create({
      data: {
        name: input.name,
        cpf,
        phone: input.phone ?? null,
        birthDate: new Date(input.birthDate),
        cep: input.cep,
        address: input.address,
        number: input.number,
        complement: input.complement ?? null,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state.toUpperCase(),
        active: true,
      },
    });

    await auditService.log({
      userId: actorId,
      action: "CREATE",
      entityType: "Client",
      entityId: client.id,
      newValues: { name: client.name, cpf: maskCpf(client.cpf), city: client.city, state: client.state },
      ip,
      userAgent,
    });

    await invalidationService.mark("clients", `client:${client.id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return toSafeClient(client);
  },

  async list(query: ClientListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { cpf: { contains: normalizeCpf(query.search) } },
      ];
    }
    if (query.active !== undefined) where.active = query.active;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.count({ where }),
    ]);

    return {
      items: clients.map(toSafeClient),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundError("Cliente não encontrado", "CLIENT_NOT_FOUND");
    }
    return toSafeClient(client);
  },

  async update(id: string, input: ClientUpdateInput, actorId: string, ip?: string, userAgent?: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundError("Cliente não encontrado", "CLIENT_NOT_FOUND");
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.cpf !== undefined) {
      const cpf = normalizeCpf(input.cpf);
      const existing = await prisma.client.findUnique({ where: { cpf } });
      if (existing && existing.id !== id) {
        throw new ConflictError("CPF já cadastrado", "CPF_ALREADY_EXISTS");
      }
      updateData.cpf = cpf;
    }
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.birthDate !== undefined) updateData.birthDate = new Date(input.birthDate);
    if (input.cep !== undefined) updateData.cep = input.cep;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.number !== undefined) updateData.number = input.number;
    if (input.complement !== undefined) updateData.complement = input.complement;
    if (input.neighborhood !== undefined) updateData.neighborhood = input.neighborhood;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state.toUpperCase();
    if (input.active !== undefined) updateData.active = input.active;

    if (Object.keys(updateData).length === 0) {
      return toSafeClient(client);
    }

    const updated = await prisma.client.update({ where: { id }, data: updateData });

    await auditService.log({
      userId: actorId,
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      oldValues: { name: client.name, cpf: maskCpf(client.cpf), active: client.active },
      newValues: { name: updated.name, cpf: maskCpf(updated.cpf), active: updated.active },
      ip,
      userAgent,
    });

    await invalidationService.mark("clients", `client:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return toSafeClient(updated);
  },

  async remove(id: string, actorId: string, ip?: string, userAgent?: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundError("Cliente não encontrado", "CLIENT_NOT_FOUND");
    }

    const [loans, payments] = await Promise.all([
      prisma.loan.count({ where: { clientId: id } }),
      prisma.payment.count({ where: { clientId: id } }),
    ]);
    if (loans > 0 || payments > 0) {
      throw new ConflictError(
        "Cliente possui histórico financeiro e não pode ser excluído; desative-o em vez disso",
        "CLIENT_HAS_HISTORY",
      );
    }

    await prisma.client.delete({ where: { id } });

    await auditService.log({
      userId: actorId,
      action: "DELETE",
      entityType: "Client",
      entityId: id,
      oldValues: { name: client.name, cpf: maskCpf(client.cpf), city: client.city, state: client.state },
      ip,
      userAgent,
    });

    await invalidationService.mark("clients", `client:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return { id };
  },

  async setActive(id: string, active: boolean, actorId: string, ip?: string, userAgent?: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundError("Cliente não encontrado", "CLIENT_NOT_FOUND");
    }
    if (client.active === active) {
      return toSafeClient(client);
    }
    // não permite desativar cliente com empréstimos ativos ou pendentes (histórico financeiro)
    if (!active) {
      const activeLoans = await prisma.loan.count({
        where: { clientId: id, status: { in: ["ACTIVE", "RENEGOTIATED"] } },
      });
      if (activeLoans > 0) {
        throw new ConflictError("Não é possível desativar cliente com empréstimos ativos", "CLIENT_HAS_ACTIVE_LOANS");
      }
    }

    const updated = await prisma.client.update({ where: { id }, data: { active } });

    await auditService.log({
      userId: actorId,
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      oldValues: { active: client.active },
      newValues: { active: updated.active },
      ip,
      userAgent,
    });

    await invalidationService.mark("clients", `client:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return toSafeClient(updated);
  },
};
