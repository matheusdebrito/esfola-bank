import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { installmentsController } from "./installments.controller";

const router = Router();

router.get("/", authenticate, loadFreshUser, requirePermission("installments:read"), installmentsController.list);
router.get("/:id", authenticate, loadFreshUser, requirePermission("installments:read"), installmentsController.get);
router.post("/:id/pay", authenticate, loadFreshUser, requirePermission("payments:register"), installmentsController.pay);

export default router;
