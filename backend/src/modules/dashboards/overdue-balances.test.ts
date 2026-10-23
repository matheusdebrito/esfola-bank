import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateOutstandingWithLateCharges,
  computeInstallmentStatusCounts,
  summarizeOverdueInstallments,
  type LatePolicy,
} from "./overdue-balances";

const policy: LatePolicy = {
  lateFeeAmount: new Prisma.Decimal("10"),
  dailyLateInterestPercent: new Prisma.Decimal("0.33"),
  toleranceDays: 0,
  roundingMode: "HALF_UP",
};
const today = "2026-10-23";
const dueDate = new Date("2026-10-18T00:00:00.000Z");

describe("valores vencidos nos dashboards", () => {
  it("inclui multa e juros diários no saldo vencido", () => {
    const result = calculateOutstandingWithLateCharges({ dueDate, remainingBalance: 55, policy, today });
    expect(result).toEqual({ daysOverdue: 5, lateCharges: 10.91, updatedRemainingBalance: 65.91 });
  });

  it("usa somente o saldo contratual restante após pagamentos parciais", () => {
    const result = calculateOutstandingWithLateCharges({ dueDate, remainingBalance: 35, policy, today });
    expect(result).toEqual({ daysOverdue: 5, lateCharges: 10.58, updatedRemainingBalance: 45.58 });
  });

  it("respeita tolerância sem cobrar multa antecipadamente", () => {
    const result = calculateOutstandingWithLateCharges({
      dueDate, remainingBalance: 55, today, policy: { ...policy, toleranceDays: 5 },
    });
    expect(result).toEqual({ daysOverdue: 5, lateCharges: 0, updatedRemainingBalance: 55 });
  });

  it("não cobra mora no vencimento nem sem uma política vinculada", () => {
    expect(calculateOutstandingWithLateCharges({
      dueDate: new Date("2026-10-23T00:00:00.000Z"), remainingBalance: 55, policy, today,
    }).updatedRemainingBalance).toBe(55);
    expect(calculateOutstandingWithLateCharges({
      dueDate, remainingBalance: 55, policy: null, today,
    }).updatedRemainingBalance).toBe(55);
  });

  it("soma em centavos sem arredondamentos acumulados", () => {
    const summary = summarizeOverdueInstallments([
      { updatedRemainingBalance: 65.91, lateCharges: 10.91 },
      { updatedRemainingBalance: 45.58, lateCharges: 10.58 },
    ]);
    expect(summary).toEqual({ totalOverdue: 111.49, totalLateCharges: 21.49 });
  });
  it("classifica parcelas vencidas sem duplicar parciais ou omitir pendentes", () => {
    const counts = { PAID: 2, PENDING: 3, PARTIALLY_PAID: 2, CANCELED: 1 };
    const overdue = [{ status: "PENDING" }, { status: "PARTIALLY_PAID" }];
    const result = computeInstallmentStatusCounts(counts, overdue);
    expect(result).toEqual({ paid: 2, pending: 2, partiallyPaid: 1, overdue: 2, canceled: 1 });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(8);
  });

});
