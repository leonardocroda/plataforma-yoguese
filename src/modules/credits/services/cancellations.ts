// Aviso de nao comparecimento do aluno fixo (CRD-01 a CRD-08, CRD-10) e
// cancelamento de aula pelo estudio (CRD-28 a CRD-31, CRD-33). O servico
// mexe em bookings/credits direto do schema: nao importa os servicos do
// modulo de reservas.

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
} from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import {
  hoursUntilOccurrence,
  isEligibleForCredit,
} from "../domain/credit-rules";
import { grantCredit, type Credit } from "./credits";

export type { DbClient };

export type Booking = typeof bookings.$inferSelect;

export type NonAttendanceInput = {
  studentId: string;
  classSessionId: string;
  /** Rotulo do responsavel pelo registro (AD-023). */
  adminLabel?: string;
};

export type NonAttendanceResult =
  | {
      ok: true;
      value: {
        booking: Booking;
        /** Antecedencia do aviso, em horas (CRD-10). */
        noticeHours: number;
        status: "CANCELADA" | "FALTA";
        credit: Credit | null;
      };
    }
  | { ok: false; error: string; field?: string };

/**
 * Registra, em nome do aluno, o aviso de nao comparecimento numa ocorrencia
 * (AD-023). O aviso vira uma linha BOOKING do tipo FIXED na ocorrencia, com
 * status CANCELADA quando ha 24h ou mais de antecedencia e FALTA quando nao
 * ha (CRD-02, CRD-03, AD-022). Com 24h ou mais o aluno ganha 1 credito
 * CANCELAMENTO_AULA_FIXA (CRD-04); com menos, nao ganha nada (CRD-06).
 * O vinculo fixo do aluno nao muda: o cancelamento e pontual (CRD-08).
 */
export async function registerNonAttendance(
  db: DbClient,
  input: NonAttendanceInput,
  now: Date = new Date(),
): Promise<NonAttendanceResult> {
  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, input.classSessionId));
  if (!session) {
    return {
      ok: false,
      error: "ocorrencia nao encontrada",
      field: "classSessionId",
    };
  }
  if (session.status === "CANCELADA") {
    return {
      ok: false,
      error: "ocorrencia cancelada",
      field: "classSessionId",
    };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, session.classSlotId));
  if (!slot) {
    return { ok: false, error: "turma nao encontrada", field: "classSessionId" };
  }

  const noticeHours = hoursUntilOccurrence(
    session.sessionDate,
    slot.startTime,
    now,
  );
  if (noticeHours < 0) {
    return {
      ok: false,
      error: "ocorrencia no passado nao aceita aviso",
      field: "classSessionId",
    };
  }

  const eligible = isEligibleForCredit(noticeHours);
  const status: "CANCELADA" | "FALTA" = eligible ? "CANCELADA" : "FALTA";

  return db.transaction(async (tx): Promise<NonAttendanceResult> => {
    // O indice unico do fixo permite um registro por aluno e ocorrencia: o
    // aviso ocupa a linha do aluno naquela ocorrencia
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, session.id),
          eq(bookings.studentId, input.studentId),
          eq(bookings.bookingType, "FIXED"),
        ),
      )
      .for("update");

    if (existing && existing.status !== "ATIVA") {
      return {
        ok: false,
        error: "ja existe registro de cancelamento ou falta nesta ocorrencia",
        field: "classSessionId",
      };
    }

    let booking: Booking | undefined;
    if (existing) {
      [booking] = await tx
        .update(bookings)
        .set({
          status,
          // O aviso e o momento em que a reserva do aluno deixa de valer
          cancelledAt: now,
          cancelledBy: "ALUNO",
          updatedAt: now,
        })
        .where(eq(bookings.id, existing.id))
        .returning();
    } else {
      [booking] = await tx
        .insert(bookings)
        .values({
          studentId: input.studentId,
          classSessionId: session.id,
          bookingType: "FIXED",
          status,
          cancelledAt: now,
          cancelledBy: "ALUNO",
          createdAt: now,
        })
        .returning();
    }
    if (!booking) {
      return { ok: false, error: "falha ao gravar o aviso" };
    }

    if (!eligible) {
      return { ok: true, value: { booking, noticeHours, status, credit: null } };
    }

    const granted = await grantCredit(
      tx,
      {
        studentId: input.studentId,
        source: "CANCELAMENTO_AULA_FIXA",
        sourceBookingId: booking.id,
        sourceSessionId: session.id,
        reason: `Cancelamento da aula fixa com ${Math.floor(noticeHours)}h de antecedencia`,
        adminLabel: input.adminLabel ?? "admin",
        generatedAt: now,
      },
      now,
    );
    if (!granted.ok) return granted;

    return {
      ok: true,
      value: {
        booking,
        noticeHours,
        status,
        credit: granted.value.credit,
      },
    };
  });
}

export type AttendanceHistoryEntry = {
  bookingId: string;
  classSessionId: string;
  sessionDate: string;
  startTime: string;
  status: "CANCELADA" | "FALTA";
  /** Antecedencia do aviso, em horas (CRD-10). */
  noticeHours: number;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  /** Data e hora do aviso. */
  createdAt: Date;
};

/**
 * Historico do aluno: os cancelamentos e faltas registrados, com data, hora,
 * ocorrencia, antecedencia e responsavel (CRD-10).
 */
export async function listStudentAttendanceHistory(
  db: DbClient,
  studentId: string,
): Promise<AttendanceHistoryEntry[]> {
  const rows = await db
    .select({
      booking: bookings,
      sessionDate: classSessions.sessionDate,
      startTime: classSlots.startTime,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(classSessions.id, bookings.classSessionId))
    .innerJoin(classSlots, eq(classSlots.id, classSessions.classSlotId))
    .where(
      and(
        eq(bookings.studentId, studentId),
        eq(bookings.bookingType, "FIXED"),
        inArray(bookings.status, ["CANCELADA", "FALTA"]),
      ),
    )
    .orderBy(asc(bookings.createdAt));

  return rows.map((row) => ({
    bookingId: row.booking.id,
    classSessionId: row.booking.classSessionId,
    sessionDate: row.sessionDate,
    startTime: row.startTime,
    status: row.booking.status as "CANCELADA" | "FALTA",
    noticeHours: hoursUntilOccurrence(
      row.sessionDate,
      row.startTime,
      // O aviso e o instante em que a reserva deixou de valer
      row.booking.cancelledAt ?? row.booking.createdAt,
    ),
    cancelledAt: row.booking.cancelledAt,
    cancelledBy: row.booking.cancelledBy,
    createdAt: row.booking.createdAt,
  }));
}
