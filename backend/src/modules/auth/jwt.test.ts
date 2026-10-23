import { describe, it, expect } from "vitest";
import { jwtService } from "./jwt.service";

const payload = { sub: "user-123", email: "ana@example.com", name: "Ana Silva", role: "OPERATOR" };

describe("jwtService", () => {
  it("deve assinar e verificar token de acesso", () => {
    const token = jwtService.signAccess(payload);
    expect(typeof token).toBe("string");
    const decoded = jwtService.verifyAccess(token);
    expect(decoded.sub).toBe("user-123");
    expect(decoded.email).toBe("ana@example.com");
    expect(decoded.role).toBe("OPERATOR");
  });

  it("deve assinar e verificar token de refresh", () => {
    const token = jwtService.signRefresh(payload);
    const decoded = jwtService.verifyRefresh(token);
    expect(decoded.sub).toBe("user-123");
  });

  it("deve rejeitar token com assinatura inválida", () => {
    const token = jwtService.signAccess(payload);
    const corrupt = token.slice(0, -5) + "XXXXX";
    expect(() => jwtService.verifyAccess(corrupt)).toThrow();
  });

  it("deve decodificar token sem verificar", () => {
    const token = jwtService.signAccess(payload);
    const decoded = jwtService.decode(token);
    expect(decoded?.sub).toBe("user-123");
    expect(jwtService.decode("invalido")).toBeNull();
  });
});
