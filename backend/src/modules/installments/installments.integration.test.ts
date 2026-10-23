import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectPrisma, getPrisma } from "../../config/prisma";
import { cleanupDb } from "../../test/helpers";
import { todayCalendarDate } from "../../shared/calendar";
import { installmentsService } from "./installments.service";

let prisma: any;
let loanId: string | null = null;
let policyId: string | null = null;

const today = todayCalendarDate();

function addDays(base: string, days: number): Date {
  return new Date(Date.parse(`${base}T00:00:00.000Z`) + days * 86_400_000);
}

describe("installments (integração — requer banco de teste)", () => {
  beforeAll(async () => {
    prisma = getPrisma();
    try {
      await prisma.$connect();
    } catch {
      return;
    }

    await cleanupDb(prisma);
    await prisma.financialPolicy.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "operador.parcelas@emprestimo.test",
        name: "Operador Parcelas",
        passwordHash: "hash-de-teste",
        role: "OPERATOR",
      },
    });

    const client = await prisma.client.create({
      data: {
        name: "Cliente Parcelas",
        cpf: "52998224725",
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        cep: "01001000",
        address: "Rua de Teste",
        number: "100",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
      },
    });

    const policy = await prisma.financialPolicy.create({
      data: {
        name: "Política de Teste",
        interestRatePercent: 10,
        lateFeeAmount: 10,
        dailyLateInterestPercent: 0.33,
      },
    });
    policyId = policy.id;

    const loan = await prisma.loan.create({
      data: {
        code: `EMP-${today.slice(0, 4)}-9001`,
        clientId: client.id,
        userId: user.id,
        policyId: policy.id,
        grantedAt: addDays(today, -30),
        principalAmount: 100,
        interestRatePercent: 10,
        periodicity: "MONTHLY",
        billingModel: "FIXED_INSTALLMENTS",
        installmentCount: 2,
        startDate: addDays(today, -5),
        status: "ACTIVE",
      },
    });
    loanId = loan.id;

    await prisma.installment.createMany({
      data: [
        {
          loanId: loan.id,
          number: 1,
          dueDate: addDays(today, -5),
          principalDue: 50,
          interestDue: 5,
          chargesDue: 0,
          totalDue: 55,
          paidAmount: 0,
          remainingBalance: 55,
          status: "PENDING",
        },
        {
          loanId: loan.id,
          number: 2,
          dueDate: addDays(today, 0),
          principalDue: 50,
          interestDue: 5,
          chargesDue: 0,
          totalDue: 55,
          paidAmount: 0,
          remainingBalance: 55,
          status: "PENDING",
        },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      if (policyId) {
        await prisma.financialPolicy.deleteMany({ where: { id: policyId } });
      }
      await cleanupDb(prisma);
    } catch {
      // banco de teste indisponível — nada a limpar
    }
    await disconnectPrisma();
  });

  it("deve filtrar apenas parcelas vencidas, ignorando o vencimento de hoje", async () => {
    if (!loanId) return;

    const result = await installmentsService.list({
      loanId,
      overdueOnly: true,
      page: 1,
      pageSize: 10,
    });

    expect(result.meta.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].number).toBe(1);
    expect(result.items[0].isOverdue).toBe(true);
    expect(result.items[0].effectiveStatus).toBe("OVERDUE");
    expect(result.items[0].daysOverdue).toBe(5);
    expect(result.items[0].lateCharges?.totalLateCharges).toBeGreaterThan(0);
  });

  it("deve tratar o filtro status=OVERDUE como condição calculada", async () => {
    if (!loanId) return;

    const result = await installmentsService.list({
      loanId,
      status: "OVERDUE",
      page: 1,
      pageSize: 10,
    });

    expect(result.meta.total).toBe(1);
    expect(result.items[0].number).toBe(1);
  });

  it("não deve marcar como atrasada a parcela que vence hoje", async () => {
    if (!loanId) return;

    const result = await installmentsService.list({ loanId, page: 1, pageSize: 10 });
    const todayInstallment = result.items.find((item) => item.number === 2);

    expect(todayInstallment?.isOverdue).toBe(false);
    expect(todayInstallment?.effectiveStatus).toBe("PENDING");
    expect(todayInstallment?.daysOverdue).toBe(0);
  });
  it("exibe os encargos no total devido sem alterar a parcela original", async () => {
    if (!loanId) return;
    const result = await installmentsService.list({ loanId, page: 1, pageSize: 10 });
    const overdue = result.items.find((item) => item.number === 1);
    const todayInstallment = result.items.find((item) => item.number === 2);

    expect(overdue?.totalDue).toBe(55);
    expect(overdue?.lateCharges?.totalLateCharges).toBe(10.91);
    expect(overdue?.updatedTotalDue).toBe(65.91);
    expect(overdue?.updatedRemainingBalance).toBe(65.91);
    expect(todayInstallment?.updatedTotalDue).toBe(55);
    expect(todayInstallment?.updatedRemainingBalance).toBe(55);

    const single = await installmentsService.get(overdue!.id);
    expect(single.updatedTotalDue).toBe(overdue?.updatedTotalDue);
    expect(single.updatedRemainingBalance).toBe(overdue?.updatedRemainingBalance);
  });

  it("considera pagamentos contratuais e encargos já pagos no total atualizado", async () => {
    if (!loanId) return;
    const inst = await prisma.installment.findFirst({ where: { loanId, number: 1 } });
    if (!inst) throw new Error("Parcela de teste não encontrada");
    await prisma.installment.update({
      where: { id: inst.id },
      data: { status: "PARTIALLY_PAID", paidAmount: 30, remainingBalance: 35 },
    });
    try {
      const result = await installmentsService.get(inst.id);
      expect(result.totalDue).toBe(55);
      expect(result.lateCharges?.totalLateCharges).toBe(10.58);
      expect(result.updatedTotalDue).toBe(75.58);
      expect(result.updatedRemainingBalance).toBe(45.58);
      expect(result.updatedTotalDue - result.paidAmount).toBeCloseTo(result.updatedRemainingBalance, 2);
    } finally {
      await prisma.installment.update({
        where: { id: inst.id },
        data: { status: "PENDING", paidAmount: 0, remainingBalance: 55 },
      });
    }
  });

  it("preserva encargos já recebidos após a quitação sem cobrar novos juros", async () => {
    if (!loanId) return;
    const inst = await prisma.installment.findFirst({ where: { loanId, number: 1 } });
    if (!inst) throw new Error("Parcela de teste não encontrada");
    await prisma.installment.update({
      where: { id: inst.id },
      data: { status: "PAID", paidAmount: 65.91, remainingBalance: 0 },
    });
    try {
      const result = await installmentsService.get(inst.id);
      expect(result.totalDue).toBe(55);
      expect(result.updatedTotalDue).toBe(65.91);
      expect(result.updatedRemainingBalance).toBe(0);
      expect(result.lateCharges).toBeNull();
    } finally {
      await prisma.installment.update({
        where: { id: inst.id },
        data: { status: "PENDING", paidAmount: 0, remainingBalance: 55 },
      });
    }
  });

});
