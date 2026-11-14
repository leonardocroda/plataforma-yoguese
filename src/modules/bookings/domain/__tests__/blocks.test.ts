import { describe, expect, it } from "vitest";
import {
  isDateCoveredByBlocks,
  isOccurrenceCoveredByBlocks,
  resolveBlockTransition,
} from "../blocks";

// Regras do spec: FER-01 (coberta e AGENDADA vira BLOQUEADA), FER-06 (efeito
// so de hoje em diante), FER-07 (CANCELADA intocada), FER-10 (descoberta e
// BLOQUEADA volta a AGENDADA), FER-12 (idempotencia), FER-13 (passado fica),
// FER-14 (guarda do dia da semana) e FER-02 (extremos inclusos do recesso).

const TODAY = "2026-11-10";
const HOLIDAY = { kind: "holiday", date: "2026-12-25" } as const;
const CLOSURE = {
  kind: "closure",
  startDate: "2026-12-20",
  endDate: "2026-12-31",
} as const;

function transition(overrides: {
  date: string;
  currentStatus: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
  isCovered: boolean;
  slotWeekday?: number;
}) {
  return resolveBlockTransition({
    today: TODAY,
    slotWeekday: 3,
    ...overrides,
  });
}

describe("block transition (domain)", () => {
  it("blocks a covered scheduled occurrence", () => {
    expect(
      transition({ date: "2026-12-25", currentStatus: "AGENDADA", isCovered: true }),
    ).toBe("BLOQUEADA");
  });

  it("keeps an uncovered scheduled occurrence as is", () => {
    expect(
      transition({ date: "2026-11-17", currentStatus: "AGENDADA", isCovered: false }),
    ).toBeNull();
  });

  it("keeps a covered blocked occurrence as is", () => {
    expect(
      transition({ date: "2026-12-25", currentStatus: "BLOQUEADA", isCovered: true }),
    ).toBeNull();
  });

  it("ignores a covered cancelled occurrence", () => {
    expect(
      transition({ date: "2026-12-25", currentStatus: "CANCELADA", isCovered: true }),
    ).toBeNull();
  });

  it("reopens an uncovered blocked occurrence", () => {
    // 2026-12-23 e quarta-feira (weekday 4 na convencao 1=domingo), o mesmo
    // dia da semana atual da turma
    expect(
      transition({
        date: "2026-12-23",
        currentStatus: "BLOQUEADA",
        isCovered: false,
        slotWeekday: 4,
      }),
    ).toBe("AGENDADA");
  });

  it("keeps a past blocked occurrence blocked", () => {
    expect(
      transition({ date: "2026-11-03", currentStatus: "BLOQUEADA", isCovered: false }),
    ).toBeNull();
  });

  it("keeps the occurrence blocked when the weekday no longer matches", () => {
    // 2026-12-23 e quarta-feira, mas a turma foi movida para terca (weekday 3)
    expect(
      transition({
        date: "2026-12-23",
        currentStatus: "BLOQUEADA",
        isCovered: false,
        slotWeekday: 3,
      }),
    ).toBeNull();
  });

  it("matches the holiday date and the inclusive closure range", () => {
    expect(isDateCoveredByBlocks("2026-12-25", [HOLIDAY])).toBe(true);
    expect(isDateCoveredByBlocks("2026-12-26", [HOLIDAY])).toBe(false);

    expect(isDateCoveredByBlocks("2026-12-20", [CLOSURE])).toBe(true);
    expect(isDateCoveredByBlocks("2026-12-25", [CLOSURE])).toBe(true);
    expect(isDateCoveredByBlocks("2026-12-31", [CLOSURE])).toBe(true);
    expect(isDateCoveredByBlocks("2026-12-19", [CLOSURE])).toBe(false);
    expect(isDateCoveredByBlocks("2027-01-01", [CLOSURE])).toBe(false);
  });

  it("treats today as affected and yesterday as not", () => {
    expect(
      transition({ date: TODAY, currentStatus: "AGENDADA", isCovered: true }),
    ).toBe("BLOQUEADA");
    expect(
      transition({ date: "2026-11-09", currentStatus: "AGENDADA", isCovered: true }),
    ).toBeNull();
  });
});

describe("occurrence block coverage", () => {
  const SLOT_ID = "slot-a";
  const OTHER_SLOT_ID = "slot-b";
  const DATE = "2026-11-17";

  it("covers the occurrence when a holiday covers the date", () => {
    expect(
      isOccurrenceCoveredByBlocks("2026-12-25", SLOT_ID, [HOLIDAY]),
    ).toBe(true);
  });

  it("covers the occurrence when a closure covers the date", () => {
    expect(
      isOccurrenceCoveredByBlocks("2026-12-25", SLOT_ID, [CLOSURE]),
    ).toBe(true);
  });

  it("covers the occurrence when its own class slot is blocked on the date", () => {
    expect(
      isOccurrenceCoveredByBlocks(DATE, SLOT_ID, [
        { kind: "classSlot", classSlotId: SLOT_ID, date: DATE },
      ]),
    ).toBe(true);
  });

  it("does not spread a class-slot block to another slot on the same date", () => {
    const blocks = [
      { kind: "classSlot", classSlotId: OTHER_SLOT_ID, date: DATE },
    ] as const;

    expect(isOccurrenceCoveredByBlocks(DATE, SLOT_ID, blocks)).toBe(false);
    expect(isOccurrenceCoveredByBlocks(DATE, OTHER_SLOT_ID, blocks)).toBe(true);
  });

  it("does not cover an occurrence without a block or on another date", () => {
    expect(isOccurrenceCoveredByBlocks(DATE, SLOT_ID, [])).toBe(false);
    expect(
      isOccurrenceCoveredByBlocks(DATE, SLOT_ID, [
        { kind: "classSlot", classSlotId: SLOT_ID, date: "2026-11-24" },
      ]),
    ).toBe(false);
  });
});
