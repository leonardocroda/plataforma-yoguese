import { and, eq, inArray } from "drizzle-orm";
import {
  addDays,
  STUDIO_TIMEZONE,
  todayInStudio,
  weekdayOf,
} from "../../../modules/classes/domain/occurrences";
import {
  getComposition,
} from "../../../modules/bookings/services/composition";
import {
  listActiveSlots,
} from "../../../modules/classes/services/classes";
import { listActiveStudents } from "../../../modules/students/services/students";
import {
  listStudentCredits,
  type StudentCredit,
} from "../../../modules/credits/services/credits";
import { bookings, fixedEnrollments, students } from "../../../db/schema";
import { OccurrenceForms, type CreditOption, type StudentOption } from "./booking-forms";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type EnrollmentRow = typeof fixedEnrollments.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;

type Participant = {
  id: string;
  name: string;
  kind: "fixo" | "reposição" | "experimental";
};

type Notice = {
  id: string;
  studentId: string;
  name: string;
  status: "CANCELADA" | "FALTA";
};

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
}

/** O vinculo fixo cobre a data da ocorrencia (RES-23). */
function coversDate(enrollment: EnrollmentRow, date: string): boolean {
  if (enrollment.startDate > date) return false;
  if (enrollment.endDate && enrollment.endDate <= date) return false;
  return true;
}

/**
 * Participantes da ocorrencia: os fixos do vinculo e as reservas ativas. O
 * aluno que avisou falta ou cancelamento nao conta como participante: o
 * registro dele aparece no resultado da acao (CRD-09, AD-022).
 */
function occurrenceParticipants(
  input: {
    slotId: string;
    sessionId: string;
    date: string;
  },
  enrollments: EnrollmentRow[],
  sessionBookings: BookingRow[],
  nameById: Map<string, string>,
): { participants: Participant[]; fixed: StudentOption[]; notices: Notice[] } {
  const nameOf = (studentId: string): string =>
    nameById.get(studentId) ?? "Aluno";

  const notices = sessionBookings
    .filter(
      (booking) =>
        booking.bookingType === "FIXED" &&
        (booking.status === "CANCELADA" || booking.status === "FALTA"),
    )
    .map((booking) => ({
      id: booking.id,
      studentId: booking.studentId,
      name: nameOf(booking.studentId),
      status: booking.status as "CANCELADA" | "FALTA",
    }));
  const notified = new Set(notices.map((notice) => notice.studentId));

  const participants: Participant[] = [];
  const listed = new Set<string>();
  const fixed: StudentOption[] = [];

  for (const enrollment of enrollments) {
    if (enrollment.classSlotId !== input.slotId) continue;
    if (!coversDate(enrollment, input.date)) continue;
    if (listed.has(enrollment.studentId)) continue;
    listed.add(enrollment.studentId);
    const name = nameOf(enrollment.studentId);
    if (!notified.has(enrollment.studentId)) {
      participants.push({ id: enrollment.studentId, name, kind: "fixo" });
      fixed.push({ id: enrollment.studentId, name });
    }
  }

  for (const booking of sessionBookings) {
    if (booking.status !== "ATIVA") continue;
    if (listed.has(booking.studentId)) continue;
    listed.add(booking.studentId);
    const name = nameOf(booking.studentId);
    if (booking.bookingType === "MAKEUP") {
      participants.push({ id: booking.studentId, name, kind: "reposição" });
    } else if (booking.bookingType === "EXPERIMENTAL") {
      participants.push({ id: booking.studentId, name, kind: "experimental" });
    } else {
      participants.push({ id: booking.studentId, name, kind: "fixo" });
    }
  }

  return { participants, fixed, notices };
}

/**
 * Grade minima do admin (RES-05, RES-08, RES-27): a semana com as turmas
 * ativas e, em cada ocorrencia, as tres perguntas do negocio (quantos
 * fixos, reposicoes e experimentais) e as vagas restantes. As contagens vem
 * da composicao (fonte unica dos numeros); a grade mostra tambem quem
 * participa e o resultado das acoes de credito (CRD-41, CRD-42).
 */
