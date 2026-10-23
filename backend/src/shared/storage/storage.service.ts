import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
export const EXTENSION_BY_MIME = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["application/pdf", ".pdf"],
]);

// Assinaturas mágicas (magic bytes) para validação real de conteúdo
const MAGIC_BYTES: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  "application/pdf": Buffer.from([0x25, 0x50, 0x44, 0x46]),
};

export interface StoredFile {
  storageKey: string;        // caminho relativo dentro de STORAGE_BASE_PATH
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  clientId: string;
}

export class StorageService {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || env.STORAGE_BASE_PATH;
  }

  private clientDir(clientId: string): string {
    return path.join(this.basePath, "clients", clientId);
  }

  private fullPath(storageKey: string): string {
    return path.join(this.basePath, storageKey);
  }

  // Garante que o storageKey não escape do diretório base (previne path traversal)
  private resolveSafe(storageKey: string): string {
    const full = path.resolve(this.basePath, storageKey);
    const baseResolved = path.resolve(this.basePath);
    if (!full.startsWith(baseResolved + path.sep) && full !== baseResolved) {
      throw new Error("storageKey inválido: caminho fora do diretório de armazenamento");
    }
    return full;
  }

  ensureClientDir(clientId: string): void {
    fs.mkdirSync(this.clientDir(clientId), { recursive: true });
  }

  generateStorageKey(clientId: string, originalName: string, mimeType: string): string {
    const ext = EXTENSION_BY_MIME.get(mimeType) || path.extname(originalName).toLowerCase();
    const random = crypto.randomBytes(16).toString("hex");
    return path.posix.join("clients", clientId, `${random}${ext}`);
  }

  validateFile(file: Express.Multer.File): void {
    if (!file || !file.mimetype) {
      throw new Error("Arquivo não enviado ou tipo inválido");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Use JPEG, PNG ou PDF.`);
    }
    const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`Arquivo excede o limite de ${env.MAX_FILE_SIZE_MB} MB`);
    }
    // valida conteúdo real pelos magic bytes
    const buffer = fs.readFileSync(file.path);
    const magic = MAGIC_BYTES[file.mimetype];
    if (magic && !buffer.slice(0, magic.length).equals(magic)) {
      throw new Error("Conteúdo do arquivo não corresponde ao tipo informado");
    }
  }

  async save(file: Express.Multer.File, clientId: string): Promise<StoredFile> {
    this.ensureClientDir(clientId);
    this.validateFile(file);

    const storageKey = this.generateStorageKey(clientId, file.originalname, file.mimetype);
    const fullPath = this.resolveSafe(storageKey);

    // move o arquivo do tmp do multer para o destino definitivo
    await fs.promises.copyFile(file.path, fullPath);
    try {
      await fs.promises.unlink(file.path);
    } catch {}

    const stat = await fs.promises.stat(fullPath);

    return {
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: stat.size,
      clientId,
    };
  }

  async remove(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafe(storageKey);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolveSafe(storageKey), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readStream(storageKey: string): Promise<fs.ReadStream & { size: number; mimeType: string }> {
    const fullPath = this.resolveSafe(storageKey);
    const stat = await fs.promises.stat(fullPath);
    const stream = fs.createReadStream(fullPath);
    (stream as any).size = stat.size;
    return stream as fs.ReadStream & { size: number; mimeType: string };
  }

  listClientFiles(clientId: string): string[] {
    const dir = this.clientDir(clientId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir);
  }
}

export const storageService = new StorageService();

logger.info({ storageBasePath: env.STORAGE_BASE_PATH }, "serviço de armazenamento inicializado");
