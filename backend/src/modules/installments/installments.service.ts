import { prisma } from "../../config/prisma";
import { calculateLateCharges } from "../financial-policy/calculation.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { paymentsService } from "../payments/payments.service";
import {
  calendarDateToUtc,
  daysBetweenCalendarDates,
  toCalendarDate,
  todayCalendarDate,
} from "../../shared/calendar";
import type { InstallmentListQuery } from "./installments.schema";

type SafeInstallment = {
  id: string;
  loanId: string;
  loanCode: string | null;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  number: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  chargesDue: number;
  totalDue: number;
  updatedTotalDue: number;
  paidAmount: number;
  remainingBalance: number;
  updatedRemainingBalance: number;
  status: string;
  effectiveStatus: string;
  isOverdue: boolean;
  daysOverdue: number;
  lateCharges: {
    lateFee: number;
    lateInterest: number;
    totalLateCharges: number;
  } | null;
};

function computeDaysOverdue(dueDate: Date, status: string): number {
  if (status === "PAID" || status === "CANCELED") return 0;
  return Math.max(
    0,
    daysBetweenCalendarDates(toCalendarDate(dueDate), todayCalendarDate()),
  );
}

/**
 * Atraso é uma condição calculada (data de vencimento anterior a hoje), não um
 * estado gravado. `effectiveStatus` expõe o rótulo correto sem alterar o
 * `status` persistido da parcela.
 */
function resolveEffectiveStatus(status: string, daysOverdue: number): string {
  const open = status === "PENDING" || status === "PARTIALLY_PAID";
  return open && daysOverdue > 0 ? "OVERDUE" : status;
}

function toSafeInstallment(inst: any): SafeInstallment {
  const daysOverdue = computeDaysOverdue(inst.dueDate, inst.status);

  return {
    id: inst.id,
    loanId: inst.loanId,
    loanCode: inst.loan?.code ?? null,
    clientId: inst.loan.clientId,
    clientName: inst.loan.client?.name ?? null,
    clientPhone: inst.loan.client?.phone ?? null,
    number: inst.number,
    dueDate: inst.dueDate,
    principalDue: Number(inst.principalDue),
    interestDue: Number(inst.interestDue),
    chargesDue: Number(inst.chargesDue),
    totalDue: Number(inst.totalDue),
    updatedTotalDue: Number(inst.totalDue),
    paidAmount: Number(inst.paidAmount),
    remainingBalance: Number(inst.remainingBalance),
    updatedRemainingBalance: Number(inst.remainingBalance),
    status: inst.status,
    effectiveStatus: resolveEffectiveStatus(inst.status, daysOverdue),
    isOverdue: daysOverdue > 0,
    daysOverdue,
    lateCharges: null, // preenchido pelo service quando necessário
  };
}

/**
 * Os saldos persistidos são contratuais. Expomos os valores atualizados sem
 * gravar encargos variáveis (nem alterar o valor original da parcela).
 * paidAmount inclui encargos já recebidos; preservá-los evita que parcelas
 * pagas em atraso voltem a exibir um total menor que o efetivamente pago.
 */
function enrichInstallment(inst: any): SafeInstallment {
  const safe = toSafeInstallment(inst);
  let currentChargesCents = 0;

  if (safe.daysOverdue > 0 && inst.loan.policy) {
    const late = calculateLateCharges({
      overdueAmount: safe.remainingBalance,
      daysOverdue: safe.daysOverdue,
      policy: inst.loan.policy,
    });
    safe.lateCharges = {
      lateFee: late.lateFee,
      lateInterest: late.lateInterest,
      totalLateCharges: late.totalLateCharges,
    };
    currentChargesCents = Math.round(late.totalLateCharges * 100);
  }

  const originalCents = Math.round(safe.totalDue * 100);
  const remainingCents = Math.round(safe.remainingBalance * 100);
  const paidCents = Math.round(safe.paidAmount * 100);
  const paidContractualCents = Math.max(0, originalCents - remainingCents);
  const alreadyPaidChargesCents = Math.max(0, paidCents - paidContractualCents);

  safe.updatedTotalDue = (originalCents + alreadyPaidChargesCents + currentChargesCents) / 100;
  safe.updatedRemainingBalance = (remainingCents + currentChargesCents) / 100;
  return safe;
}

