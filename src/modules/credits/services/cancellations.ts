// Aviso de nao comparecimento do aluno fixo (CRD-01 a CRD-08, CRD-10) e
// cancelamento de aula pelo estudio (CRD-28 a CRD-31, CRD-33). O servico
// mexe em bookings/credits direto do schema: nao importa os servicos do
// modulo de reservas.

import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
  credits,
  fixedEnrollments,
} from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import {
  hoursUntilOccurrence,
  isEligibleForCredit,
} from "../domain/credit-rules";
import {
  grantCredit,
  returnCredit,
  type Credit,
} from "./credits";

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

  // O aviso e do aluno fixo da turma: sem vinculo fixo ativo que cubra a
  // ocorrencia nao ha cancelamento de aula fixa a compensar (CRD-45).
  const [fixed] = await db
    .select({ id: fixedEnrollments.id })
    .from(fixedEnrollments)
    .where(
      and(
        eq(fixedEnrollments.classSlotId, session.classSlotId),
        eq(fixedEnrollments.studentId, input.studentId),
        eq(fixedEnrollments.status, "ATIVA"),
        lte(fixedEnrollments.startDate, session.sessionDate),
        or(
          isNull(fixedEnrollments.endDate),
          gt(fixedEnrollments.endDate, session.sessionDate),
        ),
      ),
    );
  if (!fixed) {
    return {
      ok: false,
      error: "aluno nao e horario fixo nesta ocorrencia",
      field: "studentId",
    };
  }

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

export type StudioCancellationInput = {
  classSessionId: string;
  /** Rotulo do responsavel pelo cancelamento (AD-016). */
  adminLabel?: string;
};

export type StudioCancellationResult =
  | {
      ok: true;
      value: {
        session: typeof classSessions.$inferSelect;
        cancelledBookings: number;
        returnedCredits: number;
        grantedCredits: number;
      };
    }
  | { ok: false; error: string; field?: string };

/**
 * Cancela uma ocorrencia pelo estudio (CRD-28): a ocorrencia passa a
 * CANCELADA e as reservas ativas dela sao canceladas. O credito de uma
 * reposicao cancelada volta a DISPONIVEL com o vencimento original
 * (AD-020, CRD-30) e cada aluno fixo afetado recebe 1 credito
 * CANCELAMENTO_ESTUDIO (CRD-29). Repetir o cancelamento nao duplica credito
 * (CRD-31) e quem ja tem credito da ocorrencia nao recebe um segundo
 * (CRD-33). Ocorrencia BLOQUEADA por feriado/recesso e recusada (FER-09,
 * AD-031): o bloqueio ja comunica que a aula nao acontece e o PRD 7.1 veda
 * credito no feriado, entao o cancelamento - que geraria creditos - nao se
 * aplica.
 */
export async function cancelOccurrenceByStudio(
  db: DbClient,
  input: StudioCancellationInput,
  now: Date = new Date(),
): Promise<StudioCancellationResult> {
  const adminLabel = input.adminLabel ?? "admin";

  return db.transaction(async (tx): Promise<StudioCancellationResult> => {
    // Trava a ocorrencia: dois cancelamentos simultaneos nao se cruzam
    const [session] = await tx
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, input.classSessionId))
      .for("update");
    if (!session) {
      return {
        ok: false,
        error: "ocorrencia nao encontrada",
        field: "classSessionId",
      };
    }
    if (session.status === "BLOQUEADA") {
      return {
        ok: false,
        error: "ocorrencia bloqueada por feriado/recesso",
        field: "classSessionId",
      };
    }

    const [slot] = await tx
      .select()
      .from(classSlots)
      .where(eq(classSlots.id, session.classSlotId));
    if (!slot) {
      return { ok: false, error: "turma nao encontrada" };
    }

    await tx
      .update(classSessions)
      .set({ status: "CANCELADA", updatedAt: now })
      .where(eq(classSessions.id, session.id));

    // As reservas ativas da ocorrencia sao canceladas
    const activeBookings = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, session.id),
          eq(bookings.status, "ATIVA"),
        ),
      );

    let cancelledBookings = 0;
    let returnedCredits = 0;
    for (const booking of activeBookings) {
      const [cancelled] = await tx
        .update(bookings)
        .set({
          status: "CANCELADA",
          cancelledAt: now,
          cancelledBy: "ESTUDIO",
          updatedAt: now,
        })
        .where(eq(bookings.id, booking.id))
        .returning();
      if (!cancelled) continue;
      cancelledBookings += 1;

      // O credito da reposicao cancelada volta a DISPONIVEL (AD-020)
      const [credit] = await tx
        .select()
        .from(credits)
        .where(eq(credits.usedBookingId, booking.id));
      if (credit && credit.status === "RESERVADO") {
        const returned = await returnCredit(
          tx,
          {
            creditId: credit.id,
            reason: "Aula cancelada pelo estudio",
            adminLabel,
          },
          now,
        );
        if (returned.ok) returnedCredits += 1;
      }
    }

    // Alunos fixos afetados: os do vinculo fixo e os da reserva fixa da
    // ocorrencia (inclusive quem ja avisou falta)
    const fixedStudents = await tx
      .select({ studentId: fixedEnrollments.studentId })
      .from(fixedEnrollments)
      .where(
        and(
          eq(fixedEnrollments.classSlotId, slot.id),
          eq(fixedEnrollments.status, "ATIVA"),
          lte(fixedEnrollments.startDate, session.sessionDate),
          or(
            isNull(fixedEnrollments.endDate),
            gt(fixedEnrollments.endDate, session.sessionDate),
          ),
        ),
      );

    const fixedBookings = await tx
      .select({ studentId: bookings.studentId })
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, session.id),
          eq(bookings.bookingType, "FIXED"),
        ),
      );

    const affected = new Set<string>();
    for (const row of fixedStudents) affected.add(row.studentId);
    for (const row of fixedBookings) affected.add(row.studentId);

    let grantedCredits = 0;
    for (const studentId of affected) {
      // Quem ja tem credito da ocorrencia nao recebe um segundo (CRD-33)
      const existing = await tx
        .select({ id: credits.id })
        .from(credits)
        .where(
          and(
            eq(credits.studentId, studentId),
            eq(credits.sourceSessionId, session.id),
            ne(credits.status, "CANCELADO"),
          ),
        );
      if (existing.length > 0) continue;

      const granted = await grantCredit(
        tx,
        {
          studentId,
          source: "CANCELAMENTO_ESTUDIO",
          sourceSessionId: session.id,
          reason: "Aula cancelada pelo estudio",
          adminLabel,
          generatedAt: now,
        },
        now,
      );
      if (granted.ok) grantedCredits += 1;
    }

    const [cancelled] = await tx
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, session.id));

    return {
      ok: true,
      value: {
        session: cancelled,
        cancelledBookings,
        returnedCredits,
        grantedCredits,
      },
    };
  });
}
