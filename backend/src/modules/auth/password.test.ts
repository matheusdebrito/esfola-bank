import { describe, it, expect } from "vitest";
import { passwordService } from "./password.service";

describe("passwordService", () => {
  it("deve gerar hash e verificar senha corretamente", async () => {
    const hash = await passwordService.hash("SenhaSegura123");
    expect(hash).not.toBe("SenhaSegura123");
    expect(await passwordService.verify(hash, "SenhaSegura123")).toBe(true);
    expect(await passwordService.verify(hash, "SenhaErrada")).toBe(false);
  });

  it("deve rejeitar senhas diferentes", async () => {
    const hash1 = await passwordService.hash("abc");
    const hash2 = await passwordService.hash("abc");
    // hashes devem ser diferentes (sal aleatório)
    expect(hash1).not.toBe(hash2);
    expect(await passwordService.verify(hash1, "abc")).toBe(true);
  });
});
