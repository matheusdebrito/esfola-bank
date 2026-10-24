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
  it("permite alterar o próprio nome, sem permitir alterar e-mail ou papel", async () => {
    if (!app) return;
    const admin = await prisma.user.findUnique({ where: { email: "admin@emprestimo.test" } });
    const result = await request(app).patch("/api/v1/users/me").set("Cookie", getCookies())
      .send({ name: "Administrador Atualizado" }).expect(200);
    expect(result.body.data.user.name).toBe("Administrador Atualizado");
    expect(result.body.data.user.email).toBe("admin@emprestimo.test");
    await request(app).patch("/api/v1/users/me").set("Cookie", getCookies())
      .send({ name: "Outro", email: "mudado@teste.com" }).expect(400);
    await request(app).patch("/api/v1/users/me").set("Cookie", getCookies())
      .send({ name: "Outro", role: "OPERATOR" }).expect(400);
    const after = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(after.email).toBe(admin.email);
    expect(after.role).toBe("ADMIN");
  });

  it("admin edita outros usuários, e-mail permanece imutável", async () => {
    if (!app) return;
    const user = await prisma.user.findUnique({ where: { email: "operador@emprestimo.test" } });
    const updated = await request(app).patch("/api/v1/users/" + user.id).set("Cookie", getCookies())
      .send({ name: "Operador Editado", role: "AUDITOR", active: true }).expect(200);
    expect(updated.body.data.user.name).toBe("Operador Editado");
    expect(updated.body.data.user.role).toBe("AUDITOR");
    await request(app).patch("/api/v1/users/" + user.id).set("Cookie", getCookies())
      .send({ email: "outro@emprestimo.test" }).expect(400);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).email).toBe(user.email);
    const admin = await prisma.user.findUnique({ where: { email: "admin@emprestimo.test" } });
    await request(app).patch("/api/v1/users/" + admin.id).set("Cookie", getCookies())
      .send({ role: "OPERATOR" }).expect(403);
  });

  it("exclusão lógica preserva usuário histórico e bloqueia acesso, sem liberar e-mail", async () => {
    if (!app) return;
    const operator = await prisma.user.findUnique({ where: { email: "op2@emprestimo.test" } });
    await request(app).delete("/api/v1/users/" + operator.id).set("Cookie", getCookies()).expect(200);
    const stored = await prisma.user.findUnique({ where: { id: operator.id } });
    expect(stored.active).toBe(false);
    expect(stored.deletedAt).toBeTruthy();
    const list = await request(app).get("/api/v1/users?page=1&pageSize=100")
      .set("Cookie", getCookies()).expect(200);
    expect(list.body.data.items.some((u: any) => u.id === operator.id)).toBe(false);
    await request(app).post("/api/v1/auth/login")
      .send({ email: "op2@emprestimo.test", password: "x" }).expect(401);
    await request(app).post("/api/v1/users").set("Cookie", getCookies())
      .send({ name: "Novo Operador", email: "op2@emprestimo.test", password: "Senha1234", role: "OPERATOR" }).expect(409);
    await request(app).delete("/api/v1/users/" + operator.id).set("Cookie", getCookies()).expect(404);
    const admin = await prisma.user.findUnique({ where: { email: "admin@emprestimo.test" } });
    await request(app).delete("/api/v1/users/" + admin.id).set("Cookie", getCookies()).expect(403);
    const logs = await prisma.auditLog.findMany({ where: { action: "USER_DELETE", entityId: operator.id } });
    expect(logs).toHaveLength(1);
  });

  it("perfis não administrativos não podem editar ou excluir outros usuários", async () => {
    if (!app) return;
    const op = await prisma.user.create({
      data: { email: "gestor@emprestimo.test", name: "Gerente", passwordHash: await passwordService.hash("senha123"), role: "MANAGER", active: true },
    });
    const auth = await request(app).post("/api/v1/auth/login")
      .send({ email: op.email, password: "senha123" }).expect(200);
    const cookies = cookieArray(auth);
    const admin = await prisma.user.findUnique({ where: { email: "admin@emprestimo.test" } });
    await request(app).patch("/api/v1/users/" + admin.id).set("Cookie", cookies)
      .send({ name: "Teste ataque" }).expect(403);
    await request(app).delete("/api/v1/users/" + admin.id).set("Cookie", cookies).expect(403);
    await request(app).patch("/api/v1/users/me").set("Cookie", cookies)
      .send({ name: "Gerente Atualizado" }).expect(200);
  });

});
