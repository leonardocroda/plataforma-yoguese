import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { bookings, classSessions, classSlots, fixedEnrollments, students } from "../../../db/schema";
import {
  Composition,
  calculateComposition,
} from "../domain/composition";
import {
  DbClient,
  materializeSession,
  Session,
} from "./sessions";
import { todayInStudio } from "../../classes/domain/occurrences";

export type OccurrenceCompositionInput = {
  classSlotId: string;
  /** Ocorrencia materializada; null quando a data ainda nao tem sessao. */
  sessionId: string | null;
  date: string;
  capacity: number;
};

/**
 * Composicao de uma ocorrencia (RES-08, RES-09): quantos fixos, reposicoes
 * e experimentais ocupam a vaga e quantas vagas sobram. Fonte unica do
 * modulo (RES-27): o agendamento, o painel e a agenda publica leem estes
 * numeros daqui, sem recalcular a conta em outro lugar.
 *
 * Fixos derivam dos enrollments ativos que cobrem a data (AD-008). Um aluno
 * fixo conta uma vez, como fixo: a reserva dele na mesma ocorrencia nao soma
 * uma segunda vaga (a reserva e recusada como duplicada na origem). Aluno
 * fixo com cancelamento ou falta na ocorrencia nao conta nela: a vaga volta
 * (CRD-09).
 */
export async function getOccurrenceComposition(
  db: DbClient,
  input: OccurrenceCompositionInput,
): Promise<Composition> {
  const fixedStudents = await db
    .select({ studentId: fixedEnrollments.studentId })
    .from(fixedEnrollments)
    .innerJoin(students, eq(students.id, fixedEnrollments.studentId))
    .where(
      and(
        eq(fixedEnrollments.classSlotId, input.classSlotId),
        eq(fixedEnrollments.status, "ATIVA"),
        // Aluna INATIVA deixa de ocupar vaga fixa (STUD-06): a contagem e
        // derivada do status, e reativar volta a contar sem reescrever a
        // matricula (STUD-07)
        eq(students.status, "ATIVO"),
        // Cobre a data: startDate <= data < endDate encerrado (RES-23 AC4)
        lte(fixedEnrollments.startDate, input.date),
        or(
          isNull(fixedEnrollments.endDate),
          gt(fixedEnrollments.endDate, input.date),
        ),
      ),
    );

  // Aluno fixo que cancelou ou faltou na ocorrencia nao conta como fixo
  // nela: a vaga volta (CRD-09, AD-022).
  const absent = input.sessionId
    ? await absentStudents(db, input.sessionId)
    : new Set<string>();

  // Cada aluno conta uma vez: o fixo manda no tipo da ocorrencia
  const counted = new Set<string>();
  let fixedCount = 0;
  for (const row of fixedStudents) {
    if (counted.has(row.studentId)) continue;
    if (absent.has(row.studentId)) continue;
    counted.add(row.studentId);
    fixedCount += 1;
  }
  let makeupCount = 0;
  let experimentalCount = 0;

  if (input.sessionId) {
    const activeBookings = await db
      .select({ studentId: bookings.studentId, type: bookings.bookingType })
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, input.sessionId),
          eq(bookings.status, "ATIVA"),
        ),
      );

    for (const booking of activeBookings) {
      if (counted.has(booking.studentId)) continue;
      counted.add(booking.studentId);
      if (booking.type === "FIXED") fixedCount += 1;
      else if (booking.type === "MAKEUP") makeupCount += 1;
      else experimentalCount += 1;
    }
  }

  return calculateComposition({
    capacity: input.capacity,
    fixedCount,
    makeupCount,
    experimentalCount,
  });
}

export type OccurrenceComposition = Composition & {
  classSlotId: string;
  date: string;
  sessionId: string;
  sessionStatus: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
};

/**
 * Alunos com registro de cancelamento ou falta na ocorrencia (CRD-09). O
 * registro e a linha BOOKING do tipo FIXED criada pelo aviso (AD-022).
 */
async function absentStudents(
  db: DbClient,
  sessionId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ studentId: bookings.studentId })
    .from(bookings)
    .where(
      and(
        eq(bookings.classSessionId, sessionId),
        eq(bookings.bookingType, "FIXED"),
        inArray(bookings.status, ["CANCELADA", "FALTA"]),
      ),
    );
  return new Set(rows.map((row) => row.studentId));
}

export type CompositionResult =
  | { ok: true; value: OccurrenceComposition }
  | { ok: false; error: string; field?: string };

/**
 * Leitura da composicao de uma ocorrencia por (slot, data) (RES-27). Data de
 * hoje ou futura materializa a ocorrencia (get-or-create, RES-06); data no
 * passado e somente leitura (RES-10).
 */
export async function getComposition(
  db: DbClient,
  input: { classSlotId: string; date: string },
  now: Date = new Date(),
): Promise<CompositionResult> {
  const today = todayInStudio(now);

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));
  if (!slot) return { ok: false, error: "turma nao encontrada" };

  const isPast = input.date < today;

  let session: Session | undefined;
  if (isPast) {
    // Leitura apenas: nada de materializacao no passado (RES-10 AC5)
    [session] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.classSlotId, input.classSlotId),
          eq(classSessions.sessionDate, input.date),
        ),
      );
    if (!session) {
      return { ok: false, error: "ocorrencia passada nao existe para leitura" };
    }
  } else {
    const materialized = await materializeSession(db, input, now);
    if (!materialized.ok) {
      return {
        ok: false,
        error: materialized.error,
        field: materialized.field,
      };
    }
    session = materialized.value;
  }

  const composition = await getOccurrenceComposition(db, {
    classSlotId: input.classSlotId,
    sessionId: session.id,
    date: session.sessionDate,
    capacity: slot.capacity,
  });

  return {
    ok: true,
    value: {
      ...composition,
      classSlotId: input.classSlotId,
      date: input.date,
      sessionId: session.id,
      sessionStatus: session.status,
    },
  };
}
