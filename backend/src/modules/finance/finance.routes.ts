import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { financeController } from "./finance.controller";

const router = Router();
const guard = [authenticate, loadFreshUser];
router.get("/overview", ...guard, requirePermission("finance:read"), financeController.overview);
router.get("/entries", ...guard, requirePermission("finance:read"), financeController.list);
router.get("/eligible-loans", ...guard, requirePermission("finance:write"), financeController.eligibleLoans);
router.post("/setup", ...guard, requirePermission("finance:write"), financeController.setup);
router.post("/entries", ...guard, requirePermission("finance:write"), financeController.register);
router.post("/entries/:id/reverse", ...guard, requirePermission("finance:write"), financeController.reverse);
export default router;
