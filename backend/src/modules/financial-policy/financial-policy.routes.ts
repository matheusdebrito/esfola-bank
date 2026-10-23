import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { financialPolicyController } from "./financial-policy.controller";

const router = Router();

router.get("/", authenticate, loadFreshUser, requirePermission("users:read"), financialPolicyController.list);
router.post("/", authenticate, loadFreshUser, requirePermission("users:create"), financialPolicyController.create);
router.get("/:id", authenticate, loadFreshUser, requirePermission("users:read"), financialPolicyController.get);
router.patch("/:id", authenticate, loadFreshUser, requirePermission("users:update"), financialPolicyController.update);
router.delete("/:id", authenticate, loadFreshUser, requirePermission("users:update"), financialPolicyController.remove);

export default router;
