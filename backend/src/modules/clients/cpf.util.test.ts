import { describe, it, expect } from "vitest";
import { normalizeCpf, validateCpf, maskCpf } from "./cpf.util";

describe("cpf.util", () => {
  it("normaliza CPF removendo máscara", () => {
    expect(normalizeCpf("123.456.789-09")).toBe("12345678909");
  });

  it("valida CPFs válidos", () => {
    expect(validateCpf("123.456.789-09")).toBe(true);
    expect(validateCpf("11144477735")).toBe(true);
  });

  it("rejeita CPFs inválidos", () => {
    expect(validateCpf("111.111.111-11")).toBe(false);
    expect(validateCpf("123.456.789-00")).toBe(false);
    expect(validateCpf("12345")).toBe(false);
    expect(validateCpf("abc.def.ghi-jk")).toBe(false);
  });

  it("máscara exibe apenas parte do CPF", () => {
    const masked = maskCpf("12345678909");
    expect(masked).toMatch(/^\*{3}\.\*{3}\.\d{3}-\*{2}$/);
    expect(masked).not.toBe("12345678909");
    expect(masked).not.toContain("12345678909");
  });
});
