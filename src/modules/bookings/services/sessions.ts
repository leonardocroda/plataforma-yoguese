import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema";
import {
  bookings,
  classSessions,
  classSlots,
  classTypes,
} from "../../../db/schema";
import {
  holidays,
  studioClosures,
} from "../../../db/schema";
import {
  todayInStudio,
  isDatePast,
  weekdayOf,
} from "../../classes/domain/occurrences";

export type DbClient = NodePgDatabase<typeof schema>;

export type Session = typeof classSessions.$inferSelect;

export type SessionResult =
  | { ok: true; value: Session }
  | { ok: false; error: string; field?: string };

/**
 * Get-or-create da ocorrencia de (slot, data) - RES-06. Idempotente, sem job
 * e sem horizonte fixo (AD-008). Marca BLOQUEADA em feriado/recesso (RES-07)
 * e recusa materializar data passada para agendamento (RES-10).
 *
 * Turma ou modalidade inativa nao materializa nem aceita reserva: a recusa
 * vale tambem para a ocorrencia que ja existia (RES-04, AD-014). A
 * ocorrencia de uma turma so existe no dia da semana dela.
 */
export async function materializeSession(
  db: DbClient,
  input: { classSlotId: string; date: string },
  now: Date = new Date(),
): Promise<SessionResult> {
  const today = todayInStudio(now);
  if (isDatePast(input.date, today)) {
    return {
      ok: false,
      error: "data passada nao permite materializacao para agendamento",
      field: "date",
    };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));

  if (!slot) {
    return { ok: false, error: "turma nao encontrada" };
  }

  const [classType] = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, slot.classTypeId));

  if (!classType) {
    return { ok: false, error: "modalidade nao encontrada" };
  }

  if (slot.status === "INATIVA") {
    return {
      ok: false,
      error: "turma inativa nao gera ocorrencias nem aceita reservas",
      field: "status",
    };
  }
  if (classType.status === "INATIVA") {
    return {
      ok: false,
      error: "modalidade inativa nao gera ocorrencias nem aceita reservas",
      field: "status",
    };
  }

  const [existing] = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classSlotId, input.classSlotId),
        eq(classSessions.sessionDate, input.date),
      ),
    );

  const blocked = await hasBlock(db, input.date);

  if (existing) {
    // Bloqueio registrado depois da materializacao reflete na ocorrencia
    if (blocked && existing.status === "AGENDADA") {
      const [updated] = await db
        .update(classSessions)
        .set({ status: "BLOQUEADA", updatedAt: now })
        .where(eq(classSessions.id, existing.id))
        .returning();
      return { ok: true, value: updated };
    }
    return { ok: true, value: existing };
  }

  // A ocorrencia de uma turma so existe no dia da semana dela (RES-06)
  if (weekdayOf(input.date) !== slot.weekday) {
    return {
      ok: false,
      error: "data nao corresponde ao dia da semana da turma",
      field: "date",
    };
  }

  const [created] = await db
    .insert(classSessions)
    .values({
      classSlotId: input.classSlotId,
      sessionDate: input.date,
      status: blocked ? "BLOQUEADA" : "AGENDADA",
    })
    // Idempotencia em corrida de duas leituras simultaneas (RES-19 do spec)
    .onConflictDoNothing({
      target: [classSessions.classSlotId, classSessions.sessionDate],
    })
    .returning();

  if (created) return { ok: true, value: created };

  // Perdeu a corrida de insercao: a sessao ja existe, devolve a existente
  const [winner] = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classSlotId, input.classSlotId),
        eq(classSessions.sessionDate, input.date),
      ),
    );
  return winner
    ? { ok: true, value: winner }
    : { ok: false, error: "falha ao materializar ocorrencia" };
}

/**
 * Cancela as ocorrencias futuras agendadas de uma turma e libera as vagas das
 * reservas ativas delas (AD-013). O historico e preservado: as reservas ficam
 * CANCELADA, nao sao apagadas, e nenhum credito e gerado (modulo de creditos
 * ainda nao existe).
 */
export async function cancelFutureSessions(
  db: DbClient,
  input: { classSlotId: string; fromDate: string },
  now: Date = new Date(),
): Promise<number> {
  const sessions = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classSlotId, input.classSlotId),
        gte(classSessions.sessionDate, input.fromDate),
        eq(classSessions.status, "AGENDADA"),
      ),
    );

  if (sessions.length === 0) return 0;

  const sessionIds = sessions.map((session) => session.id);

  await db
    .update(classSessions)
    .set({ status: "CANCELADA", updatedAt: now })
    .where(inArray(classSessions.id, sessionIds));

  await db
    .update(bookings)
    .set({ status: "CANCELADA", updatedAt: now })
    .where(
      and(
        inArray(bookings.classSessionId, sessionIds),
        eq(bookings.status, "ATIVA"),
      ),
    );

  return sessions.length;
}

/** A data cai em feriado cadastrado ou dentro de um recesso (extremos inclusos). */
async function hasBlock(db: DbClient, date: string): Promise<boolean> {
  const [holiday] = await db.select().from(holidays).where(eq(holidays.date, date));
  const closures = await db
    .select({ id: studioClosures.id })
    .from(studioClosures)
    .where(
      and(
        lte(studioClosures.startDate, date),
        gte(studioClosures.endDate, date),
      ),
    );

  return Boolean(holiday) || closures.length > 0;
}
