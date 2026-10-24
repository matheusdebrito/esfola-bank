import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { usersController } from "./users.controller";

const router = Router();

// listar, obter: leitura de usuários (ADMIN, MANAGER, OPERATOR, AUDITOR)
router.get("/", authenticate, loadFreshUser, requirePermission("users:read"), usersController.list);
router.patch("/me", authenticate, loadFreshUser, usersController.updateOwnProfile);
router.get("/:id", authenticate, loadFreshUser, requirePermission("users:read"), usersController.get);

// criar: apenas ADMIN
router.post("/", authenticate, loadFreshUser, requirePermission("users:create"), usersController.create);

// atualizar: apenas ADMIN
router.patch("/:id", authenticate, loadFreshUser, requirePermission("users:update"), usersController.update);

// ativar/desativar: apenas ADMIN
router.patch("/:id/active", authenticate, loadFreshUser, requirePermission("users:status_change"), usersController.setActive);
router.delete("/:id", authenticate, loadFreshUser, requirePermission("users:delete"), usersController.delete);

// redefinir senha: apenas ADMIN
router.post("/:id/reset-password", authenticate, loadFreshUser, requirePermission("users:create"), usersController.resetPassword);

// alterar própria senha: qualquer autenticado
router.post("/me/password", authenticate, loadFreshUser, usersController.changePassword);

export default router;
