import Link from "next/link";

import { addDays } from "../../../modules/classes/domain/occurrences";
import type { CalendarView } from "../../../modules/bookings/domain/calendar";

const TABS: Array<{ view: CalendarView; label: string }> = [
  { view: "dia", label: "Diária" },
  { view: "semana", label: "Semanal" },
  { view: "mes", label: "Mensal" },
];

/**
 * Navegacao do calendario por URL: abas, uma janela para tras e outra para
 * frente, seletor de data e volta para hoje. O componente e renderizado no
 * servidor; links e form GET fazem toda a navegacao sem JavaScript proprio.
 */
export function CalendarNav({
  view,
  date,
  today,
  selection,
}: {
  view: CalendarView;
  date: string;
  today: string;
  selection?: string;
}) {
  const previousDate = shiftDate(date, view, -1);
  const nextDate = shiftDate(date, view, 1);

  return (
    <nav
      aria-label="Navegação do calendário"
      className="mb-6 flex flex-wrap items-end justify-between gap-4"
    >
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={calendarUrl(tab.view, date, selection)}
            role="tab"
            aria-current={view === tab.view ? "page" : undefined}
            className={
              view === tab.view
                ? "btn btn-pes peq"
                : "btn btn-sec peq"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Link
          href={calendarUrl(view, previousDate, selection)}
          className="btn btn-sec peq"
          aria-label="Período anterior"
        >
          ← Anterior
        </Link>
        <Link
          href={calendarUrl(view, nextDate, selection)}
          className="btn btn-sec peq"
          aria-label="Próximo período"
        >
          Próxima →
        </Link>

        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="view" value={view} />
          {selection ? (
            <input type="hidden" name="ocorrencia" value={selection} />
          ) : null}
          <label className="grid gap-1 text-[13.5px] font-semibold">
            <span>Data</span>
            <input
              type="date"
              name="data"
              defaultValue={date}
              className="rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pena)] px-3 py-2"
            />
          </label>
          <button type="submit" className="btn btn-sec peq">
            Ir
          </button>
        </form>

        <Link
          href={calendarUrl(view, today, selection)}
          className="btn btn-sec peq"
        >
          Hoje
        </Link>
      </div>
    </nav>
  );
}

function calendarUrl(
  view: CalendarView,
  date: string,
  selection?: string,
): string {
  const params = new URLSearchParams({ view, data: date });
  if (selection) params.set("ocorrencia", selection);
  return `/grade?${params.toString()}`;
}

function shiftDate(date: string, view: CalendarView, amount: number): string {
  if (view === "dia") return addDays(date, amount);
  if (view === "semana") return addDays(date, amount * 7);
  return shiftMonth(date, amount);
}

function shiftMonth(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}
