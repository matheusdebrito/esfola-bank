import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { clientsService } from "./clients.service";
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateInput,
  type ClientUpdateInput,
  clientListQuerySchema,
  type ClientListQuery,
} from "./clients.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const clientsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = clientCreateSchema.parse(req.body) as ClientCreateInput;
    const authReq = req as AuthRequest;
    const client = await clientsService.create(input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Cliente criado com sucesso", data: { client } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = clientListQuerySchema.parse(req.query) as ClientListQuery;
    const result = await clientsService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const client = await clientsService.get(req.params.id);
    res.json({ error: false, data: { client } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = clientUpdateSchema.parse(req.body) as ClientUpdateInput;
    const authReq = req as AuthRequest;
    const client = await clientsService.update(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Cliente atualizado com sucesso", data: { client } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    await clientsService.remove(req.params.id, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Cliente excluído com sucesso" });
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const active = req.body.active === true;
    const authReq = req as AuthRequest;
    const client = await clientsService.setActive(req.params.id, active, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: `Cliente ${active ? "ativado" : "desativado"} com sucesso`, data: { client } });
  }),
};

export default clientsController;
