import { z } from "zod";

export const installmentListQuerySchema = z.object({
  loanId: z.string().optional(),
  status: z.enum(["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"]).optional(),
  overdueOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type InstallmentListQuery = z.infer<typeof installmentListQuerySchema>;