export default async function AdminGradePage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const today = todayInStudio();
  // Janela de 7 dias comecando hoje: a grade sempre mostra as proximas
  // ocorrencias, mesmo quando a semana de calendario ja terminou.
  const weekStart = today;
  const weekEnd = addDays(today, 6);

  const [slots, activeStudents, allStudents] = await Promise.all([
    listActiveSlots(db),
    listActiveStudents(db),
    db.select().from(students),
  ]);

  const nameById = new Map(allStudents.map((student) => [student.id, student.name]));

  // Creditos por aluno: alimentam a reposicao manual da grade e o resultado
  // das acoes de credito da ocorrencia.
  const creditLists = await Promise.all(
    allStudents.map((student) => listStudentCredits(db, student.id)),
  );
  const creditsByStudent = new Map<string, StudentCredit[]>();
  const allCredits: StudentCredit[] = [];
  creditLists.forEach((list, index) => {
    const student = allStudents[index];
    creditsByStudent.set(student.id, list);
    allCredits.push(...list);
  });

  const creditsByStudentOptions: Record<string, CreditOption[]> = {};
  for (const student of allStudents) {
    creditsByStudentOptions[student.id] = (creditsByStudent.get(student.id) ?? [])
      .filter((credit) => credit.status === "DISPONIVEL")
      .map((credit) => ({
        id: credit.id,
        label: `Vence em ${formatDate(credit.expiresAt)}`,
      }));
  }

  const days = [];
  for (let index = 0; index < 7; index++) {
    const date = addDays(weekStart, index);
    const occurrences = [];
    for (const slot of slots) {
      if (slot.weekday !== weekdayOf(date)) continue;
      const composition = await getComposition(db, {
        classSlotId: slot.id,
        date,
      });
      // Ocorrencia passada que nunca foi materializada nao tem composicao
      if (!composition.ok) continue;
      occurrences.push({ slot, composition: composition.value });
    }
    days.push({ date, occurrences });
  }

  const sessionIds = days.flatMap((day) =>
    day.occurrences.map((occurrence) => occurrence.composition.sessionId),
  );
  const sessionBookings = sessionIds.length
    ? await db.select().from(bookings).where(inArray(bookings.classSessionId, sessionIds))
    : [];

  const slotIds = slots.map((slot) => slot.id);
  const enrollments = slotIds.length
    ? await db
        .select()
        .from(fixedEnrollments)
        .where(
          and(
            inArray(fixedEnrollments.classSlotId, slotIds),
            eq(fixedEnrollments.status, "ATIVA"),
          ),
        )
    : [];

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Grade da semana</h1>
        <p className="text-xs">
          {weekStart} a {weekEnd} - fixos, reposições, experimentais e vagas
          por ocorrência
        </p>
      </header>

      {slots.length === 0 ? (
        <p className="text-sm">Nenhuma turma ativa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((day) => (
            <section
              key={day.date}
              className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide">
                {WEEKDAY_LABELS[weekdayOf(day.date) - 1]}
              </h2>
              <p className="text-xs opacity-70">{day.date}</p>

              {day.occurrences.length === 0 ? (
                <p className="mt-3 text-xs opacity-60">Sem aulas</p>
              ) : (
                day.occurrences.map((occurrence) => {
                  const sessionId = occurrence.composition.sessionId;
                  const occurrenceBookings = sessionBookings.filter(
                    (booking) => booking.classSessionId === sessionId,
                  );
                  const { participants, fixed, notices } = occurrenceParticipants(
                    {
                      slotId: occurrence.slot.id,
                      sessionId,
                      date: day.date,
                    },
                    enrollments,
                    occurrenceBookings,
                    nameById,
                  );
                  const occurrenceCredits = allCredits.filter(
                    (credit) => credit.sourceSessionId === sessionId,
                  );
                  const studioCredits = occurrenceCredits.filter(
                    (credit) => credit.source === "CANCELAMENTO_ESTUDIO",
                  );
                  const cancelledByStudio = occurrenceBookings.filter(
                    (booking) =>
                      booking.status === "CANCELADA" &&
                      booking.cancelledBy === "ESTUDIO",
                  ).length;

                  return (
                    <article
                      key={occurrence.slot.id}
                      className="mt-3 rounded-md border border-[var(--yoguese-bege)] bg-[var(--yoguese-off-white)] p-3"
                    >
                      <p className="text-sm font-medium">
                        {occurrence.slot.classTypeName}
                      </p>
                      <p className="text-xs opacity-80">
                        {formatTime(occurrence.slot.startTime)} -{" "}
                        {formatTime(occurrence.slot.endTime)}
                      </p>

                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt>Fixos</dt>
                          <dd>{occurrence.composition.fixedCount}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Reposições</dt>
                          <dd>{occurrence.composition.makeupCount}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Experimentais</dt>
                          <dd>{occurrence.composition.experimentalCount}</dd>
                        </div>
                        <div className="flex justify-between border-t border-[var(--yoguese-bege)] pt-1 font-medium">
                          <dt>Vagas</dt>
                          <dd>{occurrence.composition.availableSpots}</dd>
                        </div>
                      </dl>

                      {occurrence.composition.sessionStatus === "BLOQUEADA" ? (
                        <p className="mt-2 text-xs text-red-700">
                          Bloqueada por feriado ou recesso
                        </p>
                      ) : null}

                      {occurrence.composition.sessionStatus === "CANCELADA" ? (
                        <p className="mt-2 text-xs text-red-700">
                          Cancelada - a grade da turma mudou
                        </p>
                      ) : null}

                      {participants.length > 0 ? (
                        <div className="mt-2 text-xs">
                          <p className="font-medium">Participantes</p>
                          <ul>
                            {participants.map((participant) => (
                              <li key={`${participant.kind}-${participant.id}`}>
                                {participant.name} ({participant.kind})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {notices.length > 0 ||
                      studioCredits.length > 0 ||
                      cancelledByStudio > 0 ? (
                        <div className="mt-2 rounded border border-[var(--yoguese-bege)] bg-white p-2 text-xs">
                          <p className="font-medium">Resultado</p>
                          {notices.map((notice) => {
                            const credit = occurrenceCredits.find(
                              (item) =>
                                item.studentId === notice.studentId &&
                                item.source === "CANCELAMENTO_AULA_FIXA",
                            );
                            return (
                              <p key={notice.id}>
                                {notice.name}:{" "}
                                {notice.status === "FALTA"
                                  ? "falta"
                                  : "cancelamento"}{" "}
                                -{" "}
                                {credit
                                  ? `crédito gerado, vence em ${formatDate(credit.expiresAt)}`
                                  : "sem crédito"}
                              </p>
                            );
                          })}
                          {cancelledByStudio > 0 ? (
                            <p>
                              {cancelledByStudio} reservas canceladas pelo
                              estúdio
                            </p>
                          ) : null}
                          {studioCredits.length > 0 ? (
                            <p>
                              {studioCredits.length} créditos do estúdio gerados
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <OccurrenceForms
                        students={activeStudents.map((student) => ({
                          id: student.id,
                          name: student.name,
                        }))}
                        fixedStudents={fixed}
                        creditsByStudent={creditsByStudentOptions}
                        classSlotId={occurrence.slot.id}
                        classSessionId={sessionId}
                        date={day.date}
                      />
                    </article>
                  );
                })
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
