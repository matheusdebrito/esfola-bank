import type { FinancialPolicy, LoanPeriodicity } from "@prisma/client";

// Arredondamento monetário para 2 casas conforme o modo da política
export function roundMoney(value: number, mode: FinancialPolicy["roundingMode"] = "HALF_UP"): number {
  const scaled = value * 100;
  let rounded: number;
  switch (mode) {
    case "HALF_UP":
      rounded = Math.floor(scaled + 0.5);
      break;
    case "HALF_EVEN": {
      const floor = Math.floor(scaled);
      const frac = scaled - floor;
      if (frac > 0.5) rounded = Math.ceil(scaled);
      else if (frac < 0.5) rounded = floor;
      else rounded = floor % 2 === 0 ? floor : Math.ceil(scaled);
      break;
    }
    case "DOWN":
      rounded = Math.trunc(scaled);
      break;
    case "UP":
      rounded = Math.ceil(scaled);
      break;
    default:
      rounded = Math.floor(scaled + 0.5);
  }
  return rounded / 100;
}

export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  // Prisma Decimal objects expose a `toNumber` method
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export interface InstallmentCalculation {
  number: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  chargesDue: number;
  totalDue: number;
}

// Calcula parcelas com juros flat: o total do empréstimo é
// principal * (1 + taxa%) e é dividido em parcelas iguais.
// A periodicidade define o intervalo entre vencimentos (mensal ou diário).
export function calculateInstallments({
  principal,
  interestRatePercent,
  installmentCount,
  firstDueDate,
  periodicity,
}: {
  principal: number;
  interestRatePercent: number;
  installmentCount: number;
  firstDueDate: Date;
  periodicity: LoanPeriodicity | string;
}): InstallmentCalculation[] {
  const n = Math.max(1, installmentCount);

  const principalCents = Math.round(principal * 100);
  const totalCents = Math.round(principal * (1 + interestRatePercent / 100) * 100);

  const baseTotalCents = Math.floor(totalCents / n);
  const basePrincipalCents = Math.floor(principalCents / n);

  const results: InstallmentCalculation[] = [];
  let assignedPrincipalCents = 0;
  let currentDue = new Date(firstDueDate);

  for (let k = 1; k <= n; k++) {
    const isLast = k === n;
    const installmentTotalCents = isLast ? totalCents - baseTotalCents * (n - 1) : baseTotalCents;
    const installmentPrincipalCents = isLast
      ? principalCents - assignedPrincipalCents
      : basePrincipalCents;

    assignedPrincipalCents += installmentPrincipalCents;

    results.push({
      number: k,
      dueDate: new Date(currentDue),
      principalDue: installmentPrincipalCents / 100,
      interestDue: (installmentTotalCents - installmentPrincipalCents) / 100,
      chargesDue: 0,
      totalDue: installmentTotalCents / 100,
    });

    currentDue = periodicity === "DAILY" ? addDays(currentDue, 1) : addMonths(currentDue, 1);
  }

  return results;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface LateCalculation {
  daysOverdue: number;
  lateFee: number;       // multa fixa por parcela atrasada
  lateInterest: number;  // juros de mora diário sobre o vencido
  totalLateCharges: number;
}

// Calcula encargos de atraso para uma parcela vencida:
// multa fixa (lateFeeAmount) + juros diário sobre o valor vencido,
// considerando os dias de tolerância da política.
export function calculateLateCharges({
  overdueAmount,
  daysOverdue,
  policy,
}: {
  overdueAmount: number;
  daysOverdue: number;
  policy: Pick<
    FinancialPolicy,
    "lateFeeAmount" | "dailyLateInterestPercent" | "toleranceDays" | "roundingMode"
  >;
}): LateCalculation {
  const billableDays = Math.max(0, daysOverdue - (policy.toleranceDays ?? 0));
  if (billableDays <= 0) {
    return { daysOverdue, lateFee: 0, lateInterest: 0, totalLateCharges: 0 };
  }

  const lateFee = roundMoney(toNumber(policy.lateFeeAmount), policy.roundingMode);
  const dailyRate = toNumber(policy.dailyLateInterestPercent) / 100;
  const lateInterest = roundMoney(overdueAmount * dailyRate * billableDays, policy.roundingMode);

  return {
    daysOverdue,
    lateFee,
    lateInterest,
    totalLateCharges: roundMoney(lateFee + lateInterest, policy.roundingMode),
  };
}
