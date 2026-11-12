import { describe, expect, it } from "vitest";
import { validatePlan } from "../validators";

// PLAN-02: nome, valor mensal e aulas por semana sao recusados no servidor
// com erro especifico do campo, antes de tocar o banco.

function planData(overrides: Partial<Parameters<typeof validatePlan>[0]> = {}) {
  return { name: "Mensal Ilimitado", price: "180.00", weeklyFrequency: 2, ...overrides };
}

describe("plan validators", () => {
  it("aceita um plano completo (PLAN-01)", () => {
    expect(validatePlan(planData())).toEqual({ ok: true });
  });

  it("recusa nome vazio com erro do campo", () => {
    const result = validatePlan(planData({ name: "   " }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        field: "name",
        message: expect.any(String),
      });
    }
  });

  it("recusa price igual a zero com erro do campo (PLAN-02)", () => {
    const result = validatePlan(planData({ price: "0.00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("price");
    }
  });

  it("recusa price negativo com erro do campo (PLAN-02)", () => {
    const result = validatePlan(planData({ price: "-10.00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("price");
    }
  });

  it("recusa price nao numerico com erro do campo (PLAN-02)", () => {
    for (const price of ["", "abc", "  "]) {
      const result = validatePlan(planData({ price }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe("price");
      }
    }
  });

  it("recusa frequencia menor que 1 com erro do campo (PLAN-02)", () => {
    const result = validatePlan(planData({ weeklyFrequency: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("weeklyFrequency");
    }
  });

  it("acumula os erros de todos os campos invalidos", () => {
    const result = validatePlan({ name: "", price: "0", weeklyFrequency: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual([
        "name",
        "price",
        "weeklyFrequency",
      ]);
    }
  });
});
