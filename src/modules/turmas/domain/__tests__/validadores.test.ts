import { describe, expect, it } from "vitest";
import { validarSlot } from "../validadores";

describe("validadores", () => {
  it("aceita turma valida", () => {
    expect(
      validarSlot({
        weekday: 3, // terca 19h-20h, capacidade do PRD
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity: 8,
      }),
    ).toEqual({ ok: true });
  });

  it("recusa fim menor ou igual ao inicio", () => {
    const menor = validarSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "18:00:00",
      capacity: 8,
    });
    expect(menor).toEqual({
      ok: false,
      erros: [{ campo: "endTime", mensagem: "endTime deve ser maior que startTime" }],
    });

    const igual = validarSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "19:00:00",
      capacity: 8,
    });
    expect(igual.ok).toBe(false);
    if (!igual.ok) {
      expect(igual.erros.map((e) => e.campo)).toEqual(["endTime"]);
    }
  });

  it("recusa weekday fora de 1 a 7", () => {
    for (const weekday of [0, 8, -1]) {
      const resultado = validarSlot({
        weekday,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity: 8,
      });
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.erros.map((e) => e.campo)).toEqual(["weekday"]);
      }
    }
  });

  it("recusa capacity menor que 1", () => {
    for (const capacity of [0, -2]) {
      const resultado = validarSlot({
        weekday: 3,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity,
      });
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.erros.map((e) => e.campo)).toEqual(["capacity"]);
        expect(resultado.erros[0].mensagem).toBe("capacity deve ser maior ou igual a 1");
      }
    }
  });

  it("aponta todos os campos invalidos de uma vez", () => {
    const resultado = validarSlot({
      weekday: 9,
      startTime: "21:00:00",
      endTime: "20:00:00",
      capacity: 0,
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erros.map((e) => e.campo)).toEqual(["weekday", "endTime", "capacity"]);
    }
  });
});
