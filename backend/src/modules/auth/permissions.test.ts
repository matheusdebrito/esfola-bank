import { describe, expect, it } from "vitest";
import { authService } from "./auth.service";
import { PERMISSIONS, hasPermission, rolePermissions } from "./permissions";

const baseUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "usuario@teste.local",
  name: "Usuário de Teste",
  active: true,
};

describe("authService.mapUser — permissões", () => {
  it("deve expor as permissões efetivas do administrador", () => {
    const user = authService.mapUser({ ...baseUser, role: "ADMIN" });

    expect(user.role).toBe("ADMIN");
    expect(user.permissions).toContain(PERMISSIONS.LOAN_READ);
    expect(user.permissions).toContain(PERMISSIONS.PAYMENT_REVERSE);
    expect(user.permissions).toHaveLength(rolePermissions.ADMIN.length);
  });

  it("deve limitar as permissões do operador", () => {
    const user = authService.mapUser({ ...baseUser, role: "OPERATOR" });

    expect(user.permissions).toContain(PERMISSIONS.PAYMENT_REGISTER);
    expect(user.permissions).not.toContain(PERMISSIONS.PAYMENT_REVERSE);
    expect(user.permissions).not.toContain(PERMISSIONS.CLIENT_DELETE);
  });

  it("deve retornar lista vazia para papel desconhecido", () => {
    const user = authService.mapUser({ ...baseUser, role: "VISITANTE" });

    expect(user.permissions).toEqual([]);
  });

  it("não deve vazar dados sensíveis do usuário", () => {
    const user = authService.mapUser({ ...baseUser, role: "ADMIN" });

    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("active");
  });
});

describe("hasPermission", () => {
  it("deve validar permissões por papel", () => {
    expect(hasPermission("MANAGER", PERMISSIONS.LOAN_UPDATE)).toBe(true);
    expect(hasPermission("OPERATOR", PERMISSIONS.LOAN_UPDATE)).toBe(false);
    expect(hasPermission("PAPEL_INVALIDO", PERMISSIONS.LOAN_READ)).toBe(false);
  });
});
