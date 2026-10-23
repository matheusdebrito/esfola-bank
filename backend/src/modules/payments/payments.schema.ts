import { z } from "zod";

export const paymentAllocationInputSchema = z.object({
  installmentId: z.string().uuid("Parcela inválida"),
  principalAmount: z.coerce.number().nonnegative(),
  interestAmount: z.coerce.number().nonnegative(),
  chargesAmount: z.coerce.number().nonnegative(),
});

export const paymentCreateSchema = z.object({
  clientId: z.string().uuid("Cliente inválido"),
  loanId: z.string().uuid("Empréstimo inválido"),
  receivedAmount: z.coerce.number().positive("Valor recebido deve ser positivo"),
  receivedAt: z.string().datetime({ message: "Data de recebimento inválida" }),
  method: z.enum(["CASH", "PIX", "TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().max(255).optional().nullable(),
  observations: z.string().max(2000).optional().nullable(),
  idempotencyKey: z.string().uuid().optional(),
  allocations: z.array(paymentAllocationInputSchema).min(1, "Pelo menos uma alocação é obrigatória"),
});

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  clientId: z.string().optional(),
  loanId: z.string().optional(),
  userId: z.string().optional(),
  method: z.enum(["CASH", "PIX", "TRANSFER", "CHECK", "OTHER"]).optional(),
  status: z.enum(["REGISTERED", "REVERSED"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const paymentReverseSchema = z.object({
  justification: z.string().min(1, "Justificativa é obrigatória para estorno").max(2000),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type PaymentReverseInput = z.infer<typeof paymentReverseSchema>;
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
