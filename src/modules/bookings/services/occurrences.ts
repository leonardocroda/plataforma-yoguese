import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";

import {
  bookings,
  classSessions,
  credits,
  experimentals,
  fixedEnrollments,
  students,
} from "../../../db/schema";
import { listActiveSlots } from "../../classes/services/classes";
import {
  occurrenceDates,
  todayInStudio,
} from "../../classes/domain/occurrences";
import type { Credit } from "../../credits/services/credits";
import {
  BlockDate,
  isOccurrenceCoveredByBlocks,
} from "../domain/blocks";
import { Composition } from "../domain/composition";
import {
  calculateOccurrenceComposition,
} from "./composition";
import {
  coversDate,
  occurrenceParticipants,
  type FixedParticipant,
  type OccurrenceNotice,
  type OccurrenceParticipant,
} from "./participants";
import {
  DbClient,
  loadBlockDates,
} from "./sessions";

export type OccurrenceBlockSource = "holiday" | "closure" | "classSlot";

export type OccurrenceRow = {
  classSlotId: string;
  date: string;
  sessionId: string;
  sessionStatus: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
  classTypeId: string;
  classTypeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  composition: Composition;
  fixedStudents: FixedParticipant[];
  participants: OccurrenceParticipant[];
  notices: OccurrenceNotice[];
  /** A propria turma esta bloqueada nesta data. */
  classBlocked: boolean;
  /** Qual bloqueio cobre a ocorrencia, quando houver. */
  blockSource: OccurrenceBlockSource | null;
  credits: Credit[];
};

export type OccurrencesResult =
  | { ok: true; value: OccurrenceRow[] }
  | { ok: false; error: string };

type OccurrencePair = {
  classSlotId: string;
  date: string;
};

/**
 * Le as ocorrencias de uma janela em lote. Cada relacao e carregada uma vez
 * e a composicao de cada linha usa a mesma conta do leitor individual (CAL-05).
 * No passado, somente as sessoes ja materializadas aparecem (AD-008). Hoje e no
 * futuro, as faltantes nascem por get-or-create (AD-008).
 */
