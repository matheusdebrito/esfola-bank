import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { clientsController } from "./clients.controller";

const router = Router();

router.get("/", authenticate, loadFreshUser, requirePermission("clients:read"), clientsController.list);
router.post("/", authenticate, loadFreshUser, requirePermission("clients:create"), clientsController.create);
router.get("/:id", authenticate, loadFreshUser, requirePermission("clients:read"), clientsController.get);
router.patch("/:id", authenticate, loadFreshUser, requirePermission("clients:update"), clientsController.update);
router.patch("/:id/active", authenticate, loadFreshUser, requirePermission("clients:deactivate"), clientsController.setActive);
router.delete("/:id", authenticate, loadFreshUser, requirePermission("clients:delete"), clientsController.remove);

export default router;
