import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
  fixedEnrollments,
} from "../../../db/schema";
import { todayInStudio, isDatePast } from "../../classes/domain/occurrences";
import { DbClient, materializeSession } from "./sessions";
import { getOccurrenceComposition } from "./composition";

export type { DbClient };

export type BookingType = (typeof bookings.bookingType.enumValues)[number];

export type Booking = typeof bookings.$inferSelect;

export type BookingResult =
  | { ok: true; value: Booking }
  | { ok: false; error: string; field?: string };

export type BookingInput = {
  studentId: string;
  classSlotId: string;
  date: string;
  type: BookingType;
};

/**
 * Cria reserva individual transacional (RES-14 a RES-19). Nesta slice a
 * marcacao e admin-only, sem auth (AD-010): FIXED na ocorrencia especifica,
 * MAKEUP ou EXPERIMENTAL. Mesmo aluno em SEGUNDA turma no mesmo dia e
 * permitido (AD-011); duplicado e so bloqueado na MESMA ocorrencia (RES-17).
 * O mesmo aluno nao pode ser fixo e reserva na mesma ocorrencia: ele contaria
 * duas vezes na mesma vaga.
 * Capacidade e garantida no servidor com SELECT FOR UPDATE na ocorrencia:
 * N reservas concorrentes na ultima vaga geram exatamente 1 confirmada
 * (RES-16). Enrollment ativo conta como fixo ate a data encerrada (RES-23).
 */
export async function createBooking(
  db: DbClient,
  input: BookingInput,
  now: Date = new Date(),
): Promise<BookingResult> {
  if (isDatePast(input.date, todayInStudio(now))) {
    return {
      ok: false,
      error: "reserva em data passada nao e permitida",
      field: "date",
    };
  }

  const materialized = await materializeSession(
    db,
    { classSlotId: input.classSlotId, date: input.date },
    now,
  );
  if (!materialized.ok) {
    return {
      ok: false,
      error: materialized.error,
      field: materialized.field,
    };
  }

  const session = materialized.value;
  if (session.status === "BLOQUEADA") {
    return { ok: false, error: "ocorrencia bloqueada por feriado/recesso" };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));
  if (!slot) return { ok: false, error: "turma nao encontrada" };

  return db.transaction(async (tx): Promise<BookingResult> => {
    // Serializa reservas na mesma ocorrencia: quem chega depois ve a
    // ocupacao confirmada por quem chegou antes (READ COMMITTED re-le o
    // commit mais recente quando o statement roda apos destravar a linha).
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, session.id))
      .for("update");

    const [duplicate] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, session.id),
          eq(bookings.studentId, input.studentId),
          eq(bookings.status, "ATIVA"),
        ),
      );
    if (duplicate) {
      return {
        ok: false,
        error: "aluno ja possui reserva ativa nesta ocorrencia",
        field: "studentId",
      };
    }

    // O aluno fixo desta turma ja ocupa a vaga na ocorrencia: a reserva seria
    // a mesma pessoa duas vezes no mesmo lugar (RES-17).
    const [fixed] = await tx
      .select({ id: fixedEnrollments.id })
      .from(fixedEnrollments)
      .where(
        and(
          eq(fixedEnrollments.classSlotId, input.classSlotId),
          eq(fixedEnrollments.studentId, input.studentId),
          eq(fixedEnrollments.status, "ATIVA"),
          lte(fixedEnrollments.startDate, session.sessionDate),
          or(
            isNull(fixedEnrollments.endDate),
            gt(fixedEnrollments.endDate, session.sessionDate),
          ),
        ),
      );
    if (fixed) {
      return {
        ok: false,
        error: "aluno ja e horario fixo nesta ocorrencia",
        field: "studentId",
      };
    }

    // Composicao pela fonte unica do modulo (RES-27)
    const composition = await getOccurrenceComposition(tx, {
      classSlotId: input.classSlotId,
      sessionId: session.id,
      date: session.sessionDate,
      capacity: slot.capacity,
    });
    if (composition.availableSpots <= 0) {
      return { ok: false, error: "sem vaga disponivel nesta ocorrencia" };
    }

    const [created] = await tx
      .insert(bookings)
      .values({
        studentId: input.studentId,
        classSessionId: session.id,
        bookingType: input.type,
        status: "ATIVA",
      })
      .returning();

    return created
      ? { ok: true, value: created }
      : { ok: false, error: "falha ao gravar reserva" };
  });
}
