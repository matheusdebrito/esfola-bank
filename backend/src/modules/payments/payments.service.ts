import { prisma } from "../../config/prisma";
import { auditService } from "../audit/audit.service";
import {
  ConflictError,
  NotFoundError,
} from "../../shared/errors";
import { invalidationService } from "../../shared/cache/invalidation.service";
import type {
  PaymentCreateInput,
  PaymentListQuery,
  PaymentReverseInput,
} from "./payments.schema";

type SafePayment = {
  id: string;
  clientId: string;
  loanId: string;
  userId: string;
  userName: string | null;
  receivedAmount: number;
  receivedAt: Date;
  registeredAt: Date;
  method: string;
  reference: string | null;
  observations: string | null;
  idempotencyKey: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toSafePayment(payment: any): SafePayment {
  return {
    id: payment.id,
    clientId: payment.clientId,
    loanId: payment.loanId,
    userId: payment.userId,
    userName: payment.user?.name ?? null,
    receivedAmount: Number(payment.receivedAmount),
    receivedAt: payment.receivedAt,
    registeredAt: payment.registeredAt,
    method: payment.method,
    reference: payment.reference,
    observations: payment.observations,
    idempotencyKey: payment.idempotencyKey,
    status: payment.status,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export const paymentsService = {
  async register(input: PaymentCreateInput, actorId: string, ip?: string, userAgent?: string) {
    // idempotência
    if (input.idempotencyKey) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return toSafePayment(existing);
      }
    }

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client || !client.active) {
      throw new NotFoundError("Cliente não encontrado ou inativo", "CLIENT_NOT_FOUND_OR_INACTIVE");
    }

    const loan = await prisma.loan.findUnique({
      where: { id: input.loanId },
      include: { installments: true },
    });
    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }
    if (loan.clientId !== input.clientId) {
      throw new ConflictError("O empréstimo não pertence ao cliente informado", "LOAN_CLIENT_MISMATCH");
    }
    if (loan.status !== "ACTIVE") {
      throw new ConflictError("Não é possível registrar pagamento em empréstimo não ativo", "LOAN_NOT_ACTIVE");
    }

    const receivedAt = new Date(input.receivedAt);

    // valida soma das alocações
    const totalAllocated = input.allocations.reduce(
      (sum, a) => sum + a.principalAmount + a.interestAmount + a.chargesAmount,
      0,
    );
    if (Math.abs(totalAllocated - input.receivedAmount) > 0.005) {
      throw new ConflictError(
        "A soma das alocações não confere com o valor recebido",
        "ALLOCATION_MISMATCH",
      );
    }

    // valida cada alocação contra o saldo restante da parcela
    const installmentMap = new Map(loan.installments.map((i) => [i.id, i]));
    for (const alloc of input.allocations) {
      const inst = installmentMap.get(alloc.installmentId);
      if (!inst) {
        throw new NotFoundError(`Parcela ${alloc.installmentId} não encontrada neste empréstimo`, "INSTALLMENT_NOT_FOUND");
      }
      if (inst.loanId !== input.loanId) {
        throw new ConflictError("A parcela não pertence a este empréstimo", "INSTALLMENT_LOAN_MISMATCH");
      }
      const remaining = Number(inst.remainingBalance);
      // encargos de mora não compõem o saldo contratual da parcela
      const balanceImpact = alloc.principalAmount + alloc.interestAmount;
      if (balanceImpact > remaining + 0.005) {
        throw new ConflictError(
          `Alocação excede o saldo restante da parcela ${inst.number}`,
          "ALLOCATION_EXCEEDS_BALANCE",
        );
      }
    }

    const receivedAmount = input.receivedAmount;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          clientId: input.clientId,
          loanId: input.loanId,
          userId: actorId,
          receivedAmount,
          receivedAt,
          method: input.method,
          reference: input.reference ?? null,
          observations: input.observations ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          status: "REGISTERED",
        },
      });

      for (const alloc of input.allocations) {
        const inst = installmentMap.get(alloc.installmentId)!;
        const allocTotal = alloc.principalAmount + alloc.interestAmount + alloc.chargesAmount;
        const balanceImpact = alloc.principalAmount + alloc.interestAmount;
        const newPaid = Number(inst.paidAmount) + allocTotal;
        const newRemaining = Math.max(0, Number(inst.remainingBalance) - balanceImpact);
        let newStatus = inst.status;
        if (newRemaining <= 0.005) {
          newStatus = "PAID";
        } else if (newPaid > 0) {
          newStatus = "PARTIALLY_PAID";
        }

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            installmentId: alloc.installmentId,
            principalAmount: alloc.principalAmount,
            interestAmount: alloc.interestAmount,
            chargesAmount: alloc.chargesAmount,
            totalAmount: allocTotal,
          },
        });

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            paidAmount: newPaid,
            remainingBalance: newRemaining,
            status: newStatus,
          },
        });
      }

      return tx.payment.findUnique({ where: { id: payment.id }, include: { user: true } });
    });

    await auditService.log({
      userId: actorId,
      action: "PAYMENT_REGISTER",
      entityType: "Payment",
      entityId: result!.id,
      newValues: {
        loanId: input.loanId,
        clientId: input.clientId,
        receivedAmount,
        method: input.method,
        allocationCount: input.allocations.length,
      },
      ip,
      userAgent,
    });

    await invalidationService.mark("payments", `payment:${result!.id}`);
    await invalidationService.mark("installments", `loan:${input.loanId}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return toSafePayment(result!);
  },

  async list(query: PaymentListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.loanId) where.loanId = query.loanId;
    if (query.userId) where.userId = query.userId;
    if (query.method) where.method = query.method;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.receivedAt = {};
      if (query.from) where.receivedAt.gte = new Date(query.from);
      if (query.to) where.receivedAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { client: { name: { contains: query.search, mode: "insensitive" } } },
        { reference: { contains: query.search, mode: "insensitive" } },
        { loan: { code: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { receivedAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          loan: { select: { id: true, code: true } },
          allocations: {
            select: {
              id: true,
              installmentId: true,
              totalAmount: true,
              installment: { select: { number: true } },
            },
            orderBy: { allocatedAt: "asc" },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      items: payments.map((p) => {
        const allocations = p.allocations.map((a) => ({
          id: a.id,
          installmentId: a.installmentId,
          installmentNumber: a.installment.number,
          allocatedAmount: Number(a.totalAmount),
        }));

        return {
          ...toSafePayment(p),
          clientName: p.client?.name ?? null,
          loanCode: p.loan?.code ?? null,
          allocationCount: allocations.length,
          allocations,
        };
      }),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        allocations: { include: { installment: { select: { id: true, number: true, dueDate: true } } } },
        user: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        loan: { select: { id: true } },
      },
    });
    if (!payment) {
      throw new NotFoundError("Pagamento não encontrado", "PAYMENT_NOT_FOUND");
    }
    return {
      ...toSafePayment(payment),
      allocations: payment.allocations.map((a) => ({
        id: a.id,
        installmentId: a.installmentId,
        installmentNumber: a.installment.number,
        installmentDueDate: a.installment.dueDate,
        principalAmount: Number(a.principalAmount),
        interestAmount: Number(a.interestAmount),
        chargesAmount: Number(a.chargesAmount),
        totalAmount: Number(a.totalAmount),
        allocatedAt: a.allocatedAt,
      })),
    };
  },

  async reverse(id: string, input: PaymentReverseInput, actorId: string, ip?: string, userAgent?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundError("Pagamento não encontrado", "PAYMENT_NOT_FOUND");
    }
    if (payment.status === "REVERSED") {
      throw new ConflictError("Pagamento já estornado", "PAYMENT_ALREADY_REVERSED");
    }

    const loan = await prisma.loan.findUnique({ where: { id: payment.loanId } });
    if (!loan) {
      throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      // reverter as parcelas: subtrair o pago
      for (const alloc of payment.allocations) {
        const inst = await tx.installment.findUnique({ where: { id: alloc.installmentId } });
        if (!inst) continue;
        const balanceImpact = Number(alloc.principalAmount) + Number(alloc.interestAmount);
        const newPaid = Math.max(0, Number(inst.paidAmount) - Number(alloc.totalAmount));
        const newRemaining = Number(inst.remainingBalance) + balanceImpact;
        let newStatus = inst.status;
        if (newRemaining <= 0.005) {
          newStatus = "PAID";
        } else if (newPaid > 0 && newPaid < Number(inst.totalDue)) {
          newStatus = "PARTIALLY_PAID";
        } else if (newPaid === 0) {
          newStatus = "PENDING";
        }

        await tx.paymentAllocation.delete({ where: { id: alloc.id } });
        await tx.installment.update({
          where: { id: inst.id },
          data: { paidAmount: newPaid, remainingBalance: newRemaining, status: newStatus },
        });
      }

      await tx.payment.update({
        where: { id },
        data: { status: "REVERSED" },
      });
    });

    await auditService.log({
      userId: actorId,
      action: "PAYMENT_REVERSE",
      entityType: "Payment",
      entityId: id,
      oldValues: { status: "REGISTERED", receivedAmount: payment.receivedAmount },
      newValues: { status: "REVERSED", justification: input.justification },
      ip,
      userAgent,
    });

    await invalidationService.mark("payments", `payment:${id}`);
    await invalidationService.mark("installments", `loan:${payment.loanId}`);
    await invalidationService.mark("dashboards", "dashboards:*");
    await invalidationService.mark("reports", "reports:*");

    return { message: "Pagamento estornado com sucesso", paymentId: id };
  },
};
