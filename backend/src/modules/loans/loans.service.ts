import { prisma } from "../../config/prisma";
import { auditService } from "../audit/audit.service";
import { Prisma } from "@prisma/client";
import {
  calculateInstallments,
  type InstallmentCalculation,
} from "../financial-policy/calculation.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { invalidationService } from "../../shared/cache/invalidation.service";
import {
  daysBetweenCalendarDates,
  toCalendarDate,
  todayCalendarDate,
} from "../../shared/calendar";
import type {
  LoanCreateInput,
  LoanUpdateInput,
  LoanStatusChangeInput,
  LoanListQuery,
} from "./loans.schema";

type SafeLoan = {
  id: string;
  code: string;
  clientId: string;
  clientName: string | null;
  clientCpfMasked: string | null;
  userId: string;
  userName: string | null;
  policyId: string | null;
  policyName: string | null;
  grantedAt: Date | null;
  principalAmount: number;
  interestRatePercent: number;
  periodicity: string;
  billingModel: string;
  installmentCount: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  contractTerms: string | null;
  status: string;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSafeLoan(loan: any): SafeLoan {
  return {
    id: loan.id,
    code: loan.code,
    clientId: loan.clientId,
    clientName: loan.client?.name ?? null,
    clientCpfMasked: loan.client ? maskCpf(loan.client.cpf) : null,
    userId: loan.userId,
    userName: loan.user?.name ?? null,
    policyId: loan.policyId ?? null,
    policyName: loan.policy?.name ?? null,
    grantedAt: loan.grantedAt,
    principalAmount: Number(loan.principalAmount),
    interestRatePercent: Number(loan.interestRatePercent),
    periodicity: loan.periodicity,
    billingModel: loan.billingModel,
    installmentCount: loan.installmentCount,
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    contractTerms: loan.contractTerms,
    status: loan.status,
    observations: loan.observations,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `***.***.${digits.slice(3, 6)}-**`;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "CANCELED"],
  ACTIVE: ["LIQUIDATED", "RENEGOTIATED", "CANCELED"],
  LIQUIDATED: [],
  CANCELED: [],
  RENEGOTIATED: [],
};

/**
 * Gera o próximo identificador do empréstimo de forma atômica.
 * Formato: EMP-<ano>-<sequencial de 4 dígitos>, reiniciado por ano.
 */
async function nextLoanCode(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "LoanCodeCounter" ("year", "lastValue", "updatedAt")
    VALUES (${year}, 1, NOW())
    ON CONFLICT ("year") DO UPDATE
      SET "lastValue" = "LoanCodeCounter"."lastValue" + 1,
          "updatedAt" = NOW()
    RETURNING "lastValue"`;

  const sequence = Number(rows[0]?.lastValue ?? 1);
  return `EMP-${year}-${String(sequence).padStart(4, "0")}`;
}

export const loansService = {
  async create(input: LoanCreateInput, actorId: string, ip?: string, userAgent?: string) {
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client || !client.active) {
      throw new NotFoundError("Cliente não encontrado ou inativo", "CLIENT_NOT_FOUND_OR_INACTIVE");
    }

    const policy = await prisma.financialPolicy.findUnique({ where: { id: input.policyId } });
    if (!policy || !policy.active) {
      throw new NotFoundError("Política financeira não encontrada ou inativa", "POLICY_NOT_FOUND_OR_INACTIVE");
    }

    const interestRatePercent = Number(policy.interestRatePercent);

    const grantedAt = input.grantedAt ? new Date(input.grantedAt) : new Date();
    const year = grantedAt.getUTCFullYear();

    const loan = await prisma.$transaction(async (tx) => {
      const code = await nextLoanCode(tx, year);

      return tx.loan.create({
        data: {
          code,
          clientId: input.clientId,
          userId: actorId,
          policyId: input.policyId,
          grantedAt,
          principalAmount: input.principalAmount,
          interestRatePercent,
          periodicity: input.periodicity,
          billingModel: input.billingModel,
          installmentCount: input.installmentCount ?? null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          contractTerms: input.contractTerms ?? null,
          observations: input.observations ?? null,
          status: "DRAFT",
        },
        include: { client: true, user: true, policy: true },
      });
    });

    await auditService.log({
      userId: actorId,
      action: "LOAN_CREATE",
      entityType: "Loan",
      entityId: loan.id,
      newValues: {
        code: loan.code,
        clientId: loan.clientId,
        principalAmount: loan.principalAmount,
        interestRatePercent: loan.interestRatePercent,
        periodicity: loan.periodicity,
        billingModel: loan.billingModel,
        status: loan.status,
      },
      ip,
      userAgent,
    });

    await invalidationService.mark("loans", `loan:${loan.id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");
    await invalidationService.mark("installments", `loan:${loan.id}`);

    return toSafeLoan(loan);
  },

  async list(query: LoanListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: "insensitive" } },
        { client: { name: { contains: query.search, mode: "insensitive" } } },
        { client: { cpf: { contains: query.search } } },
      ];
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, name: true, cpf: true } },
          user: { select: { id: true, name: true } },
          policy: { select: { id: true, name: true } },
          _count: { select: { installments: true, payments: true } },
        },
      }),
      prisma.loan.count({ where }),
    ]);

    return {
      items: loans.map((l) => ({
        ...toSafeLoan(l),
        installmentCount: l._count.installments,
        paymentCount: l._count.payments,
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, cpf: true } },
        user: { select: { id: true, name: true } },
        policy: true,
        installments: { orderBy: { number: "asc" } },
        payments: {
          orderBy: { registeredAt: "desc" },
          take: 10,
          include: {
            user: { select: { id: true, name: true } },
            allocations: { select: { installment: { select: { number: true } } } },
          },
        },
      },
    });
    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }
    return {
      ...toSafeLoan(loan),
      installments: loan.installments.map((i) => {
        const daysOverdue =
          i.status === "PAID" || i.status === "CANCELED"
            ? 0
            : Math.max(
                0,
                daysBetweenCalendarDates(toCalendarDate(i.dueDate), todayCalendarDate()),
              );

        return {
          id: i.id,
          number: i.number,
          dueDate: i.dueDate,
          principalDue: Number(i.principalDue),
          interestDue: Number(i.interestDue),
          chargesDue: Number(i.chargesDue),
          totalDue: Number(i.totalDue),
          paidAmount: Number(i.paidAmount),
          remainingBalance: Number(i.remainingBalance),
          status: i.status,
          effectiveStatus:
            (i.status === "PENDING" || i.status === "PARTIALLY_PAID") && daysOverdue > 0
              ? "OVERDUE"
              : i.status,
          isOverdue: daysOverdue > 0,
          daysOverdue,
        };
      }),
      payments: loan.payments.map((p) => ({
        id: p.id,
        receivedAmount: Number(p.receivedAmount),
        receivedAt: p.receivedAt,
        registeredAt: p.registeredAt,
        method: p.method,
        status: p.status,
        user: p.user?.name,
        installments: p.allocations.map((a) => a.installment.number),
      })),
    };
  },

  async update(id: string, input: LoanUpdateInput, actorId: string, ip?: string, userAgent?: string) {
    const loan = await prisma.loan.findUnique({ where: { id }, include: { client: true, user: true, policy: true } });
    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }
    if (loan.status !== "DRAFT") {
      throw new ConflictError("Somente empréstimos em rascunho podem ser editados", "LOAN_NOT_DRAFT");
    }

    const updateData: any = {};
    if (input.principalAmount !== undefined) updateData.principalAmount = input.principalAmount;
    if (input.periodicity !== undefined) updateData.periodicity = input.periodicity;
    if (input.billingModel !== undefined) updateData.billingModel = input.billingModel;
    if (input.installmentCount !== undefined) updateData.installmentCount = input.installmentCount;
    if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.contractTerms !== undefined) updateData.contractTerms = input.contractTerms;
    if (input.observations !== undefined) updateData.observations = input.observations;

    if (Object.keys(updateData).length === 0) {
      return toSafeLoan(loan);
    }

    const oldValues = {
      principalAmount: loan.principalAmount,
      interestRatePercent: loan.interestRatePercent,
      periodicity: loan.periodicity,
      billingModel: loan.billingModel,
      installmentCount: loan.installmentCount,
    };

    const updated = await prisma.loan.update({ where: { id }, data: updateData, include: { client: true, user: true, policy: true } });

    await auditService.log({
      userId: actorId,
      action: "LOAN_UPDATE",
      entityType: "Loan",
      entityId: id,
      oldValues,
      newValues: {
        principalAmount: updated.principalAmount,
        interestRatePercent: updated.interestRatePercent,
        periodicity: updated.periodicity,
        billingModel: updated.billingModel,
        installmentCount: updated.installmentCount,
      },
      ip,
      userAgent,
    });

    await invalidationService.mark("loans", `loan:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");
    await invalidationService.mark("installments", `loan:${id}`);

    return toSafeLoan(updated);
  },

  async changeStatus(id: string, input: LoanStatusChangeInput, actorId: string, ip?: string, userAgent?: string) {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { client: true, installments: true, payments: true },
    });
    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }

    const allowed = VALID_TRANSITIONS[loan.status];
    if (!allowed || !allowed.includes(input.status)) {
      throw new ConflictError(
        `Transição inválida: ${loan.status} → ${input.status}`,
        "INVALID_STATUS_TRANSITION",
      );
    }

    // ao ativar, gera as parcelas se ainda não existirem e o modelo for parcelas fixas
    if (input.status === "ACTIVE" && loan.installments.length === 0 && loan.billingModel === "FIXED_INSTALLMENTS") {
      await this.generateInstallments(loan, actorId);
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: { status: input.status },
      include: { client: true, user: true, policy: true },
    });

    await auditService.log({
      userId: actorId,
      action: "LOAN_STATUS_CHANGE",
      entityType: "Loan",
      entityId: id,
      oldValues: { status: loan.status },
      newValues: { status: input.status, justification: input.justification },
      ip,
      userAgent,
    });

    await invalidationService.mark("loans", `loan:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");
    await invalidationService.mark("installments", `loan:${id}`);

    return toSafeLoan(updated);
  },

  async remove(id: string, actorId: string, ip?: string, userAgent?: string) {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { _count: { select: { installments: true, payments: true } } },
    });

    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }

    const deletableStatus = loan.status === "DRAFT" || loan.status === "CANCELED";
    const hasFinancialHistory = loan._count.installments > 0 || loan._count.payments > 0;

    if (!deletableStatus || hasFinancialHistory) {
      throw new ConflictError(
        "Empréstimo com histórico financeiro não pode ser excluído (somente rascunho ou cancelado, sem parcelas e sem pagamentos)",
        "LOAN_HAS_FINANCIAL_HISTORY",
      );
    }

    await prisma.loan.delete({ where: { id } });

    await auditService.log({
      userId: actorId,
      action: "DELETE",
      entityType: "Loan",
      entityId: id,
      oldValues: {
        code: loan.code,
        clientId: loan.clientId,
        status: loan.status,
        principalAmount: loan.principalAmount,
      },
      ip,
      userAgent,
    });

    await invalidationService.mark("loans", `loan:${id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");
    await invalidationService.mark("installments", `loan:${id}`);

    return { id };
  },

  async generateInstallments(loan: any, actorId: string) {
    if (!loan.installmentCount || loan.installmentCount <= 0) {
      throw new ConflictError("Quantidade de parcelas não informada", "INSTALLMENT_COUNT_REQUIRED");
    }
    if (!loan.startDate) {
      throw new ConflictError("Data de início não informada", "START_DATE_REQUIRED");
    }

    const policy = loan.policy || (await prisma.financialPolicy.findUnique({ where: { id: loan.policyId! } }));
    if (!policy) {
      throw new NotFoundError("Política financeira não encontrada", "POLICY_NOT_FOUND");
    }

    const interestRatePercent = Number(loan.interestRatePercent ?? policy.interestRatePercent);
    const principal = Number(loan.principalAmount);

    const calculations: InstallmentCalculation[] = calculateInstallments({
      principal,
      interestRatePercent,
      installmentCount: loan.installmentCount,
      firstDueDate: loan.startDate,
      periodicity: loan.periodicity,
    });

    // cria parcelas em lote
    await prisma.installment.createMany({
      data: calculations.map((c) => ({
        loanId: loan.id,
        number: c.number,
        dueDate: c.dueDate,
        principalDue: c.principalDue,
        interestDue: c.interestDue,
        chargesDue: c.chargesDue,
        totalDue: c.totalDue,
        paidAmount: 0,
        remainingBalance: c.totalDue,
        status: "PENDING",
      })),
    });

    await auditService.log({
      userId: actorId,
      action: "LOAN_UPDATE",
      entityType: "Loan",
      entityId: loan.id,
      newValues: { installmentsGenerated: calculations.length },
    });

    await invalidationService.mark("loans", `loan:${loan.id}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");
    await invalidationService.mark("installments", `loan:${loan.id}`);

    return calculations;
  },
};
