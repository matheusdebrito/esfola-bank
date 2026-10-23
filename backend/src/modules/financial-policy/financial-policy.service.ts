import { prisma } from "../../config/prisma";
import { auditService } from "../audit/audit.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type {
  FinancialPolicyCreateInput,
  FinancialPolicyUpdateInput,
  FinancialPolicyListQuery,
} from "./financial-policy.schema";

type SafePolicy = {
  id: string;
  name: string;
  description: string | null;
  interestRatePercent: number;
  lateFeeAmount: number;
  dailyLateInterestPercent: number;
  roundingMode: string;
  toleranceDays: number;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSafePolicy(policy: any): SafePolicy {
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    interestRatePercent: Number(policy.interestRatePercent),
    lateFeeAmount: Number(policy.lateFeeAmount),
    dailyLateInterestPercent: Number(policy.dailyLateInterestPercent),
    roundingMode: policy.roundingMode,
    toleranceDays: policy.toleranceDays,
    active: policy.active,
    createdBy: policy.createdBy,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

export const financialPolicyService = {
  async create(input: FinancialPolicyCreateInput, actorId: string, ip?: string, userAgent?: string) {
    const policy = await prisma.financialPolicy.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        interestRatePercent: input.interestRatePercent,
        lateFeeAmount: input.lateFeeAmount,
        dailyLateInterestPercent: input.dailyLateInterestPercent,
        roundingMode: input.roundingMode,
        toleranceDays: input.toleranceDays,
        active: input.active,
        createdBy: actorId,
      },
    });

    await auditService.log({
      userId: actorId,
      action: "CREATE",
      entityType: "FinancialPolicy",
      entityId: policy.id,
      newValues: {
        name: policy.name,
        interestRatePercent: policy.interestRatePercent,
        lateFeeAmount: policy.lateFeeAmount,
        dailyLateInterestPercent: policy.dailyLateInterestPercent,
      },
      ip,
      userAgent,
    });

    return toSafePolicy(policy);
  },

  async list(query: FinancialPolicyListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.active !== undefined) where.active = query.active;

    const [policies, total] = await Promise.all([
      prisma.financialPolicy.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.financialPolicy.count({ where }),
    ]);

    return {
      items: policies.map(toSafePolicy),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const policy = await prisma.financialPolicy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundError("Política financeira não encontrada", "FINANCIAL_POLICY_NOT_FOUND");
    }
    return toSafePolicy(policy);
  },



  async update(id: string, input: FinancialPolicyUpdateInput, actorId: string, ip?: string, userAgent?: string) {
    const policy = await prisma.financialPolicy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundError("Política financeira não encontrada", "FINANCIAL_POLICY_NOT_FOUND");
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;

    if (input.interestRatePercent !== undefined) updateData.interestRatePercent = input.interestRatePercent;
    if (input.lateFeeAmount !== undefined) updateData.lateFeeAmount = input.lateFeeAmount;
    if (input.dailyLateInterestPercent !== undefined) updateData.dailyLateInterestPercent = input.dailyLateInterestPercent;
    if (input.roundingMode !== undefined) updateData.roundingMode = input.roundingMode;
    if (input.toleranceDays !== undefined) updateData.toleranceDays = input.toleranceDays;
    if (input.active !== undefined) updateData.active = input.active;

    if (Object.keys(updateData).length === 0) {
      return toSafePolicy(policy);
    }



    const updated = await prisma.financialPolicy.update({ where: { id }, data: updateData });

    await auditService.log({
      userId: actorId,
      action: "UPDATE",
      entityType: "FinancialPolicy",
      entityId: id,
      oldValues: {
        name: policy.name,
        interestRatePercent: policy.interestRatePercent,
        lateFeeAmount: policy.lateFeeAmount,
        dailyLateInterestPercent: policy.dailyLateInterestPercent,

      },
      newValues: {
        name: updated.name,
        interestRatePercent: updated.interestRatePercent,
        lateFeeAmount: updated.lateFeeAmount,
        dailyLateInterestPercent: updated.dailyLateInterestPercent,

      },
      ip,
      userAgent,
    });

    return toSafePolicy(updated);
  },

  async remove(id: string, actorId: string, ip?: string, userAgent?: string) {
    const policy = await prisma.financialPolicy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundError("Política financeira não encontrada", "FINANCIAL_POLICY_NOT_FOUND");
    }

    // verifica se há empréstimos usando essa política
    const loansUsing = await prisma.loan.count({ where: { policyId: id } });
    if (loansUsing > 0) {
      throw new ConflictError("Não é possível remover política em uso por empréstimos", "POLICY_IN_USE");
    }

    await prisma.financialPolicy.delete({ where: { id } });

    await auditService.log({
      userId: actorId,
      action: "DELETE",
      entityType: "FinancialPolicy",
      entityId: id,
      oldValues: { name: policy.name },
      ip,
      userAgent,
    });

    return { message: "Política financeira removida com sucesso" };
  },
};
