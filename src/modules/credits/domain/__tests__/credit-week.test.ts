import { describe, expect, it } from "vitest";
import { countWeeklyMakeups, weekKey } from "../credit-week";

// Semana de segunda a domingo no fuso do estudio (CRD-19, CRD-20). A semana
// contada e a da data da ocorrencia da reposicao, nao a da data do pedido.
describe("credit week", () => {
  it("starts the week on monday", () => {
    // 2026-11-09 e segunda, 2026-11-15 e domingo da mesma semana
    expect(weekKey("2026-11-09")).toBe("2026-11-09");
    expect(weekKey("2026-11-15")).toBe("2026-11-09");
  });

  it("returns the same key for the seven days of the week", () => {
    const week = [
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ];

    const keys = week.map((date) => weekKey(date));

    expect(keys).toEqual(week.map(() => "2026-11-09"));
  });

  it("changes the key on the week rollover", () => {
    // Segunda seguinte: 2026-11-16
    expect(weekKey("2026-11-16")).toBe("2026-11-16");
    expect(weekKey("2026-11-16")).not.toBe(weekKey("2026-11-15"));
  });

  it("counts only the makeups of the monday to sunday week of the occurrence", () => {
    const bookings = [
      // Semana da ocorrencia (2026-11-09 a 2026-11-15): contam
      { bookingType: "MAKEUP" as const, status: "ATIVA" as const, sessionDate: "2026-11-09" },
      { bookingType: "MAKEUP" as const, status: "ATIVA" as const, sessionDate: "2026-11-15" },
      // Semana anterior e seguinte: nao contam
      { bookingType: "MAKEUP" as const, status: "ATIVA" as const, sessionDate: "2026-11-08" },
      { bookingType: "MAKEUP" as const, status: "ATIVA" as const, sessionDate: "2026-11-16" },
      // Nao e reposicao: nao conta
      { bookingType: "FIXED" as const, status: "ATIVA" as const, sessionDate: "2026-11-11" },
    ];

    expect(countWeeklyMakeups(bookings, "2026-11-10")).toBe(2);
    // A semana e a da ocorrencia: a reposicao da semana seguinte nao entra
    expect(countWeeklyMakeups(bookings, "2026-11-17")).toBe(1);
  });

  it("ignores cancelled makeups", () => {
    const bookings = [
      { bookingType: "MAKEUP" as const, status: "CANCELADA" as const, sessionDate: "2026-11-10" },
      { bookingType: "MAKEUP" as const, status: "FALTA" as const, sessionDate: "2026-11-11" },
      { bookingType: "MAKEUP" as const, status: "ATIVA" as const, sessionDate: "2026-11-12" },
    ];

    expect(countWeeklyMakeups(bookings, "2026-11-09")).toBe(1);
  });
});
