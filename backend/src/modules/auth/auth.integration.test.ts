import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { createTestApp, seedAdminUser, cleanupDb } from "../../test/helpers";
import { getPrisma, disconnectPrisma } from "../../config/prisma";

let app: Application | null = null;
let prisma: any;

function cookieArray(res: any): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

describe("auth (integração — requer banco de teste)", () => {
  beforeAll(async () => {
    prisma = getPrisma();
    try {
      await prisma.$connect();
    } catch {
      return;
    }
    app = createTestApp();
    await cleanupDb(prisma);
    await seedAdminUser(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      try {
        await cleanupDb(prisma);
      } catch {}
      await disconnectPrisma();
    }
  });

  it("deve logar com admin e retornar cookies de sessão", async () => {
    if (!app) return;
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@emprestimo.test", password: "Admin1234" })
      .expect(200);
    expect(res.body.error).toBe(false);
    expect(res.body.data.user.email).toBe("admin@emprestimo.test");
    const cookies = cookieArray(res);
    const accessCookie = cookies.find((c) => c.startsWith("access_token="));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain("HttpOnly");
  });

  it("deve rejeitar credenciais inválidas", async () => {
    if (!app) return;
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@emprestimo.test", password: "senha_errada" })
      .expect(401);
  });

  it("deve acessar /me autenticado e negar sem token", async () => {
    if (!app) return;
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@emprestimo.test", password: "Admin1234" });
    const cookies = cookieArray(login);
    await request(app).get("/api/v1/auth/me").set("Cookie", cookies).expect(200);
    await request(app).get("/api/v1/auth/me").expect(401);
  });
});
