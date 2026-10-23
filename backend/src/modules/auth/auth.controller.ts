import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { authService } from "./auth.service";
import { loginSchema, type LoginInput } from "./auth.schema";
import { logger } from "../../config/logger";

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body) as LoginInput;
    const { user, tokens } = await authService.login(
      input,
      req.ip,
      req.get("user-agent"),
    );
    authService.setTokenCookies(res, tokens);
    res.json({ error: false, message: "Login realizado com sucesso", data: { user } });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refresh_token;
    await authService.logout(refreshToken);
    authService.clearTokenCookies(res);
    res.json({ error: false, message: "Logout realizado com sucesso" });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      res.status(401).json({ error: true, message: "Token de atualização não fornecido", statusCode: 401, code: "REFRESH_TOKEN_MISSING" });
      return;
    }
    const tokens = await authService.refresh(refreshToken);
    authService.setTokenCookies(res, tokens);
    res.json({ error: false, message: "Sessão renovada com sucesso", data: {} });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: true, message: "Não autenticado", statusCode: 401, code: "NOT_AUTHENTICATED" });
      return;
    }
    res.json({ error: false, data: { user: authService.mapUser(user) } });
  }),
};

export default authController;

logger.info("auth controller carregado");
