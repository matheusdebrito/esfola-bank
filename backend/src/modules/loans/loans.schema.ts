import { z } from "zod";

export const loanCreateSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  policyId: z.string().uuid("Política inválida"),
  grantedAt: z.string().datetime({ message: "Data de concessão inválida" }).optional(),
  principalAmount: z.coerce.number().positive("Valor principal deve ser positivo"),
  periodicity: z.enum(["MONTHLY", "DAILY"]).default("MONTHLY"),
  billingModel: z.enum(["FIXED_INSTALLMENTS", "SINGLE_PAYMENT", "VARIABLE"]),
  installmentCount: z.coerce.number().int().positive().optional(),
  startDate: z.string().datetime({ message: "Data de início inválida" }).optional(),
  dueDate: z.string().datetime({ message: "Data de vencimento inválida" }).optional(),
  contractTerms: z.string().max(5000).optional(),
  observations: z.string().max(5000).optional(),
});

export const loanUpdateSchema = z.object({
  principalAmount: z.coerce.number().positive().optional(),
  periodicity: z.enum(["MONTHLY", "DAILY"]).optional(),
  billingModel: z.enum(["FIXED_INSTALLMENTS", "SINGLE_PAYMENT", "VARIABLE"]).optional(),
  installmentCount: z.coerce.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  contractTerms: z.string().max(5000).optional(),
  observations: z.string().max(5000).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Pelo menos um campo deve ser informado" });

export const loanStatusChangeSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "LIQUIDATED", "CANCELED", "RENEGOTIATED"]),
  justification: z.string().min(1, "Justificativa é obrigatória para mudança de status").max(2000),
});

export const loanListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  clientId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "LIQUIDATED", "CANCELED", "RENEGOTIATED"]).optional(),
  userId: z.string().optional(),
  search: z.string().optional(),
});

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type LoanUpdateInput = z.infer<typeof loanUpdateSchema>;
export type LoanStatusChangeInput = z.infer<typeof loanStatusChangeSchema>;
export type LoanListQuery = z.infer<typeof loanListQuerySchema>;
