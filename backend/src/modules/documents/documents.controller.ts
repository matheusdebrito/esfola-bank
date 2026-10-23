import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { documentsService } from "./documents.service";
import { documentUploadSchema, type DocumentType } from "./documents.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { storageService } from "../../shared/storage/storage.service";
import { NotFoundError } from "../../shared/errors";

export const documentsController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: true, message: "Arquivo não enviado", statusCode: 400, code: "FILE_REQUIRED" });
      return;
    }
    const parsed = documentUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: true, message: "Tipo de documento inválido", statusCode: 400, code: "INVALID_DOCUMENT_TYPE" });
      return;
    }
    const type = parsed.data.type as DocumentType;
    const document = await documentsService.upload(req.params.clientId, file, type, authReq.user!.id, req.ip, req.get("user-agent"));
    res.status(201).json({ error: false, message: "Documento enviado com sucesso", data: { document } });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const documents = await documentsService.list(req.params.clientId);
    res.json({ error: false, data: { documents } });
  }),

  download: asyncHandler(async (req: Request, res: Response) => {
    const document = await documentsService.getById(req.params.id);
    const exists = await storageService.exists(document.storageKey);
    if (!exists) {
      throw new NotFoundError("Arquivo não encontrado no armazenamento", "FILE_NOT_FOUND");
    }
    const stream = await storageService.readStream(document.storageKey);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(document.originalName)}"`);
    res.setHeader("Content-Length", String(stream.size));
    // não exibe caminho físico do servidor
    stream.pipe(res);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    await documentsService.remove(req.params.id, authReq.user!.id, req.ip, req.get("user-agent"));
    res.json({ error: false, message: "Documento removido com sucesso" });
  }),
};

export default documentsController;
