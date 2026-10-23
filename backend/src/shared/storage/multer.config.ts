import multer from "multer";
import os from "os";
import crypto from "crypto";
import { env } from "../../config/env";

// Armazena temporariamente no tmp do sistema; o StorageService move para o destino definitivo.
const tmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${pathExt(file.originalname)}`);
  },
});

function pathExt(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return /^[.][a-z0-9]+$/.test(ext) ? ext : "";
}

export const upload = multer({
  storage: tmpStorage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
});
