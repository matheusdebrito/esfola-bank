import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectPrisma, getPrisma } from "../../config/prisma";
import { cleanupDb } from "../../test/helpers";
import { todayCalendarDate } from "../../shared/calendar";
import { dashboardsService } from "./dashboards.service";

let prisma: ReturnType<typeof getPrisma>;
const today = todayCalendarDate();
const tomorrow = new Date(Date.parse(today + "T00:00:00.000Z") + 86_400_000);
const todayDue = new Date(today + "T00:00:00.000Z");
const from = new Date(today + "T03:00:00.000Z");
const to = new Date(from.getTime() + 86_400_000 - 1);

describe("dashboard: realização contratual de vencimentos (PostgreSQL)", () => {
  beforeAll(async () => {
    prisma = getPrisma();
    await prisma.$connect();
    await cleanupDb(prisma);
    await prisma.financialPolicy.deleteMany();

    const user = await prisma.user.create({
      data: { email: "dashboard.test@example.com", name: "Teste Dashboard", passwordHash: "teste", role: "ADMIN" },
    });
    const client = await prisma.client.create({
      data: {
        name: "Cliente Dashboard", cpf: "55588822211", birthDate: new Date("1990-01-01T00:00:00.000Z"),
        cep: "01001000", address: "Rua Teste", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP",
      },
    });
    const policy = await prisma.financialPolicy.create({
      data: { name: "Política de teste", interestRatePercent: 10, lateFeeAmount: 10, dailyLateInterestPercent: 0.33 },
    });
    const loan = await prisma.loan.create({
      data: {
        code: "EMP-TEST-DASHBOARD", userId: user.id, clientId: client.id, policyId: policy.id,
        grantedAt: from, principalAmount: 100, interestRatePercent: 10, billingModel: "FIXED_INSTALLMENTS",
        periodicity: "DAILY", installmentCount: 2, startDate: todayDue, status: "ACTIVE",
      },
    });
    const first = await prisma.installment.create({
      data: {
        loanId: loan.id, number: 1, dueDate: todayDue, principalDue: 50, interestDue: 5,
        totalDue: 55, remainingBalance: 25, paidAmount: 30, status: "PARTIALLY_PAID",
      },
    });
    await prisma.installment.create({
      data: {
        loanId: loan.id, number: 2, dueDate: tomorrow, principalDue: 50, interestDue: 5,
        totalDue: 55, remainingBalance: 55, paidAmount: 0, status: "PENDING",
      },
    });
    const payment = await prisma.payment.create({
      data: {
        clientId: client.id, loanId: loan.id, userId: user.id, status: "REGISTERED",
        receivedAmount: 30, receivedAt: from, method: "PIX",
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id, installmentId: first.id,
        principalAmount: 25, interestAmount: 5, chargesAmount: 0, totalAmount: 30,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanupDb(prisma);
    await prisma.financialPolicy.deleteMany();
    await disconnectPrisma();
  });

  it("considera apenas vencimentos até hoje, alocação contratual e previsão integral", async () => {
    const dashboard = await dashboardsService.overview({ from: from.toISOString(), to: to.toISOString() });
    expect(dashboard.collectionPerformance.scheduled).toBe(55);
    expect(dashboard.collectionPerformance.settled).toBe(30);
    expect(dashboard.collectionPerformance.rate).toBe(54.55);
    expect(dashboard.receivedTotal).toBe(30);
    expect(dashboard.dueNext7Amount).toBe(80);
    const day = dashboard.financialFlow.find((row: { month: string }) => row.month === today);
    expect(day?.predicted).toBe(55);
    expect(day?.received).toBe(30);
  });
});
