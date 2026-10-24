import { Prisma, type FinanceEntryType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import type { CashBookSetupInput, FinanceEntryCreateInput, FinanceListQuery, FinanceReverseInput } from "./finance.schema";

type Database = Prisma.TransactionClient;
const credits = ["CONTRIBUTION"] as const;
const toCents = (n: number | Prisma.Decimal | null | undefined) => Math.round(Number(n ?? 0) * 100);
const reais = (cents: number) => cents / 100;

async function snapshot(tx: Database, startedAt: Date, until: Date) {
  const [payments, allocations, entries] = await Promise.all([
    tx.payment.aggregate({
      _sum: { receivedAmount: true },
      where: { status: "REGISTERED", receivedAt: { gte: startedAt, lte: until } },
    }),
    tx.paymentAllocation.aggregate({
      _sum: { principalAmount: true, interestAmount: true, chargesAmount: true },
      where: { payment: { status: "REGISTERED", receivedAt: { gte: startedAt, lte: until } } },
    }),
    tx.financeEntry.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { reversedAt: null, effectiveAt: { gte: startedAt, lte: until } },
    }),
  ]);
  const total = (type: FinanceEntryType) => toCents(entries.find((entry) => entry.type === type)?._sum.amount);
  const receivedCents = toCents(payments._sum.receivedAmount);
  const principalCents = toCents(allocations._sum.principalAmount);
  const interestCents = toCents(allocations._sum.interestAmount);
  const chargesCents = toCents(allocations._sum.chargesAmount);
  const contributed = total("CONTRIBUTION");
  const withdrawn = total("WITHDRAWAL");
  const expenses = total("EXPENSE");
  const disbursed = total("DISBURSEMENT");
  return {
    receivedCents, principalCents, interestCents, chargesCents,
    contributed, withdrawn, expenses, disbursed,
    deltaCents: contributed + receivedCents - withdrawn - expenses - disbursed,
    operationalResultCents: interestCents + chargesCents - expenses,
  };
}

