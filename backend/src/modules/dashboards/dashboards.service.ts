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

async overview(query: DashboardQuery) {
    const cacheKey = cacheService.buildKey("dashboards", "overview", JSON.stringify(query));
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    // Default period: current month in Brasília
    const todayStr = todayCalendarDate();
    const [defY, defM] = todayStr.split("-").map(Number);
    const defaultFrom = calendarDateToUtc(`${defY}-${String(defM).padStart(2, "0")}-01`);
    const nextMonthStr = defM === 12
      ? `${defY + 1}-01-01`
      : `${defY}-${String(defM + 1).padStart(2, "0")}-01`;
    const defaultTo = new Date(calendarDateToUtc(nextMonthStr).getTime() - 1);

    const periodFrom = from ?? defaultFrom;
    const periodTo = to ?? defaultTo;

    const todayStart = calendarDateToUtc(todayStr);
    const next7Days = calendarDateToUtc(
      new Date(Date.parse(`${todayStr}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10),
    );
    const monthStart = calendarDateToUtc(`${todayStr.slice(0, 7)}-01`);
    const nextMonth = todayStr.slice(5, 7) === "12"
      ? `${Number(todayStr.slice(0, 4)) + 1}-01-01`
      : `${todayStr.slice(0, 4)}-${String(Number(todayStr.slice(5, 7)) + 1).padStart(2, "0")}-01`;
    const monthEnd = calendarDateToUtc(nextMonth);

    const grantedWhere = periodFilter("grantedAt", query);
    const receivedWhere = periodFilter("receivedAt", query);

    // --- KPIs ---
    const [
      totalGrantedRows,
      activeLoansRows,
      activeClientsRows,
      overdueRows,
      overdueCountRows,
      receivedRows,
      interestRows,
      portfolioRows,
      dueTodayRows,
      dueNext7Rows,
      receivableThisMonthRows,
      installmentStatusRows,
    ] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan"
        WHERE "status" NOT IN ('DRAFT', 'CANCELED')
          AND "grantedAt" >= ${periodFrom} AND "grantedAt" <= ${periodTo}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Loan" WHERE "status" = 'ACTIVE'`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("remainingBalance"), 0) AS sum FROM "Installment" WHERE ${OVERDUE_CONDITION}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Installment" WHERE ${OVERDUE_CONDITION}`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("receivedAmount"), 0) AS sum FROM "Payment"
        WHERE "status" = 'REGISTERED' AND "receivedAt" >= ${periodFrom} AND "receivedAt" <= ${periodTo}`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM(a."interestAmount"), 0) AS sum
        FROM "PaymentAllocation" a
        JOIN "Payment" p ON a."paymentId" = p."id"
        WHERE p."status" = 'REGISTERED' AND p."receivedAt" >= ${periodFrom} AND p."receivedAt" <= ${periodTo}`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("remainingBalance"), 0) AS sum FROM "Installment" WHERE ${OPEN_CONDITION}`,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM "Installment"
        WHERE "status" IN ('PENDING', 'PARTIALLY_PAID')
          AND ("dueDate" AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date`,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM "Installment"
        WHERE "status" IN ('PENDING', 'PARTIALLY_PAID')
          AND ("dueDate" AT TIME ZONE 'UTC')::date >= (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date
          AND ("dueDate" AT TIME ZONE 'UTC')::date <= (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date + INTERVAL '7 days'`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("totalDue"), 0) AS sum FROM "Installment"
        WHERE ${OPEN_CONDITION} AND "dueDate" >= ${periodFrom} AND "dueDate" <= ${periodTo}`,

      prisma.$queryRaw<{ status: string; c: bigint }[]>`
        SELECT "status", COUNT(*) AS c FROM "Installment" GROUP BY "status"`,
    ]);

    const totalOverdue = Number(overdueRows[0]?.sum ?? 0);
    const totalReceived = Number(receivedRows[0]?.sum ?? 0);
    const openPortfolio = Number(portfolioRows[0]?.sum ?? 0);
    const delinquencyRate = openPortfolio > 0 ? (totalOverdue / openPortfolio) * 100 : 0;

    // installmentStatus (mutually exclusive)
    const statusMap: Record<string, number> = { PAID: 0, PENDING: 0, PARTIALLY_PAID: 0, CANCELED: 0 };
    for (const row of installmentStatusRows) {
      statusMap[row.status] = Number(row.c);
    }
    const overdueCount = Number(overdueCountRows[0]?.c ?? 0);
    const installmentStatus = {
      paid: statusMap.PAID ?? 0,
      pending: Math.max(0, (statusMap.PENDING ?? 0) - overdueCount),
      partiallyPaid: statusMap.PARTIALLY_PAID ?? 0,
      overdue: overdueCount,
      canceled: statusMap.CANCELED ?? 0,
    };

    // --- Aging ---
    const agingRows = await prisma.$queryRaw<{ bucket: string; amount: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN days_overdue <= 30 THEN '0-30 dias'
          WHEN days_overdue <= 60 THEN '31-60 dias'
          WHEN days_overdue <= 90 THEN '61-90 dias'
          ELSE '90+ dias'
        END AS bucket,
        COALESCE(SUM("remainingBalance"), 0) AS amount,
        COUNT(*) AS count
      FROM (
        SELECT "remainingBalance",
          (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date - ("dueDate" AT TIME ZONE 'UTC')::date AS days_overdue
        FROM "Installment"
        WHERE "status" IN ('PENDING', 'PARTIALLY_PAID')
          AND ("dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date
      ) sub
      GROUP BY 1
      ORDER BY 1`;
    const agingBuckets = ["0-30 dias", "31-60 dias", "61-90 dias", "90+ dias"];
    const agingMap = new Map(agingRows.map((r) => [r.bucket, { amount: Number(r.amount), count: Number(r.count) }]));
    const aging = agingBuckets.map((b) => ({
      bucket: b,
      amount: agingMap.get(b)?.amount ?? 0,
      count: agingMap.get(b)?.count ?? 0,
    }));

    // --- Top clients ---
    const topClientsRows = await prisma.$queryRaw<{
      clientId: string;
      clientName: string;
      outstandingBalance: string;
      overdueAmount: string;
    }[]>`
      SELECT
        l."clientId" AS "clientId",
        c."name" AS "clientName",
        COALESCE(SUM(i."remainingBalance"), 0) AS "outstandingBalance",
        COALESCE(SUM(CASE WHEN (i."dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date THEN i."remainingBalance" ELSE 0 END), 0) AS "overdueAmount"
      FROM "Installment" i
      JOIN "Loan" l ON i."loanId" = l."id"
      JOIN "Client" c ON l."clientId" = c."id"
      WHERE i."status" IN ('PENDING', 'PARTIALLY_PAID')
      GROUP BY l."clientId", c."name"
      ORDER BY "outstandingBalance" DESC
      LIMIT 5`;
    const topClients = topClientsRows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      outstandingBalance: Number(r.outstandingBalance),
      overdueAmount: Number(r.overdueAmount),
    }));

    // --- Upcoming due (next 10) ---
    const upcomingDueRows = await prisma.$queryRaw<{
      clientId: string;
      clientName: string;
      loanCode: string;
      installmentNumber: number;
      dueDate: Date;
      remainingBalance: string;
      status: string;
    }[]>`
      SELECT
        l."clientId" AS "clientId",
        c."name" AS "clientName",
        l."code" AS "loanCode",
        i."number" AS "installmentNumber",
        i."dueDate" AS "dueDate",
        i."remainingBalance" AS "remainingBalance",
        i."status" AS "status"
      FROM "Installment" i
      JOIN "Loan" l ON i."loanId" = l."id"
      JOIN "Client" c ON l."clientId" = c."id"
      WHERE i."status" IN ('PENDING', 'PARTIALLY_PAID')
        AND (i."dueDate" AT TIME ZONE 'UTC')::date >= (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date
      ORDER BY i."dueDate" ASC
      LIMIT 10`;
    const upcomingDue = upcomingDueRows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      loanCode: r.loanCode,
      installmentNumber: r.installmentNumber,
      dueDate: r.dueDate,
      remainingBalance: Number(r.remainingBalance),
      status: r.status,
    }));

    // --- Overdue list (top 10) ---
    const overdueListRows = await prisma.$queryRaw<{
      clientId: string;
      clientName: string;
      loanCode: string;
      installmentNumber: number;
      dueDate: Date;
      remainingBalance: string;
    }[]>`
      SELECT
        l."clientId" AS "clientId",
        c."name" AS "clientName",
        l."code" AS "loanCode",
        i."number" AS "installmentNumber",
        i."dueDate" AS "dueDate",
        i."remainingBalance" AS "remainingBalance"
      FROM "Installment" i
      JOIN "Loan" l ON i."loanId" = l."id"
      JOIN "Client" c ON l."clientId" = c."id"
      WHERE i."status" IN ('PENDING', 'PARTIALLY_PAID')
        AND (i."dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date
      ORDER BY i."dueDate" ASC
      LIMIT 10`;
    const overdueList = overdueListRows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      loanCode: r.loanCode,
      installmentNumber: r.installmentNumber,
      dueDate: r.dueDate,
      remainingBalance: Number(r.remainingBalance),
      daysOverdue: Math.max(0, Math.floor(
        (Date.now() - new Date(r.dueDate).getTime()) / 86_400_000,
      )),
    }));

    // --- Receipts series (daily for period) ---
    const receiptsRows = await prisma.$queryRaw<{ day: Date | string; received: string }[]>`
      SELECT (DATE_TRUNC('day', "receivedAt" AT TIME ZONE ${APP_TIME_ZONE}))::date AS day,
             COALESCE(SUM("receivedAmount"), 0) AS received
      FROM "Payment"
      WHERE "status" = 'REGISTERED'
        AND "receivedAt" >= ${periodFrom} AND "receivedAt" <= ${periodTo}
      GROUP BY 1
      ORDER BY 1`;
    const receiptsSeries = receiptsRows.map((r) => ({
      day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      received: Number(r.received),
    }));

    // --- Financial flow (monthly for period) ---
    const [grantedRows, receivedMonthlyRows, predictedRows] = await Promise.all([
      prisma.$queryRaw<{ month: string; granted: string }[]>`
        SELECT TO_CHAR("grantedAt" AT TIME ZONE ${APP_TIME_ZONE}, 'YYYY-MM') AS month,
               COALESCE(SUM("principalAmount"), 0) AS granted
        FROM "Loan"
        WHERE "status" NOT IN ('DRAFT', 'CANCELED')
          AND "grantedAt" >= ${periodFrom} AND "grantedAt" <= ${periodTo}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: string; received: string }[]>`
        SELECT TO_CHAR("receivedAt" AT TIME ZONE ${APP_TIME_ZONE}, 'YYYY-MM') AS month,
               COALESCE(SUM("receivedAmount"), 0) AS received
        FROM "Payment"
        WHERE "status" = 'REGISTERED'
          AND "receivedAt" >= ${periodFrom} AND "receivedAt" <= ${periodTo}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: string; predicted: string }[]>`
        SELECT TO_CHAR("dueDate" AT TIME ZONE ${APP_TIME_ZONE}, 'YYYY-MM') AS month,
               COALESCE(SUM("totalDue"), 0) AS predicted
        FROM "Installment"
        WHERE "status" IN ('PENDING', 'PARTIALLY_PAID')
          AND "dueDate" >= ${periodFrom} AND "dueDate" <= ${periodTo}
        GROUP BY 1 ORDER BY 1`,
    ]);

    const monthSet = new Set<string>();
    grantedRows.forEach((r) => monthSet.add(r.month));
    receivedMonthlyRows.forEach((r) => monthSet.add(r.month));
    predictedRows.forEach((r) => monthSet.add(r.month));

    const grantedMap = new Map(grantedRows.map((r) => [r.month, Number(r.granted)]));
    const receivedMap = new Map(receivedMonthlyRows.map((r) => [r.month, Number(r.received)]));
    const predictedMap = new Map(predictedRows.map((r) => [r.month, Number(r.predicted)]));

    const financialFlow = Array.from(monthSet)
      .sort()
      .map((m) => ({
        month: m,
        granted: grantedMap.get(m) ?? 0,
        received: receivedMap.get(m) ?? 0,
        predicted: predictedMap.get(m) ?? 0,
      }));

    // --- Portfolio composition ---
    const portfolioComposition = [
      { name: "Em aberto", value: Math.max(0, openPortfolio - totalOverdue) },
      { name: "Vencido", value: totalOverdue },
    ];

    const result = {
      // KPIs
      totalGranted: Number(totalGrantedRows[0]?.sum ?? 0),
      openPortfolio,
      receivedTotal: totalReceived,
      interestReceived: Number(interestRows[0]?.sum ?? 0),
      overdueAmount: totalOverdue,
      activeLoans: Number(activeLoansRows[0]?.c ?? 0),
      activeClients: Number(activeClientsRows[0]?.c ?? 0),
      dueToday: Number(dueTodayRows[0]?.c ?? 0),
      dueNext7Days: Number(dueNext7Rows[0]?.c ?? 0),
      overdueInstallments: Number(overdueCountRows[0]?.c ?? 0),
      delinquencyRate: Math.round(delinquencyRate * 100) / 100,
      receivableInPeriod: Number(receivableThisMonthRows[0]?.sum ?? 0),
      // Charts
      receiptsSeries,
      financialFlow,
      portfolioComposition,
      installmentStatus,
      aging,
      // Tables
      topClients,
      upcomingDue,
      overdueList,
    };

    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },

  async upcomingDue(page: number = 1, pageSize: number = 10, search?: string) {
    const skip = (page - 1) * pageSize;
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`i."status" IN ('PENDING', 'PARTIALLY_PAID')`,
      Prisma.sql`(i."dueDate" AT TIME ZONE 'UTC')::date >= (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date`,
    ];
    if (search) {
      whereConditions.push(
        Prisma.sql`(c."name" ILIKE ${'%' + search + '%'} OR l."code" ILIKE ${'%' + search + '%'})`,
      );
    }
    const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}`;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<{
        clientId: string;
        clientName: string;
        loanCode: string;
        installmentNumber: number;
        dueDate: Date;
        remainingBalance: string;
        status: string;
      }[]>`
        SELECT
          l."clientId" AS "clientId",
          c."name" AS "clientName",
          l."code" AS "loanCode",
          i."number" AS "installmentNumber",
          i."dueDate" AS "dueDate",
          i."remainingBalance" AS "remainingBalance",
          i."status" AS "status"
        FROM "Installment" i
        JOIN "Loan" l ON i."loanId" = l."id"
        JOIN "Client" c ON l."clientId" = c."id"
        ${whereClause}
        ORDER BY i."dueDate" ASC
        LIMIT ${pageSize} OFFSET ${skip}`,
      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total
        FROM "Installment" i
        JOIN "Loan" l ON i."loanId" = l."id"
        JOIN "Client" c ON l."clientId" = c."id"
        ${whereClause}`,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const items = rows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      loanCode: r.loanCode,
      installmentNumber: r.installmentNumber,
      dueDate: r.dueDate,
      remainingBalance: Number(r.remainingBalance),
      status: r.status,
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
};
