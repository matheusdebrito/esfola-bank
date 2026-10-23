import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma, disconnectPrisma } from "../../config/prisma";
import { cleanupDb } from "../../test/helpers";
import { financeService } from "./finance.service";
import { paymentsService } from "../payments/payments.service";
import { financeEntryCreateSchema } from "./finance.schema";
import { rolePermissions } from "../auth/permissions";

const prisma = getPrisma();
let userId: string;
let loanId: string;
let installmentId: string;
let clientId: string;
let withdrawalId: string;
let registeredPaymentId: string;

describe("livro-caixa e resultado financeiro (PostgreSQL)", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await cleanupDb(prisma);
    await prisma.financialPolicy.deleteMany();
    const user = await prisma.user.create({ data: { email: "financeiro@emprestimo.test", name: "Gestor", passwordHash: "hash", role: "ADMIN" } });
    userId = user.id;
    const client = await prisma.client.create({ data: {
      name: "Cliente Caixa", cpf: "52998224725", birthDate: new Date("1990-01-01T00:00:00Z"),
      cep: "01001000", address: "Rua", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP",
    } });
    clientId = client.id;
    const policy = await prisma.financialPolicy.create({ data: {
      name: "Caixa", interestRatePercent: 10, lateFeeAmount: 10, dailyLateInterestPercent: 0.33,
    } });
    const now = new Date();
    // Contrato antigo e recebimento histórico não são somados retroativamente no caixa novo.
    const oldLoan = await prisma.loan.create({ data: {
      code: "EMP-FIN-OLD", userId, clientId, policyId: policy.id, principalAmount: 100,
      interestRatePercent: 10, periodicity: "MONTHLY", billingModel: "FIXED_INSTALLMENTS",
      status: "LIQUIDATED", grantedAt: new Date(now.getTime() - 90_000),
    } });
    await prisma.payment.create({ data: {
      userId, loanId: oldLoan.id, clientId, receivedAmount: 700, receivedAt: new Date(now.getTime() - 30_000),
      method: "PIX", status: "REGISTERED",
    } });
    await financeService.setup({ openingBalance: 2000 }, userId);
    const loan = await prisma.loan.create({ data: {
      code: "EMP-FIN-NEW", userId, clientId, policyId: policy.id, principalAmount: 100,
      interestRatePercent: 10, periodicity: "MONTHLY", billingModel: "FIXED_INSTALLMENTS",
      status: "ACTIVE", grantedAt: new Date(),
    } });
    loanId = loan.id;
    const inst = await prisma.installment.create({ data: {
      loanId, number: 1, dueDate: new Date(), principalDue: 100, interestDue: 10,
      totalDue: 110, remainingBalance: 110, paidAmount: 0, status: "PENDING",
    } });
    installmentId = inst.id;
  });

  afterAll(async () => {
    await cleanupDb(prisma);
    await prisma.financialPolicy.deleteMany();
    await disconnectPrisma();
  });

  it("exige abertura única e restringe permissão de operador", async () => {
    await expect(financeService.setup({ openingBalance: 50 }, userId)).rejects.toMatchObject({
      statusCode: 409, code: "CASH_BOOK_ALREADY_INITIALIZED",
    });
    expect(rolePermissions.OPERATOR).not.toContain("finance:read");
    expect(rolePermissions.OPERATOR).not.toContain("finance:write");
    expect(rolePermissions.AUDITOR).toContain("finance:read");
    expect(rolePermissions.AUDITOR).not.toContain("finance:write");
  });

  it("registra cada desembolso só uma vez e impede valor incorreto", async () => {
    const eligible = await financeService.eligibleLoans();
    expect(eligible.some((loan) => loan.id === loanId)).toBe(true);
    await expect(financeService.register({
      type: "DISBURSEMENT", amount: 101, loanId, description: "Transferência do principal",
    }, userId)).rejects.toMatchObject({ code: "DISBURSEMENT_AMOUNT_MISMATCH" });
    const disbursement = await financeService.register({
      type: "DISBURSEMENT", amount: 100, loanId, description: "Transferência do principal",
      idempotencyKey: "finance-new-loan-disbursement",
    }, userId);
    const retry = await financeService.register({
      type: "DISBURSEMENT", amount: 100, loanId, description: "Transferência do principal",
      idempotencyKey: "finance-new-loan-disbursement",
    }, userId);
    expect(disbursement.id).toBe(retry.id);
    await expect(financeService.register({
      type: "DISBURSEMENT", amount: 100, loanId, description: "Desembolso duplicado",
    }, userId)).rejects.toMatchObject({ code: "LOAN_ALREADY_DISBURSED" });
    expect((await financeService.overview()).availableBalance).toBe(1900);
  });

  it("contabiliza pagamentos uma vez, diferencia receitas e respeita estornos", async () => {
    const payment = await paymentsService.register({
      loanId, clientId, receivedAmount: 60, receivedAt: new Date().toISOString(),
      method: "PIX", allocations: [{ installmentId, principalAmount: 50, interestAmount: 8, chargesAmount: 2 }],
    }, userId);
    registeredPaymentId = payment.id;
    let overview = await financeService.overview();
    expect(overview.received).toBe(60);
    expect(overview.principalRecovered).toBe(50);
    expect(overview.interestReceived).toBe(8);
    expect(overview.chargesReceived).toBe(2);
    expect(overview.availableBalance).toBe(1960);
    await paymentsService.reverse(registeredPaymentId, { justification: "Teste de estorno" }, userId);
    overview = await financeService.overview();
    expect(overview.received).toBe(0);
    expect(overview.availableBalance).toBe(1900);
    expect(overview.operationalCashResult).toBe(0);
    const list = await financeService.list({ page: 1, pageSize: 20 });
    const reversed = list.items.find((entry) => entry.id === registeredPaymentId);
    expect(reversed?.reversed).toBe(true);
  });

  it("separa aportes, despesas e retiradas do resultado e impede saldo negativo", async () => {
    await financeService.register({ type: "CONTRIBUTION", amount: 300, description: "Aporte dos sócios" }, userId);
    await financeService.register({ type: "EXPENSE", amount: 45, description: "Taxa administrativa" }, userId);
    const withdrawal = await financeService.register({ type: "WITHDRAWAL", amount: 50, description: "Retirada de sócio" }, userId);
    withdrawalId = withdrawal.id;
    const overview = await financeService.overview();
    expect(overview.availableBalance).toBe(2105);
    expect(overview.operationalCashResult).toBe(-45);
    await expect(financeService.register({ type: "EXPENSE", amount: 2200, description: "Despesa excessiva" }, userId))
      .rejects.toMatchObject({ code: "INSUFFICIENT_CASH_BALANCE" });
    await financeService.reverse(withdrawalId, { justification: "Registro duplicado por engano" }, userId);
    expect((await financeService.overview()).availableBalance).toBe(2155);
    await expect(financeService.reverse(withdrawalId, { justification: "Estorno novamente" }, userId))
      .rejects.toMatchObject({ code: "FINANCE_ENTRY_ALREADY_REVERSED" });
  });

  it("valida moedas e preserva rastreabilidade", async () => {
    expect(financeEntryCreateSchema.safeParse({ type: "EXPENSE", amount: 12.345, description: "Valor invalido" }).success).toBe(false);
    const count = await prisma.auditLog.count({ where: { action: { in: ["FINANCE_SETUP", "FINANCE_ENTRY_CREATE", "FINANCE_ENTRY_REVERSE"] } } });
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
