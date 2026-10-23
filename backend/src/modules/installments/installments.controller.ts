import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { installmentsService } from "./installments.service";
import { installmentListQuerySchema, type InstallmentListQuery } from "./installments.schema";

export const installmentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = installmentListQuerySchema.parse(req.query) as InstallmentListQuery;
    const result = await installmentsService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const installment = await installmentsService.get(req.params.id);
    res.json({ error: false, data: { installment } });
  }),

  pay: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const payment = await installmentsService.pay(
      req.params.id,
      authReq.user!.id,
      req.ip,
      req.get("user-agent"),
    );
    res.status(201).json({ error: false, message: "Parcela baixada como paga", data: { payment } });
  }),
};

export default installmentsController;
