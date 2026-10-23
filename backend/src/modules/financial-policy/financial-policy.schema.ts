import { z } from "zod";

export const financialPolicyCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
  description: z.string().max(1000).optional(),
  interestRatePercent: z.coerce.number().min(0).max(1000).default(0),
  lateFeeAmount: z.coerce.number().min(0).max(100000).default(10),
  dailyLateInterestPercent: z.coerce.number().min(0).max(100).default(0),
  roundingMode: z.enum(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]).default("HALF_UP"),
  toleranceDays: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const financialPolicyUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional(),
  interestRatePercent: z.coerce.number().min(0).max(1000).optional(),
  lateFeeAmount: z.coerce.number().min(0).max(100000).optional(),
  dailyLateInterestPercent: z.coerce.number().min(0).max(100).optional(),
  roundingMode: z.enum(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]).optional(),
  toleranceDays: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Pelo menos um campo deve ser informado" });

export const financialPolicyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  active: z.coerce.boolean().optional(),
});

export type FinancialPolicyCreateInput = z.infer<typeof financialPolicyCreateSchema>;
export type FinancialPolicyUpdateInput = z.infer<typeof financialPolicyUpdateSchema>;
export type FinancialPolicyListQuery = z.infer<typeof financialPolicyListQuerySchema>;
