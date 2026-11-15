import Link from "next/link";

import {
  MONTH_WEEKDAY_LABELS,
  monthGridDates,
} from "../../../modules/bookings/domain/calendar";
import { VacancyDucks } from "../../../modules/ui/components/vacancy-ducks";
import {
  TurmaPanel,
  type CreditOption,
  type GradeOccurrence,
  type StudentOption,
} from "./booking-forms";

/**
 * Vista diaria: uma coluna com as ocorrencias da data escolhida. Mantem a
 * composicao da grade semanal, com horario, turma, estado e patinhos.
 */
export function DayView({
  days,
  selectedKey,
  date,
  period,
  students,
  creditsByStudent,
  today,
}: {
  days: Array<{ date: string; occurrences: GradeOccurrence[] }>;
  selectedKey?: string;
  date: string;
  period: string;
  students: StudentOption[];
  creditsByStudent: Record<string, CreditOption[]>;
  today: string;
}) {
  const occurrences = days.flatMap((day) => day.occurrences);
  const selectedOccurrence =
    occurrences.find((occurrence) => occurrence.key === selectedKey) ??
    occurrences[0];

  return (
    <>
      <section className="rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-6 xl:p-7">
      <h1 className="text-[34px]">Dia</h1>
      <p className="mt-1.5 text-[15px] text-[color:var(--cinza)]">
        {period}. Cada horário mostra a composição da turma.
      </p>

      {occurrences.length === 0 ? (
        <p className="mt-6 text-[15px] text-[color:var(--cinza)]">
          Nenhuma ocorrência nesta data.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {occurrences.map((occurrence) => (
            <Link
              key={occurrence.key}
              href={occurrenceUrl("dia", date, occurrence.key)}
              aria-current={
                occurrence.key === selectedKey ? "true" : undefined
              }
              className={
                occurrence.key === selectedKey
                  ? "grid min-w-0 gap-3 rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pessego)] p-4 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center"
                  : "grid min-w-0 gap-3 rounded-[var(--r-md)] border-2 border-[var(--linha)] bg-[var(--pena)] p-4 hover:border-[var(--preto)] sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center"
              }
            >
              <time className="text-[18px] font-extrabold">
                {hourLabel(occurrence.startTime)}
              </time>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold">
                  {occurrence.classTypeName}
                </span>
                <span className="mt-1 block text-[13.5px] text-[color:var(--cinza)]">
                  {occurrence.fixedCount} fixos · {occurrence.makeupCount}{" "}
                  reposições · {occurrence.experimentalCount} experimentais
                </span>
              </span>
              <span className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                <StatusLabel status={occurrence.sessionStatus} />
                <VacancyDucks
                  fixed={occurrence.fixedCount}
                  makeup={occurrence.makeupCount}
                  experimental={occurrence.experimentalCount}
                  capacity={occurrence.capacity}
                  size="sm"
                />
              </span>
            </Link>
          ))}
        </div>
      )}
      </section>
      {selectedOccurrence ? (
        <aside
          aria-live="polite"
          className="mt-4 rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--papel-2)] p-6 xl:p-7"
        >
          <TurmaPanel
            occurrence={selectedOccurrence}
            students={students}
            creditsByStudent={creditsByStudent}
            readOnly={selectedOccurrence.date < today}
          />
        </aside>
      ) : null}
    </>
  );
}

/**
 * Vista mensal: cada dia da semana e uma celula. As ocorrencias do mes ficam
 * compactas com horario, turma, selo e patinhos. Dias externos ao mes desenham
 * apenas a moldura do calendario.
 */
