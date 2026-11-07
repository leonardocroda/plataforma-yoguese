import { and, eq, gte, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema";
import { classSessions, classSlots } from "../../../db/schema";
import {
  holidays,
  studioClosures,
} from "../../../db/schema";
import { todayInStudio, isDatePast } from "../../classes/domain/occurrences";

export type DbClient = NodePgDatabase<typeof schema>;

export type Session = typeof classSessions.$inferSelect;

export type SessionResult =
  | { ok: true; value: Session }
  | { ok: false; error: string; field?: string };

/**
 * Get-or-create da ocorrencia de (slot, data) - RES-06. Idempotente, sem job
 * e sem horizonte fixo (AD-008). Marca BLOQUEADA em feriado/recesso (RES-07)
 * e recusa materializar data passada para agendamento (RES-10).
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

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));

  if (!slot) {
    return { ok: false, error: "turma nao encontrada" };
  }
  if (slot.status === "INATIVA") {
    return {
      ok: false,
      error: "turma inativa nao gera novas ocorrencias",
      field: "status",
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
