import { z } from "zod";

const money = z.number().finite().min(0).max(999_999_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001, "Informe no máximo duas casas decimais");

export const cashBookSetupSchema = z.object({
  openingBalance: money,
}).strict();

export const financeEntryCreateSchema = z.object({
  type: z.enum(["CONTRIBUTION", "WITHDRAWAL", "EXPENSE", "DISBURSEMENT"]),
  amount: money.refine((value) => value > 0, "Valor precisa ser maior que zero"),
  description: z.string().trim().min(3).max(500),
  loanId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.type === "DISBURSEMENT") !== Boolean(value.loanId)) {
    ctx.addIssue({ code: "custom", path: ["loanId"], message: "Somente desembolsos exigem empréstimo vinculado" });
  }
});

export const financeReverseSchema = z.object({
  justification: z.string().trim().min(10).max(500),
}).strict();

export const financeListQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine((v) => !v.from || !v.to || v.from <= v.to, { message: "Período inválido" });

export type CashBookSetupInput = z.infer<typeof cashBookSetupSchema>;
export type FinanceEntryCreateInput = z.infer<typeof financeEntryCreateSchema>;
export type FinanceReverseInput = z.infer<typeof financeReverseSchema>;
export type FinanceListQuery = z.infer<typeof financeListQuerySchema>;
