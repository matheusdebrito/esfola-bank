import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { loansController } from "./loans.controller";

const router = Router();

router.get("/", authenticate, loadFreshUser, requirePermission("loans:read"), loansController.list);
router.post("/", authenticate, loadFreshUser, requirePermission("loans:create"), loansController.create);
router.get("/:id", authenticate, loadFreshUser, requirePermission("loans:read"), loansController.get);
router.patch("/:id", authenticate, loadFreshUser, requirePermission("loans:update"), loansController.update);
router.patch(
  "/:id/status",
  authenticate,
  loadFreshUser,
  requirePermission("loans:status_change"),
  loansController.changeStatus,
);

export default router;
