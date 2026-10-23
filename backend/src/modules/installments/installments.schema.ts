import { z } from "zod";

const booleanQueryParam = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1")
  .optional();

export const installmentListQuerySchema = z.object({
  loanId: z.string().optional(),
  status: z.enum(["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"]).optional(),
  overdueOnly: booleanQueryParam,
  ageBucket: z.enum(["all", "1-7", "8-30", "31+"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type InstallmentListQuery = z.infer<typeof installmentListQuerySchema>;
