import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { usersService } from "./users.service";
import {
  userCreateSchema,
  userUpdateSchema,
  passwordChangeSchema,
  passwordResetSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type PasswordChangeInput,
  type PasswordResetInput,
  userListQuerySchema,
  type UserListQuery,
} from "./users.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const usersController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = userCreateSchema.parse(req.body) as UserCreateInput;
    const authReq = req as AuthRequest;
    const user = await usersService.create(input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Usuário criado com sucesso", data: { user } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = userListQuerySchema.parse(req.query) as UserListQuery;
    const result = await usersService.list(query);
    res.json({ error: false, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.get(req.params.id);
    res.json({ error: false, data: { user } });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = userUpdateSchema.parse(req.body) as UserUpdateInput;
    const authReq = req as AuthRequest;
    const user = await usersService.update(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Usuário atualizado com sucesso", data: { user } });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const input = passwordChangeSchema.parse(req.body) as PasswordChangeInput;
    const authReq = req as AuthRequest;
    await usersService.changePassword(authReq.user!.id, input, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Senha alterada com sucesso" });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const input = passwordResetSchema.parse(req.body) as PasswordResetInput;
    const authReq = req as AuthRequest;
    await usersService.resetPassword(req.params.id, input, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Senha redefinida com sucesso" });
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const active = req.body.active === true;
    const authReq = req as AuthRequest;
    const user = await usersService.setActive(req.params.id, active, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: `Usuário ${active ? "ativado" : "desativado"} com sucesso`, data: { user } });
  }),
};

export default usersController;
