import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { cacheService } from "../../shared/cache/cache.service";
import {
  APP_TIME_ZONE,
  calendarDateToUtc,
  todayCalendarDate,
} from "../../shared/calendar";
import type { DashboardQuery } from "./dashboards.schema";
import { loadOverdueInstallments, summarizeOverdueInstallments } from "./overdue-balances";

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

const OPEN_CONDITION = Prisma.sql`"status" IN ('PENDING', 'PARTIALLY_PAID')`;

function dueDatePeriod(query: DashboardQuery, fallbackFrom: Date, fallbackTo: Date) {
  const localDate = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
  const from = calendarDateToUtc(localDate(query.from ? new Date(query.from) : fallbackFrom));
  const to = new Date(calendarDateToUtc(localDate(query.to ? new Date(query.to) : fallbackTo)).getTime() + 86_400_000);
  return { from, to };
}


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
      overdueInstallments,
      receivedRows,
      interestRows,
      portfolioRows,
    ] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan" ${grantedWhere}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Loan" WHERE "status" = 'ACTIVE'`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      loadOverdueInstallments(),
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

    const { totalOverdue, totalLateCharges } = summarizeOverdueInstallments(overdueInstallments);
    const totalReceived = Number(receivedRows[0]?.sum ?? 0);
    const openPortfolio = Number(portfolioRows[0]?.sum ?? 0) + totalLateCharges;
    // Inadimplência = valor vencido / carteira em aberto (não sobre o recebido).
    const delinquencyRate = openPortfolio > 0 ? (totalOverdue / openPortfolio) * 100 : 0;

    const result = {
      totalGranted: Number(totalGrantedRows[0]?.sum ?? 0),
      activeLoans: Number(activeLoansRows[0]?.c ?? 0),
      activeClients: Number(activeClientsRows[0]?.c ?? 0),
      overdueAmount: totalOverdue,
      receivedTotal: totalReceived,
      interestReceived: Number(interestRows[0]?.sum ?? 0),
      overdueInstallments: overdueInstallments.length,
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
    const overdue = await loadOverdueInstallments();
    const { totalOverdue } = summarizeOverdueInstallments(overdue);
    return {
      overdueInstallments: overdue.length,
      overdueAmount: totalOverdue,
      clientsInDefault: new Set(overdue.map((row) => row.clientId)).size,
      items: overdue.slice(0, 100).map((row) => ({
        clientId: row.clientId,
        clientName: row.clientName,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        totalDue: row.totalDue,
        remainingBalance: row.remainingBalance,
        updatedRemainingBalance: row.updatedRemainingBalance,
        lateCharges: row.lateCharges,
        daysOverdue: row.daysOverdue,
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

    const [grantedRows, clientsRows, dueRows, overdueInstallments] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan"`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      prisma.$queryRaw<{ c: bigint; sum: string }[]>`
        SELECT COUNT(*) AS c, COALESCE(SUM("totalDue"), 0) AS sum
        FROM "Installment"
        WHERE ${OPEN_CONDITION} AND "dueDate" >= ${monthStart} AND "dueDate" < ${monthEnd}`,
      loadOverdueInstallments(today),
    ]);

    const dueCount = Number(dueRows[0]?.c ?? 0);
    const overdueThisMonth = overdueInstallments.filter((row) => row.dueDate >= monthStart && row.dueDate < monthEnd);
    const overdueCount = overdueThisMonth.length;

    const result = {
      totalGranted: Number(grantedRows[0]?.sum ?? 0),
      activeClients: Number(clientsRows[0]?.c ?? 0),
      receivableThisMonth: Number(dueRows[0]?.sum ?? 0),
      dueInstallmentsThisMonth: dueCount,
      overdueInstallmentsThisMonth: overdueCount,
      overdueAmountThisMonth: summarizeOverdueInstallments(overdueThisMonth).totalOverdue,
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


    const duePeriod = dueDatePeriod(query, periodFrom, periodTo);
    const dailyGrouping = periodTo.getTime() - periodFrom.getTime() <= 32 * 86_400_000;
    const flowPattern = dailyGrouping ? "YYYY-MM-DD" : "YYYY-MM";

    // --- KPIs ---
    const [
      totalGrantedRows,
      activeLoansRows,
      activeClientsRows,
      overdueInstallments,
      receivedRows,
      interestRows,
      portfolioRows,
      dueTodayRows,
      dueNext7Rows,
      receivableThisMonthRows,
      installmentStatusRows,
      receivedBreakdownRows,
    ] = await Promise.all([
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("principalAmount"), 0) AS sum FROM "Loan"
        WHERE "status" NOT IN ('DRAFT', 'CANCELED')
          AND "grantedAt" >= ${periodFrom} AND "grantedAt" <= ${periodTo}`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Loan" WHERE "status" = 'ACTIVE'`,
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM "Client" WHERE "active" = true`,
      loadOverdueInstallments(),
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
          AND ("dueDate" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE ${APP_TIME_ZONE})::date + INTERVAL '7 days'`,
      prisma.$queryRaw<{ sum: string }[]>`
        SELECT COALESCE(SUM("remainingBalance"), 0) AS sum FROM "Installment"
        WHERE ${OPEN_CONDITION} AND "dueDate" >= ${duePeriod.from} AND "dueDate" < ${duePeriod.to}`,

      prisma.$queryRaw<{ status: string; c: bigint }[]>`
        SELECT "status", COUNT(*) AS c FROM "Installment" GROUP BY "status"`,
      prisma.$queryRaw<{ principal: string; interest: string; charges: string }[]>`
        SELECT COALESCE(SUM(a."principalAmount"), 0) AS principal,
               COALESCE(SUM(a."interestAmount"), 0) AS interest,
               COALESCE(SUM(a."chargesAmount"), 0) AS charges
        FROM "PaymentAllocation" a
        JOIN "Payment" p ON p."id" = a."paymentId"
        WHERE p."status" = 'REGISTERED' AND p."receivedAt" >= ${periodFrom} AND p."receivedAt" <= ${periodTo}`,
    ]);

    const { totalOverdue, totalLateCharges } = summarizeOverdueInstallments(overdueInstallments);
    const totalReceived = Number(receivedRows[0]?.sum ?? 0);
    const openPortfolio = Number(portfolioRows[0]?.sum ?? 0) + totalLateCharges;
    const delinquencyRate = openPortfolio > 0 ? (totalOverdue / openPortfolio) * 100 : 0;

    // installmentStatus (mutually exclusive)
    const statusMap: Record<string, number> = { PAID: 0, PENDING: 0, PARTIALLY_PAID: 0, CANCELED: 0 };
    for (const row of installmentStatusRows) {
      statusMap[row.status] = Number(row.c);
    }
    const overdueCount = overdueInstallments.length;
    const overduePartialCount = await prisma.installment.count({
      where: { status: "PARTIALLY_PAID", dueDate: { lt: calendarDateToUtc(todayStr) } },
    });
    const overduePendingCount = overdueCount - overduePartialCount;
    const installmentStatus = {
      paid: statusMap.PAID ?? 0,
      pending: Math.max(0, (statusMap.PENDING ?? 0) - overduePendingCount),
      partiallyPaid: Math.max(0, (statusMap.PARTIALLY_PAID ?? 0) - overduePartialCount),
      overdue: overdueCount,
      canceled: statusMap.CANCELED ?? 0,
    };

    // --- Aging: utilizar os mesmos saldos corrigidos do KPI ---
    const agingBuckets = ["0-30 dias", "31-60 dias", "61-90 dias", "90+ dias"];
    const agingMap = new Map<string, { cents: number; count: number }>();
    for (const row of overdueInstallments) {
      const bucket = row.daysOverdue <= 30 ? agingBuckets[0]
        : row.daysOverdue <= 60 ? agingBuckets[1]
        : row.daysOverdue <= 90 ? agingBuckets[2] : agingBuckets[3];
      const current = agingMap.get(bucket) ?? { cents: 0, count: 0 };
      current.cents += Math.round(row.updatedRemainingBalance * 100);
      current.count++;
      agingMap.set(bucket, current);
    }
    const aging = agingBuckets.map((bucket) => ({
      bucket,
      amount: (agingMap.get(bucket)?.cents ?? 0) / 100,
      count: agingMap.get(bucket)?.count ?? 0,
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
      ORDER BY "outstandingBalance" DESC`;
    const lateChargesByClient = new Map<string, number>();
    for (const row of overdueInstallments) {
      lateChargesByClient.set(row.clientId, (lateChargesByClient.get(row.clientId) ?? 0) + Math.round(row.lateCharges * 100));
    }
    const topClients = topClientsRows.map((r) => {
      const extraCents = lateChargesByClient.get(r.clientId) ?? 0;
      return {
        clientId: r.clientId,
        clientName: r.clientName,
        outstandingBalance: (Math.round(Number(r.outstandingBalance) * 100) + extraCents) / 100,
        overdueAmount: (Math.round(Number(r.overdueAmount) * 100) + extraCents) / 100,
      };
    }).sort((a, b) => b.outstandingBalance - a.outstandingBalance).slice(0, 5);

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
    const overdueList = overdueInstallments.slice(0, 10).map((row) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      loanCode: row.loanCode,
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      updatedRemainingBalance: row.updatedRemainingBalance,
      lateCharges: row.lateCharges,
      daysOverdue: row.daysOverdue,
    }));

    // --- Receipts series (daily for period) ---
    const receiptsRows = await prisma.$queryRaw<{ day: Date | string; received: string }[]>`
      SELECT TO_CHAR("receivedAt" AT TIME ZONE ${APP_TIME_ZONE}, ${flowPattern}) AS day,
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
        SELECT TO_CHAR("grantedAt" AT TIME ZONE ${APP_TIME_ZONE}, ${flowPattern}) AS month,
               COALESCE(SUM("principalAmount"), 0) AS granted
        FROM "Loan"
        WHERE "status" NOT IN ('DRAFT', 'CANCELED')
          AND "grantedAt" >= ${periodFrom} AND "grantedAt" <= ${periodTo}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: string; received: string }[]>`
        SELECT TO_CHAR("receivedAt" AT TIME ZONE ${APP_TIME_ZONE}, ${flowPattern}) AS month,
               COALESCE(SUM("receivedAmount"), 0) AS received
        FROM "Payment"
        WHERE "status" = 'REGISTERED'
          AND "receivedAt" >= ${periodFrom} AND "receivedAt" <= ${periodTo}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: string; predicted: string }[]>`
        SELECT TO_CHAR("dueDate" AT TIME ZONE 'UTC', ${flowPattern}) AS month,
               COALESCE(SUM("remainingBalance"), 0) AS predicted
        FROM "Installment"
        WHERE "status" IN ('PENDING', 'PARTIALLY_PAID')
          AND "dueDate" >= ${duePeriod.from} AND "dueDate" < ${duePeriod.to}
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
      receivedPrincipal: Number(receivedBreakdownRows[0]?.principal ?? 0),
      receivedInterest: Number(receivedBreakdownRows[0]?.interest ?? 0),
      receivedCharges: Number(receivedBreakdownRows[0]?.charges ?? 0),
      overdueAmount: totalOverdue,
      activeLoans: Number(activeLoansRows[0]?.c ?? 0),
      activeClients: Number(activeClientsRows[0]?.c ?? 0),
      dueToday: Number(dueTodayRows[0]?.c ?? 0),
      dueNext7Days: Number(dueNext7Rows[0]?.c ?? 0),
      overdueInstallments: overdueInstallments.length,
      delinquencyRate: Math.round(delinquencyRate * 100) / 100,
      receivableInPeriod: Number(receivableThisMonthRows[0]?.sum ?? 0),
      overdueClients: new Set(overdueInstallments.map((i) => i.clientId)).size,
      lateChargesOutstanding: totalLateCharges,
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
