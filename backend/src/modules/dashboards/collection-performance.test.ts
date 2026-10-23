import { describe, expect, it } from "vitest";
import { collectionPerformance } from "./collection-performance";

describe("desempenho dos vencimentos", () => {
  it("mede somente a parte cumprida das obrigações", () => {
    expect(collectionPerformance(15000, 9000)).toEqual({ scheduled: 15000, settled: 9000, rate: 60 });
  });
  it("não exibe taxa inventada na ausência de vencimentos", () => {
    expect(collectionPerformance(0, 500)).toEqual({ scheduled: 0, settled: 0, rate: null });
  });
  it("não deixa ultrapassar 100% por erros de arredondamento", () => {
    expect(collectionPerformance(10, 10.01)).toEqual({ scheduled: 10, settled: 10, rate: 100 });
  });
  it("mantém arredondamento em centavos", () => {
    expect(collectionPerformance(3.33, 1.11)).toEqual({ scheduled: 3.33, settled: 1.11, rate: 33.33 });
  });
});
