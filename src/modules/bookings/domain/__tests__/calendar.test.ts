import { describe, expect, it } from "vitest";
import {
  monthBoundsOf,
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