export const installmentsService = {
  async list(query: InstallmentListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.loanId) where.loanId = query.loanId;

    const wantsOverdue = query.overdueOnly === true || query.status === "OVERDUE";
    if (wantsOverdue) {
      where.status = { in: ["PENDING", "PARTIALLY_PAID"] };
      where.dueDate = { lt: calendarDateToUtc(todayCalendarDate()) };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { loan: { code: { contains: query.search, mode: "insensitive" } } },
        { loan: { client: { name: { contains: query.search, mode: "insensitive" } } } },
        { loan: { client: { cpf: { contains: query.search } } } },
      ];
    }

    const [installments, total] = await Promise.all([
      prisma.installment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: wantsOverdue ? [{ dueDate: "asc" }, { remainingBalance: "desc" }] : [{ loanId: "asc" }, { number: "asc" }],
        include: {
          loan: {
            select: {
              id: true,
              code: true,
              clientId: true,
              status: true,
              client: { select: { name: true, phone: true } },
              policy: {
                select: {
                  lateFeeAmount: true,
                  dailyLateInterestPercent: true,
                  toleranceDays: true,
                  roundingMode: true,
                },
              },
            },
          },
        },
      }),
      prisma.installment.count({ where }),
    ]);

    // Encargos calculados na leitura; não alteram o saldo contratual gravado.
    const enriched = installments.map(enrichInstallment);

    return {
      items: enriched,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(id: string) {
    const inst = await prisma.installment.findUnique({
      where: { id },
      include: {
        loan: {
          select: {
            id: true,
            code: true,
            clientId: true,
            status: true,
            client: { select: { name: true, phone: true } },
            policy: true,
          },
        },
      },
    });
    if (!inst) {
      throw new NotFoundError("Parcela não encontrada", "INSTALLMENT_NOT_FOUND");
    }

    return enrichInstallment(inst);
  },

  async pay(id: string, actorId: string, ip?: string, userAgent?: string) {
    const inst = await prisma.installment.findUnique({
      where: { id },
      include: {
        loan: {
          select: {
            id: true,
            code: true,
            clientId: true,
            status: true,
            policy: true,
          },
        },
      },
    });
    if (!inst) {
      throw new NotFoundError("Parcela não encontrada", "INSTALLMENT_NOT_FOUND");
    }
    if (inst.status === "PAID") {
      throw new ConflictError("Parcela já está paga", "INSTALLMENT_ALREADY_PAID");
    }
    if (inst.status === "CANCELED") {
      throw new ConflictError("Parcela cancelada não pode ser paga", "INSTALLMENT_CANCELED");
    }
    if (inst.loan.status !== "ACTIVE") {
      throw new ConflictError("Não é possível baixar parcela de empréstimo não ativo", "LOAN_NOT_ACTIVE");
    }

    const remainingCents = Math.round(Number(inst.remainingBalance) * 100);
    if (remainingCents <= 0) {
      throw new ConflictError("Parcela sem saldo em aberto", "INSTALLMENT_NO_BALANCE");
    }

    const daysOverdue = computeDaysOverdue(inst.dueDate, inst.status);
    const late = inst.loan.policy
      ? calculateLateCharges({
          overdueAmount: remainingCents / 100,
          daysOverdue,
          policy: inst.loan.policy,
        })
      : { lateFee: 0, lateInterest: 0, totalLateCharges: 0 };

    const interestCents = Math.min(remainingCents, Math.round(Number(inst.interestDue) * 100));
    const principalCents = remainingCents - interestCents;
    const chargesCents = Math.round(late.totalLateCharges * 100);
    const receivedCents = remainingCents + chargesCents;

    return paymentsService.register(
      {
        clientId: inst.loan.clientId,
        loanId: inst.loanId,
        receivedAmount: receivedCents / 100,
        receivedAt: new Date().toISOString(),
        method: "CASH",
        reference: `Baixa da parcela ${inst.number}`,
        observations: "Baixa manual pela lista de parcelas",
        allocations: [
          {
            installmentId: id,
            principalAmount: principalCents / 100,
            interestAmount: interestCents / 100,
            chargesAmount: chargesCents / 100,
          },
        ],
      },
      actorId,
      ip,
      userAgent,
    );
  },
};
