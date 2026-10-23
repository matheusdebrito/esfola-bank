import { z } from "zod";

export const dashboardQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  clientId: z.string().optional(),
  userId: z.string().optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
