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
  listApprovedExperimentalsBySession,
  type ApprovedExperimental,
} from "../../../modules/experimentals/services/experimentals";
import {
  listStudentCredits,
  type StudentCredit,
} from "../../../modules/credits/services/credits";
import { bookings, fixedEnrollments, students } from "../../../db/schema";
import {
  GradeBoard,
  type CreditOption,
  type GradeDay,
  type StudentOption,
} from "./booking-forms";

export const dynamic = "force-dynamic";

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
 * Participantes da ocorrencia: os fixos do vinculo, as reservas ativas e as
 * experimentais aprovadas. O aluno que avisou falta ou cancelamento nao conta
 * como participante: o registro dele aparece no resultado da acao (CRD-09,
 * AD-022).
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
  approvedExperimentals: ApprovedExperimental[],
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

  // As experimentais aprovadas da ocorrencia entram como participantes com
  // o vinculo "experimental" (EXP-43): a pessoa que veio pela aula
  // experimental ocupa a vaga da ocorrencia
  for (const experimental of approvedExperimentals) {
    participants.push({
      id: experimental.id,
      name: experimental.name,
      kind: "experimental",
    });
  }

  return { participants, fixed, notices };
}

/**
 * Grade do admin (RES-05, RES-08, RES-27) na composicao do guia (tela
 * "Admin: calendário e turma"): a semana em grade, cada horario com os 8
 * patinhos da turma, e um painel com a turma escolhida. As contagens vem da
 * composicao (fonte unica dos numeros); a tela nao muda nenhuma regra - so a
 * leitura. A escolha da turma e interativa e vive no cliente.
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

  // As experimentais aprovadas da semana: a grade lista cada uma como
  // participante da ocorrencia (EXP-43)
  const approvedExperimentals = await listApprovedExperimentalsBySession(
    db,
    sessionIds,
  );
  const experimentalsBySession = new Map<string, ApprovedExperimental[]>();
  for (const experimental of approvedExperimentals) {
    const list = experimentalsBySession.get(experimental.classSessionId) ?? [];
    list.push(experimental);
    experimentalsBySession.set(experimental.classSessionId, list);
  }

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

  const allStudentsOptions: StudentOption[] = activeStudents.map((student) => ({
    id: student.id,
    name: student.name,
  }));

  const gradeDays: GradeDay[] = days.map((day) => ({
    date: day.date,
    occurrences: day.occurrences.map((occurrence) => {
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
        experimentalsBySession.get(sessionId) ?? [],
      );
      const occurrenceCredits = allCredits.filter(
        (credit) => credit.sourceSessionId === sessionId,
      );
      const studioCredits = occurrenceCredits.filter(
        (credit) => credit.source === "CANCELAMENTO_ESTUDIO",
      );
      const cancelledByStudio = occurrenceBookings.filter(
        (booking) =>
          booking.status === "CANCELADA" && booking.cancelledBy === "ESTUDIO",
      ).length;

      return {
        key: `${occurrence.slot.id}|${day.date}`,
        classSlotId: occurrence.slot.id,
        classSessionId: sessionId,
        date: day.date,
        startTime: formatTime(occurrence.slot.startTime),
        endTime: formatTime(occurrence.slot.endTime),
        classTypeName: occurrence.slot.classTypeName,
        sessionStatus: occurrence.composition.sessionStatus,
        fixedCount: occurrence.composition.fixedCount,
        makeupCount: occurrence.composition.makeupCount,
        experimentalCount: occurrence.composition.experimentalCount,
        availableSpots: occurrence.composition.availableSpots,
        fixedStudents: fixed,
        participants,
        notices: notices.map((notice) => {
          const credit = occurrenceCredits.find(
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
        studioCancelled: cancelledByStudio,
        studioCredits: studioCredits.length,
      };
    }),
  }));

  return (
    <main>
      <GradeBoard
        days={gradeDays}
        students={allStudentsOptions}
        creditsByStudent={creditsByStudentOptions}
        period={`${formatDate(new Date(`${weekStart}T12:00:00Z`))} a ${formatDate(new Date(`${weekEnd}T12:00:00Z`))}`}
      />
    </main>
  );
}
