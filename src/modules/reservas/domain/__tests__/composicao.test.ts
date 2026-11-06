import { describe, expect, it } from "vitest";
import { calcularComposicao } from "../composicao";

describe("composicao (dominio)", () => {
  it("exemplo do PRD: 5 fixos + 2 reposicoes + 1 experimental enche 8 com vagas 0", () => {
    expect(
      calcularComposicao({
        capacity: 8,
        fixos: 5,
        reposicoes: 2,
        experimentais: 1,
      }),
    ).toEqual({
      fixos: 5,
      reposicoes: 2,
      experimentais: 1,
      total: 8,
      vagas: 0,
    });
  });

  it("ocorrencia vazia mantem todas as vagas", () => {
    expect(
      calcularComposicao({
        capacity: 8,
        fixos: 0,
        reposicoes: 0,
        experimentais: 0,
      }),
    ).toEqual({
      fixos: 0,
      reposicoes: 0,
      experimentais: 0,
      total: 0,
      vagas: 8,
    });
  });

  it("composicao excedente deixa vagas negativas (RES-22)", () => {
    const resultado = calcularComposicao({
      capacity: 8,
      fixos: 5,
      reposicoes: 2,
      experimentais: 2,
    });
    expect(resultado.total).toBe(9);
    expect(resultado.vagas).toBe(-1);
  });

  it("soma cada vinculo separadamente", () => {
    const soFixos = calcularComposicao({
      capacity: 5,
      fixos: 3,
      reposicoes: 0,
      experimentais: 0,
    });
    expect(soFixos.total).toBe(3);
    expect(soFixos.vagas).toBe(2);

    const soReservas = calcularComposicao({
      capacity: 5,
      fixos: 0,
      reposicoes: 2,
      experimentais: 2,
    });
    expect(soReservas.total).toBe(4);
    expect(soReservas.vagas).toBe(1);
  });
});
