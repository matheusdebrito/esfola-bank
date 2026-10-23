import { prisma } from "../../config/prisma";
import { auditService } from "../audit/audit.service";
import { storageService } from "../../shared/storage/storage.service";
import { NotFoundError } from "../../shared/errors";
import type { DocumentType } from "./documents.schema";

type DocumentMeta = {
  id: string;
  clientId: string;
  type: DocumentType;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  state: string;
  uploadedBy: string | null;
  uploadedAt: Date;
  downloadUrl: string;
};

export const documentsService = {
  async upload(clientId: string, file: Express.Multer.File, type: DocumentType, userId: string, ip?: string, userAgent?: string) {
    // verifica cliente
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      // arquivo pode ter sido gravado pelo multer no tmp; limpa
      try { await fsPromises.unlink(file.path); } catch {}
      throw new NotFoundError("Cliente não encontrado", "CLIENT_NOT_FOUND");
    }

    let stored;
    try {
      stored = await storageService.save(file, clientId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Falha ao armazenar arquivo");
    }

    let document;
    try {
      document = await prisma.clientDocument.create({
        data: {
          clientId,
          type,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          uploadedBy: userId,
          state: "APPROVED",
        },
      });
    } catch (err) {
      // falha na persistência: remove o arquivo gravado para não deixar órfão
      try { await storageService.remove(stored.storageKey); } catch {}
      throw err;
    }

    await auditService.log({
      userId,
      action: "DOCUMENT_UPLOAD",
      entityType: "ClientDocument",
      entityId: document.id,
      newValues: { clientId, type, originalName: stored.originalName, mimeType: stored.mimeType },
      ip,
      userAgent,
    });

    return this.toMeta(document);
  },

  async list(clientId: string) {
    const documents = await prisma.clientDocument.findMany({
      where: { clientId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true, clientId: true, type: true, storageKey: true, originalName: true,
        mimeType: true, sizeBytes: true, state: true, uploadedBy: true, uploadedAt: true,
      },
    });
    return documents.map((d) => this.toMeta(d));
  },

  async getById(documentId: string) {
    const document = await prisma.clientDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundError("Documento não encontrado", "DOCUMENT_NOT_FOUND");
    }
    return document;
  },

  async remove(documentId: string, userId: string, ip?: string, userAgent?: string) {
    const document = await this.getById(documentId);

    // remove arquivo físico
    try {
      await storageService.remove(document.storageKey);
    } catch {}

    const updated = await prisma.clientDocument.update({
      where: { id: documentId },
      data: { state: "REJECTED" }, // mantém trilha, não apaga o registro
    });

    await auditService.log({
      userId,
      action: "DOCUMENT_REMOVE",
      entityType: "ClientDocument",
      entityId: documentId,
      oldValues: { type: document.type, originalName: document.originalName, storageKey: document.storageKey },
      newValues: { state: updated.state },
      ip,
      userAgent,
    });

    return { message: "Documento removido com sucesso" };
  },

  toMeta(document: any): DocumentMeta {
    return {
      id: document.id,
      clientId: document.clientId,
      type: document.type,
      storageKey: document.storageKey,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      state: document.state,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.uploadedAt,
      downloadUrl: `/api/v1/documents/${document.id}/download`,
    };
  },
};

const fsPromises = require("fs").promises;