export async function listOccurrences(
  db: DbClient,
  input: { from: string; to: string; now?: Date },
): Promise<OccurrencesResult> {
  if (input.from > input.to) {
    return { ok: false, error: "janela invalida" };
  }

  const now = input.now ?? new Date();
  const today = todayInStudio(now);
  const slots = await listActiveSlots(db);
  if (slots.length === 0) return { ok: true, value: [] };

  const blocks = await loadBlockDates(db);
  const pairs: OccurrencePair[] = slots.flatMap((slot) =>
    occurrenceDates({ weekday: slot.weekday }, input.from, input.to).map(
      (date) => ({ classSlotId: slot.id, date }),
    ),
  );

  const slotIds = slots.map((slot) => slot.id);
  const existing = await db
    .select()
    .from(classSessions)
    .where(
      and(
        inArray(classSessions.classSlotId, slotIds),
        gte(classSessions.sessionDate, input.from),
        lte(classSessions.sessionDate, input.to),
      ),
    );
  const existingKeys = new Set(
    existing.map((session) => sessionKey(session.classSlotId, session.sessionDate)),
  );

  const futurePairs = pairs.filter((pair) => pair.date >= today);
  const missing = futurePairs.filter(
    (pair) => !existingKeys.has(sessionKey(pair.classSlotId, pair.date)),
  );
  if (missing.length > 0) {
    await db
      .insert(classSessions)
      .values(
        missing.map((pair) => ({
          classSlotId: pair.classSlotId,
          sessionDate: pair.date,
          status: isCovered(pair, blocks)
            ? ("BLOQUEADA" as const)
            : ("AGENDADA" as const),
        })),
      )
      .onConflictDoNothing({
        target: [classSessions.classSlotId, classSessions.sessionDate],
      });
  }

  // Uma sessao AGENDADA coberta por um bloqueio vira BLOQUEADA. O update em
  // lote tambem cobre o vencedor de uma corrida de insercao.
  const coveredPairs = futurePairs.filter((pair) => isCovered(pair, blocks));
  if (coveredPairs.length > 0) {
    await db
      .update(classSessions)
      .set({ status: "BLOQUEADA", updatedAt: now })
      .where(
        and(
          eq(classSessions.status, "AGENDADA"),
          or(
            ...coveredPairs.map((pair) =>
              and(
                eq(classSessions.classSlotId, pair.classSlotId),
                eq(classSessions.sessionDate, pair.date),
              ),
            ),
          ),
        ),
      );
  }

  // Releitura: devolve tambem quem venceu uma insercao concorrente.
  const sessions = await db
    .select()
    .from(classSessions)
    .where(
      and(
        inArray(classSessions.classSlotId, slotIds),
        gte(classSessions.sessionDate, input.from),
        lte(classSessions.sessionDate, input.to),
      ),
    );
  const sessionIds = sessions.map((session) => session.id);

  const [bookingRows, approvedRows, enrollmentRows, creditRows, studentRows] =
    await Promise.all([
      sessionIds.length > 0
        ? db
            .select({
              id: bookings.id,
              studentId: bookings.studentId,
              classSessionId: bookings.classSessionId,
              bookingType: bookings.bookingType,
              status: bookings.status,
              studentStatus: students.status,
            })
            .from(bookings)
            .innerJoin(students, eq(students.id, bookings.studentId))
            .where(inArray(bookings.classSessionId, sessionIds))
        : [],
      sessionIds.length > 0
        ? db
            .select({
              id: experimentals.id,
              name: experimentals.name,
              classSessionId: experimentals.classSessionId,
            })
            .from(experimentals)
            .where(
              and(
                inArray(experimentals.classSessionId, sessionIds),
                eq(experimentals.status, "APROVADA"),
              ),
            )
        : [],
      db
        .select({
          studentId: fixedEnrollments.studentId,
          classSlotId: fixedEnrollments.classSlotId,
          startDate: fixedEnrollments.startDate,
          endDate: fixedEnrollments.endDate,
          studentStatus: students.status,
        })
        .from(fixedEnrollments)
        .innerJoin(students, eq(students.id, fixedEnrollments.studentId))
        .where(
          and(
            inArray(fixedEnrollments.classSlotId, slotIds),
            eq(fixedEnrollments.status, "ATIVA"),
            lte(fixedEnrollments.startDate, input.to),
            or(
              isNull(fixedEnrollments.endDate),
              gt(fixedEnrollments.endDate, input.from),
            ),
          ),
        ),
      sessionIds.length > 0
        ? db
            .select()
            .from(credits)
            .where(inArray(credits.sourceSessionId, sessionIds))
        : [],
      db.select({ id: students.id, name: students.name }).from(students),
    ]);

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const nameById = new Map(
    studentRows.map((student) => [student.id, student.name]),
  );
  const bookingsBySession = groupBy(bookingRows, "classSessionId");
  const approvedBySession = groupBy(approvedRows, "classSessionId");
  const creditsBySession = groupBy(creditRows, "sourceSessionId");

  const rows: OccurrenceRow[] = [];
  for (const session of sessions) {
    const slot = slotById.get(session.classSlotId);
    if (!slot) continue;
    const sessionBookings = bookingsBySession.get(session.id) ?? [];
    const sessionApproved = approvedBySession.get(session.id) ?? [];
    const sessionCredits = creditsBySession.get(session.id) ?? [];
    const occurrenceEnrollments = enrollmentRows.filter(
      (enrollment) =>
        enrollment.classSlotId === slot.id &&
        coversDate(enrollment, session.sessionDate),
    );
    const participants = occurrenceParticipants({
      slotId: slot.id,
      date: session.sessionDate,
      enrollments: occurrenceEnrollments,
      bookings: sessionBookings,
      nameById,
      approvedExperimentals: sessionApproved,
    });
    const absentStudentIds = new Set(
      sessionBookings
        .filter(
          (booking) =>
            booking.bookingType === "FIXED" &&
            (booking.status === "CANCELADA" || booking.status === "FALTA"),
        )
        .map((booking) => booking.studentId),
    );
    const composition = calculateOccurrenceComposition(
      { capacity: slot.capacity },
      {
        fixedStudents: occurrenceEnrollments,
        activeBookings: sessionBookings
          .filter((booking) => booking.status === "ATIVA")
          .map((booking) => ({
            studentId: booking.studentId,
            type: booking.bookingType,
            studentStatus: booking.studentStatus,
          })),
        absentStudentIds,
        approvedExperimentalCount: sessionApproved.length,
      },
    );
    const source = blockSource(session.sessionDate, slot.id, blocks);

    rows.push({
      classSlotId: slot.id,
      date: session.sessionDate,
      sessionId: session.id,
      sessionStatus: session.status,
      classTypeId: slot.classTypeId,
      classTypeName: slot.classTypeName,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      composition,
      fixedStudents: participants.fixed,
      participants: participants.participants,
      notices: participants.notices,
      classBlocked: source === "classSlot",
      blockSource: source,
      credits: sessionCredits,
    });
  }

  rows.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startTime.localeCompare(right.startTime) ||
      left.classTypeName.localeCompare(right.classTypeName),
  );

  return { ok: true, value: rows };
}

function sessionKey(classSlotId: string, date: string): string {
  return `${classSlotId}|${date}`;
}

function isCovered(pair: OccurrencePair, blocks: BlockDate[]): boolean {
  return isOccurrenceCoveredByBlocks(pair.date, pair.classSlotId, blocks);
}

function blockSource(
  date: string,
  classSlotId: string,
  blocks: BlockDate[],
): OccurrenceBlockSource | null {
  if (
    blocks.some(
      (block) =>
        block.kind === "classSlot" &&
        block.classSlotId === classSlotId &&
        block.date === date,
    )
  ) {
    return "classSlot";
  }
  if (blocks.some((block) => block.kind === "holiday" && block.date === date)) {
    return "holiday";
  }
  if (
    blocks.some(
      (block) =>
        block.kind === "closure" &&
        date >= block.startDate &&
        date <= block.endDate,
    )
  ) {
    return "closure";
  }
  return null;
}

function groupBy<T, Key extends keyof T & string>(
  rows: T[],
  key: Key,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string" || !value) continue;
    const list = grouped.get(value) ?? [];
    list.push(row);
    grouped.set(value, list);
  }
  return grouped;
}
