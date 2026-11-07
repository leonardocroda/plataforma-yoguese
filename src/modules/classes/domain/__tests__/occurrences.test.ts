import { describe, expect, it } from "vitest";
import {
  addDays,
  occurrenceDates,
  todayInStudio,
  isDatePast,
  nextOccurrence,
  weekdayOf,
} from "../occurrences";

// Testes derivados de RES-06 (datas de ocorrencia) e RES-10 (data passada/hoje
// no fuso do estudio). Semana 2026-11: 01=domingo, 07=sabado.
describe("occurrences", () => {
  it("rejects only the date strictly before today", () => {
    const today = "2026-11-06";
    expect(isDatePast("2026-11-05", today)).toBe(true);
    expect(isDatePast(today, today)).toBe(false);
    expect(isDatePast("2026-11-07", today)).toBe(false);
    expect(isDatePast("2026-12-12", today)).toBe(false);
  });

  it("today in the studio timezone changes at local midnight (03:00 UTC)", () => {
    // 22:59 de 2026-11-04 em America/Sao_Paulo
    expect(todayInStudio(new Date("2026-11-05T01:59:00Z"))).toBe("2026-11-04");
    // 00:00 de 2026-11-05 em America/Sao_Paulo
    expect(todayInStudio(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-05");
  });

  it("weekday follows 1=sunday to 7=saturday", () => {
    expect(weekdayOf("2026-11-01")).toBe(1); // domingo
    expect(weekdayOf("2026-11-03")).toBe(3); // terca
    expect(weekdayOf("2026-11-07")).toBe(7); // sabado
  });

  it("occurrence dates cover the edges and the month/year rollover", () => {
    // Turma de terca (3): 2025-12-30 (terca, extremo) e 2026-01-06 caiem no
    // range que atravessa a virada do ano
    expect(
      occurrenceDates({ weekday: 3 }, "2025-12-30", "2026-01-07"),
    ).toEqual(["2025-12-30", "2026-01-06"]);

    // Virada de fevereiro em ano bissexto: tercas entre 28/02 e 10/03/2024
    expect(occurrenceDates({ weekday: 3 }, "2024-02-25", "2024-03-10")).toEqual(
      ["2024-02-27", "2024-03-05"],
    );
  });

  it("occurrence dates include both edges when they match the slot", () => {
    // Turma de sexta (6): 2026-11-06 e uma sexta
    expect(occurrenceDates({ weekday: 6 }, "2026-11-06", "2026-11-20")).toEqual(
      ["2026-11-06", "2026-11-13", "2026-11-20"],
    );
  });

  it("occurrence dates with an invalid range return an empty list", () => {
    expect(occurrenceDates({ weekday: 3 }, "2026-11-10", "2026-11-03")).toEqual(
      [],
    );
  });

  it("occurrence dates do not shift during the daylight saving transition", () => {
    // Domingos entre os dias em que America/Sao_Paulo mudava de horario
    // (transicao historica em 04/11/2018): a semana calendario continua
    // sem deslocar datas.
    expect(
      occurrenceDates({ weekday: 1 }, "2018-10-28", "2018-11-25"),
    ).toEqual([
      "2018-10-28",
      "2018-11-04",
      "2018-11-11",
      "2018-11-18",
      "2018-11-25",
    ]);
  });

  it("next occurrence is the same day when today is a class day", () => {
    expect(nextOccurrence({ weekday: 3 }, "2026-11-03")).toBe("2026-11-03");
  });

  it("next occurrence advances to the following week", () => {
    expect(nextOccurrence({ weekday: 3 }, "2026-11-04")).toBe("2026-11-10");
  });

  it("addDays crosses the month boundary", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});
