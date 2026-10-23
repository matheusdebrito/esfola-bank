import type { FinancialPolicy } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { calendarDateToUtc, daysBetweenCalendarDates, toCalendarDate, todayCalendarDate } from "../../shared/calendar";
import { calculateLateCharges } from "../financial-policy/calculation.service";

export type LatePolicy = Pick<
  FinancialPolicy,
  "lateFeeAmount" | "dailyLateInterestPercent" | "toleranceDays" | "roundingMode"
>;

export function calculateOutstandingWithLateCharges(input: {
  dueDate: Date;
  remainingBalance: number;
  policy: LatePolicy | null;
  today: string;
}) {
  const daysOverdue = Math.max(0, daysBetweenCalendarDates(toCalendarDate(input.dueDate), input.today));
  const lateCharges = daysOverdue > 0 && input.policy
    ? calculateLateCharges({
        overdueAmount: input.remainingBalance,
        daysOverdue,
        policy: input.policy,
      }).totalLateCharges
    : 0;

  // Somar em centavos preserva a mesma regra de cálculo da tela de parcelas.
  const updatedRemainingBalance =
    (Math.round(input.remainingBalance * 100) + Math.round(lateCharges * 100)) / 100;

  return { daysOverdue, lateCharges, updatedRemainingBalance };
}

export type OverdueInstallmentSnapshot = {
  clientId: string;
  loanId: string;
  clientName: string;
  loanCode: string;
  installmentNumber: number;
  dueDate: Date;
  totalDue: number;
  remainingBalance: number;
  updatedRemainingBalance: number;
  daysOverdue: number;
  lateCharges: number;
};

/**
 * Uma única fonte para os valores vencidos de dashboards, aging e listagens.
 * Consulta somente parcelas abertas vencidas; não altera valores no banco.
 */
export async function loadOverdueInstallments(today: string = todayCalendarDate()): Promise<OverdueInstallmentSnapshot[]> {
  const rows = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
      dueDate: { lt: calendarDateToUtc(today) },
    },
    select: {
      number: true,
      dueDate: true,
      totalDue: true,
      remainingBalance: true,
      loan: {
        select: {
          code: true,
          id: true,
          clientId: true,
          client: { select: { name: true } },
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
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });

  return rows.map((row) => {
    const remainingBalance = Number(row.remainingBalance);
    const amounts = calculateOutstandingWithLateCharges({
      dueDate: row.dueDate,
      remainingBalance,
      policy: row.loan.policy,
      today,
    });
    return {
      clientId: row.loan.clientId,
      loanId: row.loan.id,
      clientName: row.loan.client.name,
      loanCode: row.loan.code,
      installmentNumber: row.number,
      dueDate: row.dueDate,
      totalDue: Number(row.totalDue),
      remainingBalance,
      ...amounts,
    };
  });
}

export function summarizeOverdueInstallments(
  installments: readonly Pick<OverdueInstallmentSnapshot, "updatedRemainingBalance" | "lateCharges">[],
) {
  const { overdueCents, chargesCents } = installments.reduce(
    (sum, item) => ({
      overdueCents: sum.overdueCents + Math.round(item.updatedRemainingBalance * 100),
      chargesCents: sum.chargesCents + Math.round(item.lateCharges * 100),
    }),
    { overdueCents: 0, chargesCents: 0 },
  );
  return { totalOverdue: overdueCents / 100, totalLateCharges: chargesCents / 100 };
}
