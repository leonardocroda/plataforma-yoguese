// Reposicao: elegibilidade, agendamento pelo autoatendimento e pelo admin e
// cancelamento com devolucao do credito (CRD-17, CRD-19 a CRD-27).

import { eq } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
  credits,
  students,
} from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import {
  createBooking,
  type Booking,
} from "../../bookings/services/bookings";
import { getComposition } from "../../bookings/services/composition";
import { listActiveSlots } from "../../classes/services/classes";
import { occurrenceDates } from "../../classes/domain/occurrences";
import {
  countWeeklyMakeups,
  weekKey,
} from "../domain/credit-week";
import {
  hoursUntilOccurrence,
  isEligibleForCredit,
} from "../domain/credit-rules";
import type { CreditStatus } from "../domain/credit-status";
import {
  cancelCredit,
  listStudentCredits,
  returnCredit,
  type Credit,
  type StudentCredit,
} from "./credits";

export type { DbClient };

/** Maximo de reposicoes por semana no autoatendimento (PRD 6.4). */
export const WEEKLY_MAKEUP_LIMIT = 2;

export type MakeupInput = {
  studentId: string;
  classSlotId: string;
  date: string;
  /** Credito DISPONIVEL que a reposicao consome (CRD-18). */
  creditId: string;
};

export type MakeupResult =
  | { ok: true; value: Booking }
  | { ok: false; error: string; field?: string };

/**
 * Reposicao pelo autoatendimento do aluno: 1 credito valido e no maximo 2
 * reposicoes ativas na semana da ocorrencia (CRD-17, CRD-19, CRD-20).
 */
export async function bookMakeupByStudent(
  db: DbClient,
  input: MakeupInput,
  now: Date = new Date(),
): Promise<MakeupResult> {
  return db.transaction(async (tx): Promise<MakeupResult> => {
    // Trava o aluno: duas reposicoes simultaneas do mesmo aluno nao se
    // cruzam e o limite da semana continua valendo
    await tx
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, input.studentId))
      .for("update");

    const weekly = await countStudentMakeups(tx, input.studentId, input.date);
    if (weekly >= WEEKLY_MAKEUP_LIMIT) {
      return {
        ok: false,
        error: `limite de ${WEEKLY_MAKEUP_LIMIT} reposicoes por semana atingido`,
        field: "date",
      };
    }

    return createBooking(
      tx,
      {
        studentId: input.studentId,
        classSlotId: input.classSlotId,
        date: input.date,
        type: "MAKEUP",
        creditId: input.creditId,
        adminLabel: "aluno",
      },
      now,
    );
  });
}

/**
 * Reposicao agendada pelo admin: exige 1 credito valido e nao aplica o
 * limite semanal (AD-019, CRD-21).
 */
export async function bookMakeupByAdmin(
  db: DbClient,
  input: MakeupInput,
  now: Date = new Date(),
): Promise<MakeupResult> {
  return createBooking(
    db,
    {
      studentId: input.studentId,
      classSlotId: input.classSlotId,
      date: input.date,
      type: "MAKEUP",
      creditId: input.creditId,
      adminLabel: "admin",
    },
    now,
  );
}

export type CancelMakeupInput = {
  bookingId: string;
};

export type CancelMakeupResult =
  | {
      ok: true;
      value: {
        booking: Booking;
        credit: Credit | null;
        creditStatus: CreditStatus | null;
      };
    }
  | { ok: false; error: string; field?: string };

/**
 * Cancela a reposicao do aluno: com 24h ou mais de antecedencia o credito
 * volta a DISPONIVEL com o vencimento original (CRD-25); com menos de 24h o
 * credito e cancelado definitivamente (CRD-26). Cancelar reposicao nao gera
 * credito novo (CRD-27).
 */
