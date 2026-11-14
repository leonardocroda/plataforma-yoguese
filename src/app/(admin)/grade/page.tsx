import {
  addDays,
  STUDIO_TIMEZONE,
  todayInStudio,
} from "../../../modules/classes/domain/occurrences";
import { resolveCalendarWindow } from "../../../modules/bookings/domain/calendar";
import { listOccurrences } from "../../../modules/bookings/services/occurrences";
import { listActiveStudents } from "../../../modules/students/services/students";
import { listStudentCredits } from "../../../modules/credits/services/credits";
import { students } from "../../../db/schema";
import {
  GradeBoard,
  type CreditOption,
  type GradeDay,
  type StudentOption,
} from "./booking-forms";
import { CalendarNav } from "./calendar-nav";
import { DayView, MonthView } from "./calendar-views";

export const dynamic = "force-dynamic";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
}

/**
 * Calendario do admin (CAL-01..04): a URL escolhe a vista e a data, o leitor
 * em lote devolve as ocorrencias da janela e a selecao tambem vive na URL.
 */
export default async function AdminGradePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    data?: string;
    ocorrencia?: string;
  }>;
}) {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const params = await searchParams;
  const today = todayInStudio();
  const requested = resolveCalendarWindow({
    view: params.view,
    date: params.data,
    today,
  });
  const fallback = resolveCalendarWindow({
    view: "semana",
    date: today,
    today,
  });
  if (!fallback.ok) throw new Error("janela semanal invalida");
  const calendar = requested.ok ? requested.value : fallback.value;

  const listed = await listOccurrences(db, {
    from: calendar.from,
    to: calendar.to,
  });
  const occurrences = listed.ok ? listed.value : [];

  const [activeStudents, allStudents] = await Promise.all([
    listActiveStudents(db),
    db.select().from(students),
  ]);

  // Creditos por aluno: alimentam a reposicao manual da grade e o resultado
  // das acoes de credito da ocorrencia.
  const creditLists = await Promise.all(
    allStudents.map((student) => listStudentCredits(db, student.id)),
  );
  const creditsByStudentOptions: Record<string, CreditOption[]> = {};
  for (const [index, student] of allStudents.entries()) {
    creditsByStudentOptions[student.id] = (creditLists[index] ?? [])
      .filter((credit) => credit.status === "DISPONIVEL")
      .map((credit) => ({
        id: credit.id,
        label: `Vence em ${formatDate(credit.expiresAt)}`,
      }));
  }

  const occurrencesByDate = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) {
    const list = occurrencesByDate.get(occurrence.date) ?? [];
    list.push(occurrence);
    occurrencesByDate.set(occurrence.date, list);
  }

  const days: GradeDay[] = [];
  let currentDate = calendar.from;
  while (currentDate <= calendar.to) {
    days.push({
      date: currentDate,
      occurrences: (occurrencesByDate.get(currentDate) ?? []).map(
        (occurrence) => ({
          key: `${occurrence.classSlotId}|${occurrence.date}`,
          classSlotId: occurrence.classSlotId,
          classSessionId: occurrence.sessionId,
          date: occurrence.date,
          startTime: formatTime(occurrence.startTime),
          endTime: formatTime(occurrence.endTime),
          classTypeName: occurrence.classTypeName,
          capacity: occurrence.capacity,
          sessionStatus: occurrence.sessionStatus,
          classBlocked: occurrence.classBlocked,
          fixedCount: occurrence.composition.fixedCount,
          makeupCount: occurrence.composition.makeupCount,
          experimentalCount: occurrence.composition.experimentalCount,
          availableSpots: occurrence.composition.availableSpots,
          fixedStudents: occurrence.fixedStudents,
          participants: occurrence.participants,
          notices: occurrence.notices.map((notice) => {
            const credit = occurrence.credits.find(
              (item) =>
                item.studentId === notice.studentId &&
                item.source === "CANCELAMENTO_AULA_FIXA",
            );
            return {
              id: notice.id,
              name: notice.name,
              status: notice.status,
              creditExpiresAt: credit ? formatDate(credit.expiresAt) : null,
            };
          }),
          studioCancelled: occurrence.studioCancelled,
          studioCredits: occurrence.studioCredits,
        }),
      ),
    });
    currentDate = addDays(currentDate, 1);
  }

  const allStudentsOptions: StudentOption[] = activeStudents.map((student) => ({
    id: student.id,
    name: student.name,
  }));
  const period = `${formatDate(new Date(`${calendar.from}T12:00:00Z`))} a ${formatDate(new Date(`${calendar.to}T12:00:00Z`))}`;

  return (
    <main>
      <CalendarNav
        view={calendar.view}
        date={calendar.date}
        today={today}
        selection={params.ocorrencia}
      />
      {calendar.view === "semana" ? (
        <GradeBoard
          days={days}
          students={allStudentsOptions}
          creditsByStudent={creditsByStudentOptions}
          period={period}
          selectedKey={params.ocorrencia}
          view={calendar.view}
          date={calendar.date}
          today={today}
        />
      ) : calendar.view === "dia" ? (
        <DayView
          days={days}
          selectedKey={params.ocorrencia}
          date={calendar.date}
          period={period}
          students={allStudentsOptions}
          creditsByStudent={creditsByStudentOptions}
          today={today}
        />
      ) : (
        <MonthView
          days={days}
          selectedKey={params.ocorrencia}
          date={calendar.date}
          period={period}
          students={allStudentsOptions}
          creditsByStudent={creditsByStudentOptions}
          today={today}
        />
      )}
    </main>
  );
}
