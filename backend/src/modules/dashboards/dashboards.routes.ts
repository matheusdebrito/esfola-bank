import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { dashboardsController } from "./dashboards.controller";

const router = Router();

router.get("/executive", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.executive);
router.get("/financial", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.financial);
router.get("/defaults", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.defaults);
router.get("/operational", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.operational);
router.get("/fiscalization", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.fiscalization);
router.get("/monthly", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.monthly);
router.get("/overview", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.overview);
router.get("/upcoming-due", authenticate, loadFreshUser, requirePermission("dashboards:read"), dashboardsController.upcomingDue);

export default router;
