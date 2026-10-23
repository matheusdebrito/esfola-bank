import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { cacheService } from "../../shared/cache/cache.service";
import {
  APP_TIME_ZONE,
  calendarDateToUtc,
  todayCalendarDate,
} from "../../shared/calendar";
import type { DashboardQuery } from "./dashboards.schema";

const DASHBOARD_TTL = 60; // segundos

type DateColumn = "grantedAt" | "receivedAt" | "registeredAt";

/**
 * Condição de período parametrizada (sem interpolação de valores).
 * A coluna vem de uma união fechada de identificadores internos.
 */
function periodFilter(dateColumn: DateColumn, query: DashboardQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (query.from) {
    conditions.push(Prisma.sql`${Prisma.raw(`"${dateColumn}"`)} >= ${new Date(query.from)}`);
  }
  if (query.to) {
    conditions.push(Prisma.sql`${Prisma.raw(`"${dateColumn}"`)} <= ${new Date(query.to)}`);
  }
  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function overdueCondition(alias = ""): Prisma.Sql {
  const column = (name: string) => Prisma.raw(`${alias}"${name}"`);
  return Prisma.sql`${column("status")} IN ('PENDING', 'PARTIALLY_PAID')
  AND (${column("dueDate")} AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date`;
}

const OVERDUE_CONDITION = overdueCondition();

const OPEN_CONDITION = Prisma.sql`"status" IN ('PENDING', 'PARTIALLY_PAID')`;

export const dashboardsService = {
  async executive(query: DashboardQuery) {
    const cacheKey = cacheService.buildKey("dashboards", "executive", JSON.stringify(query));
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const grantedWhere = periodFilter("grantedAt", query);
    const receivedWhere = periodFilter("receivedAt", query);

    const [
      totalGrantedRows,
      activeLoansRows,
      activeClientsRows,
      overdueRows,
      overdueCountRows,
      receivedRows,
      interestRows,
      portfolioRows,
    ] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan" ${grantedWhere}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Loan" WHERE "status" = 'ACTIVE'`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("remainingBalance"), 0) AS sum FROM "Installment" WHERE ${OVERDUE_CONDITION}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Installment" WHERE ${OVERDUE_CONDITION}`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("receivedAmount"), 0) AS sum FROM "Payment"
        WHERE "status" = 'REGISTERED' ${receivedWhere}`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM(a."interestAmount"), 0) AS sum
        FROM "PaymentAllocation" a
        JOIN "Payment" p ON a."paymentId" = p."id"
        WHERE p."status" = 'REGISTERED'`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("remainingBalance"), 0) AS sum FROM "Installment" WHERE ${OPEN_CONDITION}`,
    ]);

    const totalOverdue = Number(overdueRows[0]?.sum ?? 0);
    const totalReceived = Number(receivedRows[0]?.sum ?? 0);
    const openPortfolio = Number(portfolioRows[0]?.sum ?? 0);
    // Inadimplência = valor vencido / carteira em aberto (não sobre o recebido).
    const delinquencyRate = openPortfolio > 0 ? (totalOverdue / openPortfolio) * 100 : 0;

    const result = {
      totalGranted: Number(totalGrantedRows[0]?.sum ?? 0),
      activeLoans: Number(activeLoansRows[0]?.c ?? 0),
      activeClients: Number(activeClientsRows[0]?.c ?? 0),
      overdueAmount: totalOverdue,
      receivedTotal: totalReceived,
      interestReceived: Number(interestRows[0]?.sum ?? 0),
      overdueInstallments: Number(overdueCountRows[0]?.c ?? 0),
      openPortfolio,
      delinquencyRate: Math.round(delinquencyRate * 100) / 100,
    };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },

  async financial(query: DashboardQuery) {
    const cacheKey = cacheService.buildKey("dashboards", "financial", JSON.stringify(query));
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const receivedWhere = periodFilter("receivedAt", query);
    const rows = await prisma.$queryRaw<{ day: Date | string; received: string }[]>`
      SELECT (DATE_TRUNC('day', "receivedAt" AT TIME ZONE ${APP_TIME_ZONE}))::date AS day,
             COALESCE(SUM("receivedAmount"), 0) AS received
      FROM "Payment"
      WHERE "status" = 'REGISTERED' ${receivedWhere}
      GROUP BY 1
      ORDER BY 1`;

    const result = {
      series: rows.map((r) => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
        received: Number(r.received),
      })),
    };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },

  async defaults(_query: DashboardQuery) {
    const overdue = await prisma.$queryRaw<
      {
        clientId: string;
        clientName: string;
        number: number;
        dueDate: Date;
        totalDue: string;
        remainingBalance: string;
      }[]
    >`
      SELECT l."clientId" AS "clientId",
             c."name" AS "clientName",
             i."number" AS "number",
             i."dueDate" AS "dueDate",
             i."totalDue" AS "totalDue",
             i."remainingBalance" AS "remainingBalance"
      FROM "Installment" i
      JOIN "Loan" l ON i."loanId" = l."id"
      JOIN "Client" c ON l."clientId" = c."id"
      WHERE ${overdueCondition('i.')}
      ORDER BY i."dueDate" ASC
      LIMIT 100`;

    const totalOverdue = overdue.reduce((sum, row) => sum + Number(row.remainingBalance), 0);

    return {
      overdueInstallments: overdue.length,
      overdueAmount: totalOverdue,
      clientsInDefault: new Set(overdue.map((row) => row.clientId)).size,
      items: overdue.map((row) => ({
        clientId: row.clientId,
        clientName: row.clientName,
        installmentNumber: row.number,
        dueDate: row.dueDate,
        totalDue: Number(row.totalDue),
        remainingBalance: Number(row.remainingBalance),
      })),
    };
  },

  async operational(query: DashboardQuery) {
    const grantedWhere = periodFilter("grantedAt", query);
    const receivedWhere = periodFilter("receivedAt", query);

    const [loansCreatedRows, paymentsRegisteredRows, byUserRows] = await Promise.all([
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Loan" ${grantedWhere}`,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM "Payment" WHERE "status" = 'REGISTERED' ${receivedWhere}`,
      prisma.$queryRaw<{ userName: string; loans: bigint }[]>`
        SELECT u."name" AS "userName", COUNT(*) AS loans
        FROM "Loan" l
        JOIN "User" u ON l."userId" = u."id"
        ${grantedWhere}
        GROUP BY u."name"
        ORDER BY loans DESC
        LIMIT 10`,
    ]);

    return {
      loansCreated: Number(loansCreatedRows[0]?.c ?? 0),
      paymentsRegistered: Number(paymentsRegisteredRows[0]?.c ?? 0),
      byUser: byUserRows.map((row) => ({ user: row.userName, loans: Number(row.loans) })),
    };
  },

  async fiscalization(query: DashboardQuery) {
    const statusChanges = await prisma.auditLog.findMany({
      where: {
        action: "LOAN_STATUS_CHANGE",
        createdAt: query.from ? { gte: new Date(query.from) } : undefined,
        ...(query.to ? { lte: new Date(query.to) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    });
    const reversals = await prisma.payment.findMany({
      where: {
        status: "REVERSED",
        ...(query.from ? { registeredAt: { gte: new Date(query.from) } } : {}),
        ...(query.to ? { registeredAt: { lte: new Date(query.to) } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return { statusChanges, reversals };
  },

  async monthly() {
    const cacheKey = cacheService.buildKey("dashboards", "monthly");
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const today = todayCalendarDate(); // YYYY-MM-DD no fuso de Brasília
    const [year, month] = today.split("-").map(Number);
    const monthStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const monthEndDate = `${nextMonth.year}-${String(nextMonth.month).padStart(2, "0")}-01`;

    const monthStart = calendarDateToUtc(monthStartDate);
    const monthEnd = calendarDateToUtc(monthEndDate);
    const todayStart = calendarDateToUtc(today);

    const [grantedRows, clientsRows, dueRows, overdueRows] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan"`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      prisma.$queryRaw<{ c: bigint; sum: string }[]>`
        SELECT COUNT(*) AS c, COALESCE(SUM("totalDue"), 0) AS sum
        FROM "Installment"
        WHERE ${OPEN_CONDITION} AND "dueDate" >= ${monthStart} AND "dueDate" < ${monthEnd}`,
      prisma.$queryRaw<{ c: bigint; sum: string }[]>`
        SELECT COUNT(*) AS c, COALESCE(SUM("remainingBalance"), 0) AS sum
        FROM "Installment"
        WHERE ${OPEN_CONDITION}
          AND "dueDate" >= ${monthStart} AND "dueDate" < ${monthEnd}
          AND "dueDate" < ${todayStart}`,
    ]);

    const dueCount = Number(dueRows[0]?.c ?? 0);
    const overdueCount = Number(overdueRows[0]?.c ?? 0);

    const result = {
      totalGranted: Number(grantedRows[0]?.sum ?? 0),
      activeClients: Number(clientsRows[0]?.c ?? 0),
      receivableThisMonth: Number(dueRows[0]?.sum ?? 0),
      dueInstallmentsThisMonth: dueCount,
      overdueInstallmentsThisMonth: overdueCount,
      overdueAmountThisMonth: Number(overdueRows[0]?.sum ?? 0),
      currentInstallmentsThisMonth: Math.max(0, dueCount - overdueCount),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
    };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },
};