export async function cancelMakeup(
  db: DbClient,
  input: CancelMakeupInput,
  now: Date = new Date(),
): Promise<CancelMakeupResult> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId));
  if (!booking) {
    return { ok: false, error: "reserva nao encontrada", field: "bookingId" };
  }
  if (booking.bookingType !== "MAKEUP") {
    return {
      ok: false,
      error: "reserva nao e reposicao",
      field: "bookingId",
    };
  }
  if (booking.status !== "ATIVA") {
    return {
      ok: false,
      error: "reserva nao esta ativa",
      field: "bookingId",
    };
  }

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, booking.classSessionId));
  const [slot] = session
    ? await db
        .select()
        .from(classSlots)
        .where(eq(classSlots.id, session.classSlotId))
    : [undefined];

  const noticeHours =
    session && slot
      ? hoursUntilOccurrence(session.sessionDate, slot.startTime, now)
      : 0;

  return db.transaction(async (tx): Promise<CancelMakeupResult> => {
    const [cancelled] = await tx
      .update(bookings)
      .set({
        status: "CANCELADA",
        cancelledAt: now,
        cancelledBy: "ALUNO",
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id))
      .returning();
    if (!cancelled) {
      return { ok: false, error: "falha ao cancelar a reserva" };
    }

    const [credit] = await tx
      .select()
      .from(credits)
      .where(eq(credits.usedBookingId, booking.id));
    if (!credit) {
      return {
        ok: true,
        value: { booking: cancelled, credit: null, creditStatus: null },
      };
    }

    if (isEligibleForCredit(noticeHours)) {
      const returned = await returnCredit(
        tx,
        {
          creditId: credit.id,
          reason: "Reposicao cancelada com 24h ou mais de antecedencia",
          adminLabel: "aluno",
        },
        now,
      );
      if (!returned.ok) return returned;
      return {
        ok: true,
        value: {
          booking: cancelled,
          credit: returned.value.credit,
          creditStatus: returned.value.credit.status,
        },
      };
    }

    const cancelledCredit = await cancelCredit(
      tx,
      {
        creditId: credit.id,
        reason: "Reposicao cancelada com menos de 24h de antecedencia",
        adminLabel: "aluno",
      },
      now,
    );
    if (!cancelledCredit.ok) return cancelledCredit;
    return {
      ok: true,
      value: {
        booking: cancelled,
        credit: cancelledCredit.value.credit,
        creditStatus: cancelledCredit.value.credit.status,
      },
    };
  });
}

export type MakeupEligibility = {
  studentId: string;
  date: string;
  /** Semana (segunda a domingo) da ocorrencia da reposicao (AD-024). */
  week: string;
  weeklyMakeups: number;
  weeklyLimit: number;
  /** Creditos DISPONIVEL e validos do aluno. */
  credits: StudentCredit[];
  hasValidCredit: boolean;
  canBook: boolean;
  reason: string | null;
};

/**
 * Elegibilidade do aluno para agendar reposicao: credito valido disponivel
 * e semana da ocorrencia ainda comportando reposicao (CRD-24).
 */
export async function getMakeupEligibility(
  db: DbClient,
  input: { studentId: string; date: string },
  now: Date = new Date(),
): Promise<MakeupEligibility> {
  const studentCredits = await listStudentCredits(db, input.studentId, now);
  const available = studentCredits.filter(
    (credit) => credit.status === "DISPONIVEL",
  );
  const weekly = await countStudentMakeups(db, input.studentId, input.date);
  const hasValidCredit = available.length > 0;
  const canBook = hasValidCredit && weekly < WEEKLY_MAKEUP_LIMIT;

  return {
    studentId: input.studentId,
    date: input.date,
    week: weekKey(input.date),
    weeklyMakeups: weekly,
    weeklyLimit: WEEKLY_MAKEUP_LIMIT,
    credits: available,
    hasValidCredit,
    canBook,
    reason: canBook
      ? null
      : hasValidCredit
        ? `limite de ${WEEKLY_MAKEUP_LIMIT} reposicoes por semana atingido`
        : "aluno nao tem credito disponivel",
  };
}

export type MakeupTarget = {
  classSlotId: string;
  classTypeId: string;
  classTypeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  availableSpots: number;
};

/**
 * Turmas-alvo da reposicao: so as turmas com vaga na data (CRD-24). A
 * reposicao vale em qualquer modalidade de turma (CRD-23).
 */
export async function listMakeupTargets(
  db: DbClient,
  input: { date: string },
  now: Date = new Date(),
): Promise<MakeupTarget[]> {
  const slots = await listActiveSlots(db);
  const targets: MakeupTarget[] = [];

  for (const slot of slots) {
    // A turma so tem ocorrencia no dia da semana dela
    if (occurrenceDates(slot, input.date, input.date).length === 0) continue;

    const composition = await getComposition(
      db,
      { classSlotId: slot.id, date: input.date },
      now,
    );
    if (!composition.ok) continue;
    if (composition.value.sessionStatus !== "AGENDADA") continue;
    if (composition.value.availableSpots <= 0) continue;

    targets.push({
      classSlotId: slot.id,
      classTypeId: slot.classTypeId,
      classTypeName: slot.classTypeName,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      availableSpots: composition.value.availableSpots,
    });
  }

  return targets;
}

/**
 * Quantas reposicoes ativas do aluno caem na semana da ocorrencia (CRD-20).
 */
async function countStudentMakeups(
  db: DbClient,
  studentId: string,
  occurrenceDate: string,
): Promise<number> {
  const rows = await db
    .select({
      bookingType: bookings.bookingType,
      status: bookings.status,
      sessionDate: classSessions.sessionDate,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(classSessions.id, bookings.classSessionId))
    .where(eq(bookings.studentId, studentId));

  return countWeeklyMakeups(rows, occurrenceDate);
}
