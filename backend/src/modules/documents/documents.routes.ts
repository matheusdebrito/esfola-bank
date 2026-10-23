import { Router } from "express";
import { authenticate, loadFreshUser } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { upload } from "../../shared/storage/multer.config";
import { documentsController } from "./documents.controller";

const router = Router();

// upload: autenticado + permissão de upload
router.post("/clients/:clientId/documents", authenticate, loadFreshUser, requirePermission("documents:upload"), upload.single("file"), documentsController.upload);

// listagem de documentos de um cliente
router.get("/clients/:clientId/documents", authenticate, loadFreshUser, requirePermission("documents:read"), documentsController.list);

// download: autenticado + permissão de download
router.get("/documents/:id/download", authenticate, loadFreshUser, requirePermission("documents:download"), documentsController.download);

// remoção: autenticado + permissão de remoção
router.delete("/documents/:id", authenticate, loadFreshUser, requirePermission("documents:remove"), documentsController.remove);

export default router;
