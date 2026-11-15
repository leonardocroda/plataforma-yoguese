import { describe, expect, it } from "vitest";
import { weekdayOf } from "../../../classes/domain/occurrences";
import {
  MONTH_WEEKDAY_LABELS,
  monthBoundsOf,
  monthGridDates,
  resolveCalendarWindow,
  weekEndOf,
  weekStartOf,
} from "../calendar";

describe("calendar window", () => {
  it("keeps the selected date in the day view", () => {
    expect(
      resolveCalendarWindow({
        view: "dia",
        date: "2026-11-14",
        today: "2026-11-14",
      }),
    ).toEqual({
      ok: true,
      value: {
        view: "dia",
        date: "2026-11-14",
        from: "2026-11-14",
        to: "2026-11-14",
      },
    });
  });

  it("resolves the Monday-to-Sunday week containing the selected date", () => {
    expect(
      resolveCalendarWindow({
        view: "semana",
        date: "2026-11-15",
        today: "2026-11-14",
      }),
    ).toEqual({
      ok: true,
      value: {
        view: "semana",
        date: "2026-11-15",
        from: "2026-11-09",
        to: "2026-11-15",
      },
    });
  });

  it("resolves the full month containing the selected date", () => {
    expect(
      resolveCalendarWindow({
        view: "mes",
        date: "2026-11-14",
        today: "2026-11-14",
      }),
    ).toEqual({
      ok: true,
      value: {
        view: "mes",
        date: "2026-11-14",
        from: "2026-11-01",
        to: "2026-11-30",
      },
    });
  });

  it("finds the calendar week from Monday through Sunday", () => {
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
    expect(weekEndOf("2026-11-09")).toBe("2026-11-15");
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09");
    expect(weekEndOf("2026-11-15")).toBe("2026-11-15");
  });

  it("lays the month grid under the Monday-to-Sunday headers", () => {
    const { from, to } = monthBoundsOf("2026-11-14");
    const dates = monthGridDates(from, to);

    // 2026-11-01 e domingo: a grade abre na segunda 26/10.
    expect(dates[0]).toBe("2026-10-26");
    expect(weekdayOf(dates[0] as string)).toBe(2); // domingo = 1, segunda = 2
    expect(MONTH_WEEKDAY_LABELS[0]).toBe("Seg");
    expect(dates.length % 7).toBe(0);
    expect(dates.length).toBe(42);
    expect(dates[dates.length - 1]).toBe("2026-12-06");
    // Cada coluna cai sob o rotulo do seu dia da semana: a grade abre na
    // segunda, como o cabecalho.
    const columnOf = (date: string) =>
      weekdayOf(date) === 1 ? 6 : weekdayOf(date) - 2;
    dates.slice(0, 7).forEach((date, column) => {
      expect(columnOf(date)).toBe(column);
    });
    expect(MONTH_WEEKDAY_LABELS[columnOf(dates[0] as string)]).toBe("Seg");
  });

  it("covers the whole month across leap years and year boundaries", () => {
    expect(monthBoundsOf("2024-02-10")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(monthBoundsOf("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("rejects an unknown calendar view", () => {
    expect(
      resolveCalendarWindow({
        view: "trimestre",
        date: "2026-11-14",
        today: "2026-11-14",
      }),
    ).toEqual({ ok: false });
  });

  it("rejects missing or malformed dates", () => {
    expect(
      resolveCalendarWindow({
        view: "semana",
        date: undefined,
        today: "2026-11-14",
      }),
    ).toEqual({ ok: false });
    expect(
      resolveCalendarWindow({
        view: "semana",
        date: "2026-1-01",
        today: "2026-11-14",
      }),
    ).toEqual({ ok: false });
    expect(
      resolveCalendarWindow({
        view: "semana",
        date: "2026-02-30",
        today: "2026-11-14",
      }),
    ).toEqual({ ok: false });
  });
});
