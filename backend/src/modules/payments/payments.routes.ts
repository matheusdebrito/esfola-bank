import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { paymentsController } from "./payments.controller";

const router = Router();

router.post("/", authenticate, loadFreshUser, requirePermission("payments:register"), paymentsController.register);
router.get("/", authenticate, loadFreshUser, requirePermission("payments:read"), paymentsController.list);
router.get("/:id", authenticate, loadFreshUser, requirePermission("payments:read"), paymentsController.get);
router.post(
  "/:id/reverse",
  authenticate,
  loadFreshUser,
  requirePermission("payments:reverse"),
  paymentsController.reverse,
);

export default router;
