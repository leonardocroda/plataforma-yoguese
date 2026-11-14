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
import { occurrenceParticipants } from "../../../modules/bookings/services/participants";
import {
  GradeBoard,
  type CreditOption,
  type GradeDay,
  type StudentOption,
} from "./booking-forms";

export const dynamic = "force-dynamic";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
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
      const { participants, fixed, notices } = occurrenceParticipants({
        slotId: occurrence.slot.id,
        date: day.date,
        enrollments,
        bookings: occurrenceBookings,
        nameById,
        approvedExperimentals: experimentalsBySession.get(sessionId) ?? [],
      });
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
