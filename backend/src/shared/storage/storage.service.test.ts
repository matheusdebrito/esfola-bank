import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { StorageService, ALLOWED_MIME_TYPES } from "./storage.service";

describe("storageService", () => {
  let tmpDir: string;
  let storage: StorageService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emprestimo-storage-test-"));
    storage = new StorageService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("salva, lê e remove um arquivo", async () => {
    const filePath = path.join(tmpDir, "upload.jpg");
    fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0x00]));

    const file: Express.Multer.File = {
      fieldname: "file",
      originalname: "rg.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: 4,
      destination: tmpDir,
      filename: "upload.jpg",
      path: filePath,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      stream: null as any,
    };

    const stored = await storage.save(file, "client-1");
    expect(stored.clientId).toBe("client-1");
    expect(stored.mimeType).toBe("image/jpeg");
    expect(stored.originalName).toBe("rg.jpg");
    expect(stored.storageKey).toMatch(/^clients\/client-1\//);
    expect(stored.storageKey.endsWith(".jpg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has(stored.mimeType)).toBe(true);

    const stream = await storage.readStream(stored.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const content = Buffer.concat(chunks);
    expect(content.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);

    await storage.remove(stored.storageKey);
    expect(await storage.exists(`clients/client-1/${path.basename(stored.storageKey)}`)).toBe(false);
  });

  it("rejeita tipo de arquivo não permitido", async () => {
    const filePath = path.join(tmpDir, "bad.exe");
    fs.writeFileSync(filePath, Buffer.from([0x4d, 0x5a]));

    const file: Express.Multer.File = {
      fieldname: "file",
      originalname: "bad.exe",
      encoding: "7bit",
      mimetype: "application/x-msdownload",
      size: 2,
      destination: tmpDir,
      filename: "bad.exe",
      path: filePath,
      buffer: Buffer.from([0x4d, 0x5a]),
      stream: null as any,
    };

    await expect(storage.save(file, "client-1")).rejects.toThrow();
  });
});