/** Cálculos de caixa nunca alteram o Payment original nem duplicam seu recebimento em FinanceEntry. */
export const financeService = {
  async overview() {
    const book = await prisma.cashBook.findUnique({ where: { id: 1 } });
    if (!book) return { initialized: false as const };
    const amounts = await snapshot(prisma, book.startedAt, new Date());
    const openCents = toCents(book.openingBalance);
    return {
      initialized: true as const,
      startedAt: book.startedAt,
      openingBalance: reais(openCents),
      availableBalance: reais(openCents + amounts.deltaCents),
      received: reais(amounts.receivedCents),
      principalRecovered: reais(amounts.principalCents),
      interestReceived: reais(amounts.interestCents),
      chargesReceived: reais(amounts.chargesCents),
      contributions: reais(amounts.contributed),
      withdrawals: reais(amounts.withdrawn),
      expenses: reais(amounts.expenses),
      disbursements: reais(amounts.disbursed),
      operationalCashResult: reais(amounts.operationalResultCents),
      note: "Resultado operacional de caixa = juros e encargos recebidos - despesas registradas; não equivale a lucro líquido.",
    };
  },

  async setup(input: CashBookSetupInput, actorId: string, ip?: string, userAgent?: string) {
    try {
      const book = await prisma.$transaction(async (tx) => {
        const created = await tx.cashBook.create({
          data: { id: 1, openingBalance: input.openingBalance, startedAt: new Date(), createdById: actorId },
        });
        await tx.auditLog.create({
          data: { action: "FINANCE_SETUP", entityType: "CashBook", entityId: "1", userId: actorId,
            newValues: { openingBalance: input.openingBalance, startedAt: created.startedAt.toISOString() }, ip, userAgent },
        });
        return created;
      });
      return { startedAt: book.startedAt, openingBalance: Number(book.openingBalance) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("O caixa já foi inicializado; a abertura não pode ser repetida", "CASH_BOOK_ALREADY_INITIALIZED");
      }
      throw error;
    }
  },

  async eligibleLoans() {
    const book = await prisma.cashBook.findUnique({ where: { id: 1 } });
    if (!book) return [];
    const loans = await prisma.loan.findMany({
      where: {
        createdAt: { gte: book.startedAt },
        status: "ACTIVE",
        disbursements: { none: { reversedAt: null } },
        payments: { none: { status: "REGISTERED" } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, code: true, principalAmount: true, client: { select: { name: true } } },
    });
    return loans.map((loan) => ({
      id: loan.id, code: loan.code, clientName: loan.client.name, principalAmount: Number(loan.principalAmount),
    }));
  },

  async register(input: FinanceEntryCreateInput, actorId: string, ip?: string, userAgent?: string) {
    return prisma.$transaction(async (tx) => {
      // Serializa lançamentos e estornos concorrentes; nenhuma saída pode usar o mesmo saldo duas vezes.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(60192623)::text AS locked`;
      const book = await tx.cashBook.findUnique({ where: { id: 1 } });
      if (!book) throw new ConflictError("Informe o saldo inicial antes do primeiro lançamento", "CASH_BOOK_NOT_INITIALIZED");
      if (input.idempotencyKey) {
        const earlier = await tx.financeEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (earlier) {
          if (earlier.type !== input.type || toCents(earlier.amount) !== toCents(input.amount) || earlier.loanId !== (input.loanId ?? null)) {
            throw new ConflictError("Chave de idempotência já usada em outra operação", "FINANCE_IDEMPOTENCY_CONFLICT");
          }
          return earlier;
        }
      }

      if (input.type === "DISBURSEMENT") {
        const loan = await tx.loan.findUnique({
          where: { id: input.loanId! },
          include: { payments: { where: { status: "REGISTERED" }, select: { id: true }, take: 1 } },
        });
        if (!loan) throw new NotFoundError("Empréstimo não encontrado", "LOAN_NOT_FOUND");
        if (loan.status !== "ACTIVE" || loan.createdAt < book.startedAt || loan.payments.length > 0) {
          throw new ConflictError("Somente contratos ativos criados após a abertura e sem pagamentos podem ser desembolsados", "LOAN_NOT_ELIGIBLE_FOR_DISBURSEMENT");
        }
        if (toCents(loan.principalAmount) !== toCents(input.amount)) {
          throw new ValidationError("O desembolso deve corresponder exatamente ao principal contratado", "DISBURSEMENT_AMOUNT_MISMATCH");
        }
        const existing = await tx.financeEntry.findFirst({ where: { loanId: loan.id, reversedAt: null } });
        if (existing) throw new ConflictError("Este empréstimo já possui desembolso registrado", "LOAN_ALREADY_DISBURSED");
      }

      if (input.type !== "CONTRIBUTION") {
        const totals = await snapshot(tx, book.startedAt, new Date());
        const availableCents = toCents(book.openingBalance) + totals.deltaCents;
        if (availableCents < toCents(input.amount)) {
          throw new ConflictError("Saldo disponível insuficiente para essa saída", "INSUFFICIENT_CASH_BALANCE");
        }
      }
      const entry = await tx.financeEntry.create({
        data: {
          bookId: 1, type: input.type, amount: input.amount, effectiveAt: new Date(),
          description: input.description, loanId: input.loanId ?? null,
          idempotencyKey: input.idempotencyKey ?? null, createdById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId, action: "FINANCE_ENTRY_CREATE", entityType: "FinanceEntry", entityId: entry.id,
          newValues: { type: entry.type, amount: Number(entry.amount), loanId: entry.loanId, description: entry.description },
          ip, userAgent,
        },
      });
      return entry;
    });
  },

  async reverse(id: string, input: FinanceReverseInput, actorId: string, ip?: string, userAgent?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(60192623)::text AS locked`;
      const entry = await tx.financeEntry.findUnique({ where: { id } });
      if (!entry) throw new NotFoundError("Lançamento não encontrado", "FINANCE_ENTRY_NOT_FOUND");
      if (entry.reversedAt) throw new ConflictError("Lançamento já estornado", "FINANCE_ENTRY_ALREADY_REVERSED");
      const book = await tx.cashBook.findUniqueOrThrow({ where: { id: 1 } });
      if (entry.type === "CONTRIBUTION") {
        const totals = await snapshot(tx, book.startedAt, new Date());
        if (toCents(book.openingBalance) + totals.deltaCents < toCents(entry.amount)) {
          throw new ConflictError("Não é possível estornar o aporte: caixa insuficiente", "INSUFFICIENT_CASH_BALANCE");
        }
      }
      if (entry.type === "DISBURSEMENT" && entry.loanId) {
        const payments = await tx.payment.count({ where: { loanId: entry.loanId, status: "REGISTERED" } });
        if (payments) throw new ConflictError("Empréstimo com pagamentos: desembolso não pode ser estornado", "DISBURSEMENT_HAS_PAYMENTS");
      }
      const reversed = await tx.financeEntry.update({
        where: { id }, data: { reversedAt: new Date(), reversedById: actorId, reversalReason: input.justification },
      });
      await tx.auditLog.create({
        data: { userId: actorId, action: "FINANCE_ENTRY_REVERSE", entityType: "FinanceEntry", entityId: id,
          oldValues: { type: entry.type, amount: Number(entry.amount), status: "ACTIVE" },
          newValues: { status: "REVERSED", justification: input.justification }, ip, userAgent },
      });
      return reversed;
    });
  },

  async list(query: FinanceListQuery) {
    const book = await prisma.cashBook.findUnique({ where: { id: 1 } });
    if (!book) return { items: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
    const from = query.from ? new Date(Math.max(book.startedAt.getTime(), new Date(query.from).getTime())) : book.startedAt;
    const to = query.to ? new Date(query.to) : new Date();
    if (to < from) return { items: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
    const typeFilter = query.type && query.type !== "ALL" ? Prisma.sql` AND "type" = ${query.type}` : Prisma.empty;
    const filters = Prisma.sql`WHERE "date" >= ${from} AND "date" <= ${to}${typeFilter}`;
    const union = Prisma.sql`
      SELECT e."id"::text AS id, e."type"::text AS type, e."amount"::numeric AS amount,
             e."effectiveAt" AS date, e."description" AS description,
             e."loanId"::text AS "loanId", e."reversedAt" IS NOT NULL AS reversed,
             'MANUAL'::text AS source
        FROM "FinanceEntry" e
      UNION ALL
      SELECT p."id"::text AS id, 'PAYMENT'::text AS type, p."receivedAmount"::numeric AS amount,
             p."receivedAt" AS date, CONCAT('Recebimento ', l."code", ' - ', c."name") AS description,
             p."loanId"::text AS "loanId", p."status" = 'REVERSED' AS reversed,
             'PAYMENT'::text AS source
        FROM "Payment" p JOIN "Loan" l ON l."id" = p."loanId" JOIN "Client" c ON c."id" = p."clientId"`;
    const offset = (query.page - 1) * query.pageSize;
    const [rows, counts] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; type: string; amount: Prisma.Decimal; date: Date; description: string; loanId: string | null; reversed: boolean; source: string }>>`
        SELECT * FROM (${union}) movements ${filters}
        ORDER BY date DESC, id DESC LIMIT ${query.pageSize} OFFSET ${offset}`,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (${union}) movements ${filters}`,
    ]);
    const total = Number(counts[0]?.count ?? 0);
    return {
      items: rows.map((row) => ({ ...row, amount: Number(row.amount) })),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  },
};
