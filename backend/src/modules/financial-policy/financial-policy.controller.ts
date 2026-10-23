import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { financialPolicyService } from "./financial-policy.service";
import {
  financialPolicyCreateSchema,
  financialPolicyUpdateSchema,
  type FinancialPolicyCreateInput,
  type FinancialPolicyUpdateInput,
  financialPolicyListQuerySchema,
  type FinancialPolicyListQuery,
} from "./financial-policy.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const financialPolicyController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = financialPolicyCreateSchema.parse(req.body) as FinancialPolicyCreateInput;
    const authReq = req as AuthRequest;
    const policy = await financialPolicyService.create(input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Política financeira criada com sucesso", data: { policy } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = financialPolicyListQuerySchema.parse(req.query) as FinancialPolicyListQuery;
    const result = await financialPolicyService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const policy = await financialPolicyService.get(req.params.id);
    res.json({ error: false, data: { policy } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = financialPolicyUpdateSchema.parse(req.body) as FinancialPolicyUpdateInput;
    const authReq = req as AuthRequest;
    const policy = await financialPolicyService.update(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Política financeira atualizada com sucesso", data: { policy } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    await financialPolicyService.remove(req.params.id, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Política financeira removida com sucesso" });
  }),
};

export default financialPolicyController;
