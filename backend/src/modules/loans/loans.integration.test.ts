import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectPrisma, getPrisma } from "../../config/prisma";
import { cleanupDb } from "../../test/helpers";
import type { LoanCreateInput } from "./loans.schema";
import { loansService } from "./loans.service";
import { financialPolicyService } from "../financial-policy/financial-policy.service";

let prisma: any;
let userId = "";
let clientId = "";
let policyId = "";

function loanInput(overrides: Partial<LoanCreateInput> = {}): LoanCreateInput {
  return {
    clientId,
    policyId,
    grantedAt: "2026-01-10T00:00:00.000Z",
    principalAmount: 1000,
    periodicity: "MONTHLY",
    billingModel: "FIXED_INSTALLMENTS",
    installmentCount: 2,
    startDate: "2026-02-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("loans (integração — requer banco de teste)", () => {
  beforeAll(async () => {
    prisma = getPrisma();
    try {
      await prisma.$connect();
    } catch {
      return;
    }

    await cleanupDb(prisma);
    await prisma.loanCodeCounter.deleteMany();
    await prisma.financialPolicy.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "operador.emprestimos@emprestimo.test",
        name: "Operador Empréstimos",
        passwordHash: "hash-de-teste",
        role: "ADMIN",
      },
    });
    userId = user.id;

    const client = await prisma.client.create({
      data: {
        name: "Cliente Empréstimos",
        cpf: "11144477735",
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        cep: "01001000",
        address: "Rua de Teste",
        number: "100",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
      },
    });
    clientId = client.id;

    const policy = await prisma.financialPolicy.create({
      data: {
        name: "Política de Teste",
        interestRatePercent: 10,
        lateFeeAmount: 10,
        dailyLateInterestPercent: 0.33,
      },
    });
    policyId = policy.id;
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      await cleanupDb(prisma);
      await prisma.loanCodeCounter.deleteMany();
      await prisma.financialPolicy.deleteMany();
    } catch {
      // banco de teste indisponível — nada a limpar
    }
    await disconnectPrisma();
  });

  it("deve gerar identificadores sequenciais, reiniciando por ano", async () => {
    if (!userId) return;

    const first = await loansService.create(loanInput(), userId);
    const second = await loansService.create(
      loanInput({ grantedAt: "2026-06-01T00:00:00.000Z" }),
      userId,
    );
    const previousYear = await loansService.create(
      loanInput({ grantedAt: "2025-12-01T00:00:00.000Z" }),
      userId,
    );
    const nextYear = await loansService.create(
      loanInput({ grantedAt: "2027-01-05T00:00:00.000Z" }),
      userId,
    );

    expect(first.code).toBe("EMP-2026-0001");
    expect(second.code).toBe("EMP-2026-0002");
    expect(previousYear.code).toBe("EMP-2025-0001");
    expect(nextYear.code).toBe("EMP-2027-0001");
  });

  it("deve excluir definitivamente rascunho e cancelado sem histórico", async () => {
    if (!userId) return;

    const draft = await loansService.create(loanInput(), userId);
    await loansService.remove(draft.id, userId);
    expect(await prisma.loan.findUnique({ where: { id: draft.id } })).toBeNull();

    const toCancel = await loansService.create(loanInput(), userId);
    await loansService.changeStatus(
      toCancel.id,
      { status: "CANCELED", justification: "Duplicado" },
      userId,
    );
    await loansService.remove(toCancel.id, userId);
    expect(await prisma.loan.findUnique({ where: { id: toCancel.id } })).toBeNull();
  });

  it("deve bloquear exclusão de empréstimo com histórico financeiro", async () => {
    if (!userId) return;

    const withInstallments = await loansService.create(loanInput(), userId);
    await prisma.installment.create({
      data: {
        loanId: withInstallments.id,
        number: 1,
        dueDate: new Date("2026-02-10T00:00:00.000Z"),
        principalDue: 50,
        interestDue: 5,
        chargesDue: 0,
        totalDue: 55,
        paidAmount: 0,
        remainingBalance: 55,
        status: "PENDING",
      },
    });

    await expect(loansService.remove(withInstallments.id, userId)).rejects.toMatchObject({
      statusCode: 409,
      code: "LOAN_HAS_FINANCIAL_HISTORY",
    });

    const active = await loansService.create(loanInput(), userId);
    await loansService.changeStatus(
      active.id,
      { status: "ACTIVE", justification: "Liberação" },
      userId,
    );

    await expect(loansService.remove(active.id, userId)).rejects.toMatchObject({
      statusCode: 409,
      code: "LOAN_HAS_FINANCIAL_HISTORY",
    });
  });

  it("deve retornar 404 ao excluir empréstimo inexistente", async () => {
    if (!userId) return;

    await expect(
      loansService.remove("00000000-0000-0000-0000-000000000000", userId),
    ).rejects.toMatchObject({ statusCode: 404, code: "LOAN_NOT_FOUND" });
  });
  it("impede cancelar um contrato ativo com parcelas abertas", async () => {
    if (!userId) return;
    const active = await loansService.create(loanInput(), userId);
    await loansService.changeStatus(active.id, { status: "ACTIVE", justification: "Liberação" }, userId);
    await expect(
      loansService.changeStatus(active.id, { status: "CANCELED", justification: "Teste" }, userId),
    ).rejects.toMatchObject({ statusCode: 409, code: "LOAN_HAS_FINANCIAL_HISTORY" });
  });

  it("preserva multa e juros de políticas vinculadas a empréstimos", async () => {
    if (!userId) return;
    await expect(
      financialPolicyService.update(policyId, { dailyLateInterestPercent: 0.5 }, userId),
    ).rejects.toMatchObject({ statusCode: 409, code: "POLICY_IN_USE_IMMUTABLE" });
    const policy = await prisma.financialPolicy.findUnique({ where: { id: policyId } });
    expect(Number(policy.dailyLateInterestPercent)).toBe(0.33);
  });

});
