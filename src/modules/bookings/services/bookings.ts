import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { bookings, classSessions, classSlots } from "../../../db/schema";
import { todayInStudio, isDatePast } from "../../classes/domain/occurrences";
import {
  DbClient,
  materializeSession,
  Session,
} from "./sessions";

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

    const occupancy = await occurrenceOccupancy(tx, session);
    if (occupancy >= slot.capacity) {
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

/**
 * Ocupacao de uma ocorrencia: bookings ativos (qualquer tipo) + enrollments
 * ativos cobrindo a data (fixos derivados, AD-008).
 */
export async function occurrenceOccupancy(
  db: DbClient,
  session: Pick<Session, "id" | "classSlotId" | "sessionDate">,
): Promise<number> {
  const [activeBookings] = await db
    .select({ total: count() })
    .from(bookings)
    .where(
      and(eq(bookings.classSessionId, session.id), eq(bookings.status, "ATIVA")),
    );

  const [fixed] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, session.classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        // Cobre a data: startDate <= data < endDate encerrado (RES-23 AC4)
        lte(schema.fixedEnrollments.startDate, session.sessionDate),
        or(
          isNull(schema.fixedEnrollments.endDate),
          gt(schema.fixedEnrollments.endDate, session.sessionDate),
        ),
      ),
    );

  return Number(activeBookings?.total ?? 0) + Number(fixed?.total ?? 0);
}
