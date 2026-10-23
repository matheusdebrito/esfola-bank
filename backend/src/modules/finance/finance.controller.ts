import type { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { financeService } from "./finance.service";
import { cashBookSetupSchema, financeEntryCreateSchema, financeReverseSchema, financeListQuerySchema } from "./finance.schema";

const actor = (req: Request) => (req as AuthRequest).user!.id;
export const financeController = {
  overview: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ error: false, data: await financeService.overview() });
  }),
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ error: false, data: await financeService.list(financeListQuerySchema.parse(req.query)) });
  }),
  eligibleLoans: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ error: false, data: await financeService.eligibleLoans() });
  }),
  setup: asyncHandler(async (req: Request, res: Response) => {
    const book = await financeService.setup(cashBookSetupSchema.parse(req.body), actor(req), req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, data: book });
  }),
  register: asyncHandler(async (req: Request, res: Response) => {
    const entry = await financeService.register(financeEntryCreateSchema.parse(req.body), actor(req), req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, data: entry });
  }),
  reverse: asyncHandler(async (req: Request, res: Response) => {
    const entry = await financeService.reverse(req.params.id, financeReverseSchema.parse(req.body), actor(req), req.ip, req.get("user-agent"));
    res.json({ error: false, data: entry });
  }),
};
