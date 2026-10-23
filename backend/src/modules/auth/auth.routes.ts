import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { authController } from "./auth.controller";

const router = Router();

router.post("/login", authController.login);
router.post("/logout", authenticate, authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me", authenticate, loadFreshUser, authController.me);

export default router;
