import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { paymentsService } from "./payments.service";
import {
  paymentCreateSchema,
  paymentListQuerySchema,
  paymentReverseSchema,
  type PaymentCreateInput,
  type PaymentListQuery,
  type PaymentReverseInput,
} from "./payments.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const paymentsController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const input = paymentCreateSchema.parse(req.body) as PaymentCreateInput;
    const authReq = req as AuthRequest;
    const payment = await paymentsService.register(input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Pagamento registrado com sucesso", data: { payment } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = paymentListQuerySchema.parse(req.query) as PaymentListQuery;
    const result = await paymentsService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentsService.get(req.params.id);
    res.json({ error: false, data: { payment } });
  }),

  reverse: asyncHandler(async (req: Request, res: Response) => {
    const input = paymentReverseSchema.parse(req.body) as PaymentReverseInput;
    const authReq = req as AuthRequest;
    const result = await paymentsService.reverse(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Pagamento estornado com sucesso", data: result });
  }),
};

export default paymentsController;
