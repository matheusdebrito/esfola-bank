import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

type LoanStatusRows = { status: string; total: bigint };
type AmountRow = { principal: Prisma.Decimal };
type MonthRow = { month: string; incoming: Prisma.Decimal; outgoing: Prisma.Decimal };

/** Real, mutually exclusive classifications of active loans, never installment-level guesses. */
export async function getVisualLoanStatus() {
  const [groups, amount] = await Promise.all([
    prisma.$queryRaw<LoanStatusRows[]>`
      SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM "Installment" i
          WHERE i."loanId" = l."id"
            AND i."status" IN ('PENDING', 'PARTIALLY_PAID')
            AND (i."dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        ) THEN 'OVERDUE'
        WHEN EXISTS (
          SELECT 1 FROM "Installment" i
          WHERE i."loanId" = l."id"
            AND i."status" IN ('PENDING', 'PARTIALLY_PAID')
            AND (i."dueDate" AT TIME ZONE 'UTC')::date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
            AND (i."dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 7
        ) THEN 'SOON'
        ELSE 'CURRENT'
      END AS status, COUNT(*)::bigint AS total
      FROM "Loan" l WHERE l."status" = 'ACTIVE'
      GROUP BY 1
    `,
    prisma.loan.aggregate({ _sum: { principalAmount: true }, where: { status: "ACTIVE" } }),
  ]);
  const count = (key: string) => Number(groups.find(row => row.status === key)?.total ?? 0);
  const current = count("CURRENT");
  const soon = count("SOON");
  const overdue = count("OVERDUE");
  return {
    current, soon, overdue, total: current + soon + overdue,
    activePrincipal: Number(amount._sum.principalAmount ?? 0),
    subtitle: "Contratos ativos, classificados pela parcela mais urgente",
  };
}

/** Monthly cash entries, cash exits, and balance from the actual reconciled cash book. */
export async function getVisualCashFlow() {
  const book = await prisma.cashBook.findUnique({ where: { id: 1 } });
  if (!book) return { initialized: false as const, months: [] };
  const rows = await prisma.$queryRaw<MonthRow[]>`
    WITH movements AS (
      SELECT TO_CHAR(p."receivedAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month,
             p."receivedAmount" AS incoming, 0::numeric AS outgoing
      FROM "Payment" p
      WHERE p."status" = 'REGISTERED' AND p."receivedAt" >= ${book.startedAt} AND p."receivedAt" <= NOW()
      UNION ALL
      SELECT TO_CHAR(e."effectiveAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month,
             CASE WHEN e."type" = 'CONTRIBUTION' THEN e."amount" ELSE 0::numeric END AS incoming,
             CASE WHEN e."type" <> 'CONTRIBUTION' THEN e."amount" ELSE 0::numeric END AS outgoing
      FROM "FinanceEntry" e
      WHERE e."reversedAt" IS NULL AND e."effectiveAt" >= ${book.startedAt} AND e."effectiveAt" <= NOW()
    )
    SELECT month, COALESCE(SUM(incoming), 0)::numeric AS incoming,
           COALESCE(SUM(outgoing), 0)::numeric AS outgoing
    FROM movements GROUP BY month ORDER BY month ASC
  `;
  const history = new Map(rows.map(r => [r.month, {
    incoming: Math.round(Number(r.incoming) * 100), outgoing: Math.round(Number(r.outgoing) * 100),
  }]));
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const [year, month] = currentMonth.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(Date.UTC(year, month - 6 + index, 1));
    return d.toISOString().slice(0, 7);
  });
  const earliest = months[0];
  let balanceCents = Math.round(Number(book.openingBalance) * 100);
  const monthsBefore = [...history].filter(([key]) => key < earliest);
  for (const [, r] of monthsBefore) balanceCents += r.incoming - r.outgoing;
  const series = months.map(key => {
    const row = history.get(key) ?? { incoming: 0, outgoing: 0 };
    balanceCents += row.incoming - row.outgoing;
    return { month: key, incoming: row.incoming / 100, outgoing: row.outgoing / 100, balance: balanceCents / 100 };
  });
  return {
    initialized: true as const,
    months: series,
    description: "Entradas: recebimentos e aportes; saídas: despesas, retiradas e desembolsos. Saldo acumulado.",
  };
}
