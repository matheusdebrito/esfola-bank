import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { createTestApp, seedAdminUser, cleanupDb } from "../../test/helpers";
import { getPrisma, disconnectPrisma } from "../../config/prisma";
import { passwordService } from "../auth/password.service";

let app: Application | null = null;
let prisma: any;
let testCookies: string[] = [];

function cookieArray(res: any): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

describe("usuários (integração — requer banco de teste)", () => {
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
    const res = await request(app!)
      .post("/api/v1/auth/login")
      .send({ email: "admin@emprestimo.test", password: "Admin1234" });
    testCookies = cookieArray(res);
  });

  afterAll(async () => {
    if (prisma) {
      try {
        await cleanupDb(prisma);
      } catch {}
      await disconnectPrisma();
    }
  });

  function getCookies(): string[] {
    return testCookies;
  }

  it("deve criar um usuário (apenas admin)", async () => {
    if (!app) return;
    const res = await request(app)
      .post("/api/v1/users")
      .set("Cookie", getCookies())
      .send({ name: "Operador Teste", email: "operador@emprestimo.test", password: "Operador1234", role: "OPERATOR" })
      .expect(201);
    expect(res.body.data.user.email).toBe("operador@emprestimo.test");
    expect(res.body.data.user.role).toBe("OPERATOR");
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("deve listar usuários com paginação", async () => {
    if (!app) return;
    const res = await request(app)
      .get("/api/v1/users?page=1&pageSize=10")
      .set("Cookie", getCookies())
      .expect(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
  });

  it("deve atualizar a própria senha", async () => {
    if (!app) return;
    await request(app)
      .post("/api/v1/users/me/password")
      .set("Cookie", getCookies())
      .send({ currentPassword: "Admin1234", newPassword: "Admin1234!" })
      .expect(200);
  });

  it("deve rejeitar criação de usuário por não-admin", async () => {
    if (!app) return;
    await prisma.user.create({
      data: { email: "op2@emprestimo.test", name: "Op2", passwordHash: await passwordService.hash("x"), role: "OPERATOR", active: true },
    });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "op2@emprestimo.test", password: "x" });
    const opCookies = cookieArray(res);
    await request(app)
      .post("/api/v1/users")
      .set("Cookie", opCookies)
      .send({ name: "X", email: "x@emprestimo.test", password: "x123456", role: "OPERATOR" })
      .expect(403);
  });
});
