import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { auditController } from "./audit.controller";

const router = Router();

router.get("/", authenticate, loadFreshUser, requirePermission("audit:read"), auditController.list);

export default router;
