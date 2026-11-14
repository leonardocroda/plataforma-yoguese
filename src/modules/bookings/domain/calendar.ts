import { addDays, weekdayOf } from "../../classes/domain/occurrences";

export type CalendarView = "dia" | "semana" | "mes";

export type CalendarWindowInput = {
  view: string | undefined;
  date: string | undefined;
  today: string;
};

export type CalendarWindow =
  | {
      ok: true;
      value: {
        view: CalendarView;
        date: string;
        from: string;
        to: string;
      };
    }
  | { ok: false };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(date: string): boolean {
  const match = DATE_PATTERN.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Segunda-feira da semana de calendario que contem a data. */
export function weekStartOf(date: string): string {
  if (!isValidDate(date)) throw new RangeError(`Data invalida: ${date}`);

  const weekday = weekdayOf(date);
  const daysSinceMonday = weekday === 1 ? 6 : weekday - 2;
  return addDays(date, -daysSinceMonday);
}

/** Domingo da semana de calendario que contem a data. */
export function weekEndOf(date: string): string {
  return addDays(weekStartOf(date), 6);
}

/** Primeiro e ultimo dia do mes que contem a data. */
export function monthBoundsOf(date: string): { from: string; to: string } {
  if (!isValidDate(date)) throw new RangeError(`Data invalida: ${date}`);

  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Data invalida: ${date}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const from = `${match[1]}-${match[2]}-01`;
  const to = addDays(from, daysInMonth(year, month) - 1);

  return { from, to };
}

/** Resolve a janela da visualizacao selecionada, ou recusa entradas invalidas. */
export function resolveCalendarWindow(input: CalendarWindowInput): CalendarWindow {
  if (
    (input.view !== "dia" && input.view !== "semana" && input.view !== "mes") ||
    !input.date ||
    !isValidDate(input.date)
  ) {
    return { ok: false };
  }

  const view = input.view;
  if (view === "dia") {
    return {
      ok: true,
      value: {
        view,
        date: input.date,
        from: input.date,
        to: input.date,
      },
    };
  }

  if (view === "semana") {
    return {
      ok: true,
      value: {
        view,
        date: input.date,
        from: weekStartOf(input.date),
        to: weekEndOf(input.date),
      },
    };
  }

  const { from, to } = monthBoundsOf(input.date);
  return {
    ok: true,
    value: {
      view,
      date: input.date,
      from,
      to,
    },
  };
}
