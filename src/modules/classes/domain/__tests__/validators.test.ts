import { describe, expect, it } from "vitest";
import { validateSlot } from "../validators";

describe("validators", () => {
  it("accepts a valid class", () => {
    expect(
      validateSlot({
        weekday: 3, // terca 19h-20h, capacidade do PRD
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity: 8,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects an end time less than or equal to the start", () => {
    const earlier = validateSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "18:00:00",
      capacity: 8,
    });
    expect(earlier).toEqual({
      ok: false,
      errors: [{ field: "endTime", message: "endTime deve ser maior que startTime" }],
    });

    const equal = validateSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "19:00:00",
      capacity: 8,
    });
    expect(equal.ok).toBe(false);
    if (!equal.ok) {
      expect(equal.errors.map((e) => e.field)).toEqual(["endTime"]);
    }
  });

  it("rejects a weekday outside 1 to 7", () => {
    for (const weekday of [0, 8, -1]) {
      const result = validateSlot({
        weekday,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity: 8,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.field)).toEqual(["weekday"]);
      }
    }
  });

  it("rejects a capacity lower than 1", () => {
    for (const capacity of [0, -2]) {
      const result = validateSlot({
        weekday: 3,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.field)).toEqual(["capacity"]);
        expect(result.errors[0].message).toBe("capacity deve ser maior ou igual a 1");
      }
    }
  });

  it("rejects every invalid field naming the offending one", () => {
    // fim menor ou igual ao inicio
    for (const endTime of ["18:00:00", "19:00:00"]) {
      const result = validateSlot({
        weekday: 3,
        startTime: "19:00:00",
        endTime,
        capacity: 8,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.field)).toEqual(["endTime"]);
        expect(result.errors[0].message).toContain("endTime");
      }
    }

    // dia da semana fora de 1-7
    for (const weekday of [0, 8, -1]) {
      const result = validateSlot({
        weekday,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity: 8,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.field)).toEqual(["weekday"]);
        expect(result.errors[0].message).toContain("weekday");
      }
    }

    // capacidade menor que 1
    for (const capacity of [0, -2]) {
      const result = validateSlot({
        weekday: 3,
        startTime: "19:00:00",
        endTime: "20:00:00",
        capacity,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.field)).toEqual(["capacity"]);
        expect(result.errors[0].message).toContain("capacity");
      }
    }

    // os tres campos invalidos ao mesmo tempo, cada um nomeado
    const all = validateSlot({
      weekday: 9,
      startTime: "21:00:00",
      endTime: "20:00:00",
      capacity: 0,
    });
    expect(all.ok).toBe(false);
    if (!all.ok) {
      expect(all.errors.map((e) => e.field)).toEqual([
        "weekday",
        "endTime",
        "capacity",
      ]);
    }
  });

  it("rejects empty or malformed required fields", () => {
    const emptyStart = validateSlot({
      weekday: 3,
      startTime: "",
      endTime: "20:00:00",
      capacity: 8,
    });
    expect(emptyStart.ok).toBe(false);
    if (!emptyStart.ok) {
      expect(emptyStart.errors.map((e) => e.field)).toEqual(["startTime"]);
    }

    const emptyEnd = validateSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "",
      capacity: 8,
    });
    expect(emptyEnd.ok).toBe(false);
    if (!emptyEnd.ok) {
      expect(emptyEnd.errors.map((e) => e.field)).toEqual(["endTime"]);
    }

    const malformed = validateSlot({
      weekday: 3,
      startTime: "25:00",
      endTime: "26:00",
      capacity: 8,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.errors.map((e) => e.field)).toEqual(["startTime", "endTime"]);
    }

    const notIntegerWeekday = validateSlot({
      weekday: 3.5,
      startTime: "19:00:00",
      endTime: "20:00:00",
      capacity: 8,
    });
    expect(notIntegerWeekday.ok).toBe(false);
    if (!notIntegerWeekday.ok) {
      expect(notIntegerWeekday.errors.map((e) => e.field)).toEqual(["weekday"]);
    }

    const fractionalCapacity = validateSlot({
      weekday: 3,
      startTime: "19:00:00",
      endTime: "20:00:00",
      capacity: 8.5,
    });
    expect(fractionalCapacity.ok).toBe(false);
    if (!fractionalCapacity.ok) {
      expect(fractionalCapacity.errors.map((e) => e.field)).toEqual(["capacity"]);
    }
  });

  it("points out all invalid fields at once", () => {
    const result = validateSlot({
      weekday: 9,
      startTime: "21:00:00",
      endTime: "20:00:00",
      capacity: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.field)).toEqual(["weekday", "endTime", "capacity"]);
    }
  });
});
