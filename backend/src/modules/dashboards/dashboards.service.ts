import { prisma } from "../../config/prisma";
import { cacheService } from "../../shared/cache/cache.service";
import type { DashboardQuery } from "./dashboards.schema";

const DASHBOARD_TTL = 60; // segundos

function period(query: DashboardQuery, dateColumn = "grantedAt") {
  const cond: string[] = [];
  const params: any[] = [];
  if (query.from) {
    cond.push(`"${dateColumn}" >= $${params.length + 1}`);
    params.push(new Date(query.from));
  }
  if (query.to) {
    cond.push(`"${dateColumn}" <= $${params.length + 1}`);
    params.push(new Date(query.to));
  }
  return { cond: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

export const dashboardsService = {
  async executive(query: DashboardQuery) {
    const cacheKey = cacheService.buildKey("dashboards", "executive", JSON.stringify(query));
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { cond, params } = period(query);

    const [totalGranted, activeLoans, activeClients, overdueAmount, received] = await Promise.all([
      prisma.$queryRawUnsafe<{ sum: string }[]>(`SELECT COALESCE(SUM("principalAmount"),0) as sum FROM "Loan" ${period(query).cond}`, ...period(query).params),
      prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Loan" WHERE status='ACTIVE'`),
      prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Client" WHERE active=true`),
      prisma.$queryRawUnsafe<{ sum: string }[]>(`SELECT COALESCE(SUM("remainingBalance"),0) as sum FROM "Installment" WHERE status IN ('PENDING','PARTIALLY_PAID') AND "dueDate" < NOW()`),
      prisma.$queryRawUnsafe<{ sum: string }[]>(`SELECT COALESCE(SUM("receivedAmount"),0) as sum FROM "Payment" WHERE status='REGISTERED' ${period(query, "receivedAt").cond}`, ...period(query, "receivedAt").params),
    ]);
    const interestReceived = await prisma.$queryRawUnsafe<{ sum: string }[]>(
      `SELECT COALESCE(SUM(a."interestAmount"),0) as sum FROM "PaymentAllocation" a JOIN "Payment" p ON a."paymentId"=p."id" WHERE p.status='REGISTERED'`,
    );

    const installmentsOverdue = await prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Installment" WHERE status IN ('PENDING','PARTIALLY_PAID') AND "dueDate" < NOW()`);

    const totalOverdue = Number(overdueAmount[0]?.sum ?? 0);
    const totalReceived = Number(received[0]?.sum ?? 0);
    const delinquencyRate = totalReceived > 0 ? (totalOverdue / totalReceived) * 100 : 0;

    const result = {
      totalGranted: Number(totalGranted[0]?.sum ?? 0),
      activeLoans: Number(activeLoans[0]?.c ?? 0),
      activeClients: Number(activeClients[0]?.c ?? 0),
      overdueAmount: totalOverdue,
      receivedTotal: totalReceived,
      interestReceived: Number(interestReceived[0]?.sum ?? 0),
      overdueInstallments: Number(installmentsOverdue[0]?.c ?? 0),
      delinquencyRate: Math.round(delinquencyRate * 100) / 100,
    };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },

  async financial(query: DashboardQuery) {
    const cacheKey = cacheService.buildKey("dashboards", "financial", JSON.stringify(query));
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { cond, params } = period(query, "receivedAt");
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DATE_TRUNC('day', "receivedAt")::date as day,
              COALESCE(SUM("receivedAmount"),0) as received
       FROM "Payment"
       WHERE status='REGISTERED' ${cond}
       GROUP BY 1 ORDER BY 1`,
      ...params,
    );
    const result = { series: rows.map((r) => ({ day: r.day, received: Number(r.received) })) };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },

  async defaults(query: DashboardQuery) {
    const overdue = await prisma.$queryRawUnsafe<any[]>(
      `SELECT l."clientId", c.name as clientName, i.number, i."dueDate", i."totalDue", i."remainingBalance",
              i."dueDate" < NOW() as overdue
       FROM "Installment" i
       JOIN "Loan" l ON i."loanId"=l."id"
       JOIN "Client" c ON l."clientId"=c."id"
       WHERE i.status IN ('PENDING','PARTIALLY_PAID') AND i."dueDate" < NOW()
       ORDER BY i."dueDate" ASC
       LIMIT 100`,
    );
    const totalOverdue = overdue.reduce((s, r) => s + Number(r.remainingBalance), 0);
    return {
      overdueInstallments: overdue.length,
      overdueAmount: totalOverdue,
      clientsInDefault: new Set(overdue.map((r) => r.clientId)).size,
      items: overdue.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        installmentNumber: r.number,
        dueDate: r.dueDate,
        totalDue: Number(r.totalDue),
        remainingBalance: Number(r.remainingBalance),
      })),
    };
  },

  async operational(query: DashboardQuery) {
    const { cond, params } = period(query);
    const [loansCreated, paymentsRegistered] = await Promise.all([
      prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Loan" ${cond}`),
      prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Payment" WHERE status='REGISTERED' ${cond.replace(/grantedAt/g, "receivedAt")}`),
    ]);
    const byUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT u.name as userName, COUNT(*) as loans
       FROM "Loan" l JOIN "User" u ON l."userId"=u."id"
       ${cond}
       GROUP BY u.name ORDER BY loans DESC LIMIT 10`,
      ...params,
    );
    return {
      loansCreated: Number(loansCreated[0]?.c ?? 0),
      paymentsRegistered: Number(paymentsRegistered[0]?.c ?? 0),
      byUser: byUser.map((r) => ({ user: r.userName, loans: Number(r.loans) })),
    };
  },

  async fiscalization(query: DashboardQuery) {
    const { cond, params } = period(query);
    const statusChanges = await prisma.auditLog.findMany({
      where: { action: "LOAN_STATUS_CHANGE", createdAt: query.from ? { gte: new Date(query.from) } : undefined, ...(query.to ? { lte: new Date(query.to) } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    });
    const reversals = await prisma.payment.findMany({
      where: { status: "REVERSED", ...(query.from ? { registeredAt: { gte: new Date(query.from) } } : {}), ...(query.to ? { registeredAt: { lte: new Date(query.to) } } : {}) },
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

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);

    const [granted, clients, dueThisMonth, overdueThisMonth] = await Promise.all([
      prisma.$queryRawUnsafe<{ sum: string }[]>(`SELECT COALESCE(SUM("principalAmount"),0) as sum FROM "Loan"`),
      prisma.$queryRawUnsafe<{ c: string }[]>(`SELECT COUNT(*) as c FROM "Client" WHERE active=true`),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as c, COALESCE(SUM("totalDue"),0) as sum FROM "Installment"
         WHERE status IN ('PENDING','PARTIALLY_PAID') AND "dueDate" >= $1 AND "dueDate" < $2`,
        monthStart,
        monthEnd,
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as c, COALESCE(SUM("remainingBalance"),0) as sum FROM "Installment"
         WHERE status IN ('PENDING','PARTIALLY_PAID')
           AND "dueDate" >= $1 AND "dueDate" < $2 AND "dueDate" < $3`,
        monthStart,
        monthEnd,
        now,
      ),
    ]);

    const dueCount = Number(dueThisMonth[0]?.c ?? 0);
    const overdueCount = Number(overdueThisMonth[0]?.c ?? 0);

    const result = {
      totalGranted: Number(granted[0]?.sum ?? 0),
      activeClients: Number(clients[0]?.c ?? 0),
      receivableThisMonth: Number(dueThisMonth[0]?.sum ?? 0),
      dueInstallmentsThisMonth: dueCount,
      overdueInstallmentsThisMonth: overdueCount,
      overdueAmountThisMonth: Number(overdueThisMonth[0]?.sum ?? 0),
      currentInstallmentsThisMonth: Math.max(0, dueCount - overdueCount),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
    };
    await cacheService.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  },
};
