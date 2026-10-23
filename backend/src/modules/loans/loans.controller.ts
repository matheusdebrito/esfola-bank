import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { loansService } from "./loans.service";
import {
  loanCreateSchema,
  loanUpdateSchema,
  loanStatusChangeSchema,
  type LoanCreateInput,
  type LoanUpdateInput,
  type LoanStatusChangeInput,
  loanListQuerySchema,
  type LoanListQuery,
} from "./loans.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const loansController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = loanCreateSchema.parse(req.body) as LoanCreateInput;
    const authReq = req as AuthRequest;
    const loan = await loansService.create(input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Empréstimo criado com sucesso", data: { loan } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = loanListQuerySchema.parse(req.query) as LoanListQuery;
    const result = await loansService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const loan = await loansService.get(req.params.id);
    res.json({ error: false, data: { loan } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = loanUpdateSchema.parse(req.body) as LoanUpdateInput;
    const authReq = req as AuthRequest;
    const loan = await loansService.update(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Empréstimo atualizado com sucesso", data: { loan } });
  }),

  changeStatus: asyncHandler(async (req: Request, res: Response) => {
    const input = loanStatusChangeSchema.parse(req.body) as LoanStatusChangeInput;
    const authReq = req as AuthRequest;
    const loan = await loansService.changeStatus(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: `Status do empréstimo alterado para ${input.status}`, data: { loan } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    await loansService.remove(req.params.id, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(204).send();
  }),
};

export default loansController;