export function MonthView({
  days,
  selectedKey,
  date,
  period,
  students,
  creditsByStudent,
  today,
}: {
  days: Array<{ date: string; occurrences: GradeOccurrence[] }>;
  selectedKey?: string;
  date: string;
  period: string;
  students: StudentOption[];
  creditsByStudent: Record<string, CreditOption[]>;
  today: string;
}) {
  const firstDate = days[0]?.date;
  const lastDate = days[days.length - 1]?.date;
  if (!firstDate || !lastDate) return null;

  const allOccurrences = days.flatMap((day) => day.occurrences);
  const selectedOccurrence =
    allOccurrences.find((occurrence) => occurrence.key === selectedKey) ??
    allOccurrences[0];
  const gridDates = monthGridDates(firstDate, lastDate);

  const month = firstDate.slice(0, 7);
  const occurrencesByDate = new Map(
    days.map((day) => [day.date, day.occurrences]),
  );

  return (
    <>
      <section className="overflow-hidden rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)]">
      <div className="border-b-2 border-[var(--preto)] p-6 xl:p-7">
        <h1 className="text-[34px]">Mês</h1>
        <p className="mt-1.5 text-[15px] text-[color:var(--cinza)]">
          {period}. Clique em uma ocorrência para abrir a turma.
        </p>
      </div>

      <div className="grid grid-cols-7 overflow-hidden">
        {MONTH_WEEKDAY_LABELS.map((weekday) => (
          <div
            key={weekday}
            className="border-b-2 border-r-2 border-[var(--preto)] bg-[var(--papel-2)] px-2 py-2 text-center text-[12px] font-bold last:border-r-0"
          >
            {weekday}
          </div>
        ))}

        {gridDates.map((gridDate) => {
          const inMonth = gridDate.slice(0, 7) === month;
          const occurrences = occurrencesByDate.get(gridDate) ?? [];
          return (
            <div
              key={gridDate}
              className={
                inMonth
                  ? "min-h-[118px] min-w-0 border-b-2 border-r-2 border-[var(--linha)] bg-[var(--pena)] p-2"
                  : "min-h-[118px] min-w-0 border-b-2 border-r-2 border-[var(--linha)] bg-[var(--papel-2)] p-2 text-[color:var(--cinza)]"
              }
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[12px] font-bold">
                  {Number(gridDate.slice(8, 10))}
                </span>
              </div>

              {inMonth ? (
                <div className="space-y-1">
                  {occurrences.map((occurrence) => (
                    <Link
                      key={occurrence.key}
                      href={occurrenceUrl("mes", date, occurrence.key)}
                      aria-current={
                        occurrence.key === selectedKey ? "true" : undefined
                      }
                      className={
                        occurrence.key === selectedKey
                          ? "block min-w-0 rounded-[var(--r-sm)] border-2 border-[var(--preto)] bg-[var(--pessego)] p-1.5"
                          : "block min-w-0 rounded-[var(--r-sm)] border-2 border-[var(--linha)] bg-[var(--pena)] p-1.5 hover:border-[var(--preto)]"
                      }
                    >
                      <span className="flex min-w-0 items-center justify-between gap-1">
                        <time className="text-[11px] font-extrabold">
                          {hourLabel(occurrence.startTime)}
                        </time>
                        <StatusLabel
                          status={occurrence.sessionStatus}
                          compact
                        />
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] font-bold">
                        {occurrence.classTypeName}
                      </span>
                      <VacancyDucks
                        fixed={occurrence.fixedCount}
                        makeup={occurrence.makeupCount}
                        experimental={occurrence.experimentalCount}
                        capacity={occurrence.capacity}
                        size="sm"
                      />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </section>
      {selectedOccurrence ? (
        <aside
          aria-live="polite"
          className="mt-4 rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--papel-2)] p-6 xl:p-7"
        >
          <TurmaPanel
            occurrence={selectedOccurrence}
            students={students}
            creditsByStudent={creditsByStudent}
            readOnly={selectedOccurrence.date < today}
          />
        </aside>
      ) : null}
    </>
  );
}

function StatusLabel({
  status,
  compact = false,
}: {
  status: GradeOccurrence["sessionStatus"];
  compact?: boolean;
}) {
  if (status === "AGENDADA") return null;
  return (
    <span
      className={
        compact
          ? "text-[9.5px] font-extrabold uppercase text-[color:var(--erro)]"
          : "text-[12px] font-extrabold uppercase text-[color:var(--erro)]"
      }
    >
      {status === "BLOQUEADA" ? "Bloqueada" : "Cancelada"}
    </span>
  );
}

function occurrenceUrl(
  view: "dia" | "mes",
  date: string,
  occurrenceKey: string,
): string {
  const params = new URLSearchParams({
    view,
    data: date,
    ocorrencia: occurrenceKey,
  });
  return `/grade?${params.toString()}`;
}

function hourLabel(time: string): string {
  const [hour, minute] = time.split(":");
  return minute && minute !== "00" ? `${hour}h${minute}` : `${hour}h`;
}
