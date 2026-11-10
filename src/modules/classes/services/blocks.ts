import { asc, eq } from "drizzle-orm";
import { holidays, studioClosures } from "../../../db/schema";
import { DbClient } from "../../bookings/services/sessions";
import { reconcileBlockedOccurrences } from "../../bookings/services/blocks";
import { todayInStudio } from "../domain/occurrences";

export type Holiday = typeof holidays.$inferSelect;
export type StudioClosure = typeof studioClosures.$inferSelect;

export type BlockResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

/**
 * Cadastro de feriados e recessos (RES-11 a RES-13). O feriado tem data
 * unica: cadastrar a mesma data de novo e recusado em vez de duplicar o
 * bloqueio. O recesso e um periodo com extremos inclusos. O efeito sobre as
 * ocorrencias e imediato: toda criacao dispara o reconcilio sobre a janela
 * da data, clampada para hoje em diante (FER-01, FER-02, FER-06, AD-029) -
 * a materializacao preguicosa de sessions.ts permanece como retaguarda.
 */

export async function createHoliday(
  db: DbClient,
  input: { date: string; name: string },
): Promise<BlockResult<Holiday>> {
  const [created] = await db
    .insert(holidays)
    .values(input)
    // Data unica no banco: a insercao conflitante nao cria segundo bloqueio
    .onConflictDoNothing({ target: holidays.date })
    .returning();

  if (!created) {
    return {
      ok: false,
      error: "ja existe feriado cadastrado para esta data",
      field: "date",
    };
  }

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    // Data passada: a janela fica vazia e nada e alterado (FER-06)
    fromDate: input.date > today ? input.date : today,
    toDate: input.date,
  });

  return { ok: true, value: created };
}

export async function createStudioClosure(
  db: DbClient,
  input: { startDate: string; endDate: string; reason: string },
): Promise<BlockResult<StudioClosure>> {
  if (input.endDate < input.startDate) {
    return {
      ok: false,
      error: "endDate: fim do recesso nao pode ser antes do inicio",
      field: "endDate",
    };
  }

  const [created] = await db.insert(studioClosures).values(input).returning();
  if (!created) return { ok: false, error: "falha ao gravar recesso" };

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    fromDate: input.startDate > today ? input.startDate : today,
    toDate: input.endDate,
  });

  return { ok: true, value: created };
}

/**
 * Edita um feriado (FER-19, FER-20): data e nome novos, com a colisao de
 * data recusada (o indice unico do banco e a retaguarda da corrida). A
 * edicao reprocessa os bloqueios da janela entre a data antiga e a nova:
 * a data antiga desbloqueia e a nova bloqueia na mesma operacao (AD-027).
 */
export async function updateHoliday(
  db: DbClient,
  input: { id: string; date: string; name: string },
): Promise<BlockResult<Holiday>> {
  const [existing] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.id, input.id));
  if (!existing) {
    return { ok: false, error: "feriado nao encontrado", field: "id" };
  }

  const [collision] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(eq(holidays.date, input.date));
  if (collision && collision.id !== input.id) {
    return {
      ok: false,
      error: "ja existe feriado cadastrado para esta data",
      field: "date",
    };
  }

  const [updated] = await db
    .update(holidays)
    .set({ date: input.date, name: input.name, updatedAt: new Date() })
    .where(eq(holidays.id, input.id))
    .returning();
  if (!updated) return { ok: false, error: "falha ao gravar feriado" };

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    fromDate: minDate(existing.date, input.date, today),
    toDate: maxDate(existing.date, input.date),
  });

  return { ok: true, value: updated };
}

/**
 * Remove o feriado: o registro sai e as ocorrencias da data que nao ficam
 * mais cobertas por nenhum outro bloqueio voltam a AGENDADA (FER-10,
 * AD-027). O efeito e so para frente (FER-13).
 */
export async function deleteHoliday(
  db: DbClient,
  input: { id: string },
): Promise<BlockResult<{ id: string }>> {
  const [existing] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.id, input.id));
  if (!existing) {
    return { ok: false, error: "feriado nao encontrado", field: "id" };
  }

  await db.delete(holidays).where(eq(holidays.id, input.id));

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    fromDate: existing.date > today ? existing.date : today,
    toDate: existing.date,
  });

  return { ok: true, value: { id: existing.id } };
}

/**
 * Edita um recesso (FER-23): valida fim >= inicio e reprocessa as datas que
 * entraram e as que sairam do periodo (FER-11, AD-027).
 */
export async function updateStudioClosure(
  db: DbClient,
  input: {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
  },
): Promise<BlockResult<StudioClosure>> {
  if (input.endDate < input.startDate) {
    return {
      ok: false,
      error: "endDate: fim do recesso nao pode ser antes do inicio",
      field: "endDate",
    };
  }

  const [existing] = await db
    .select()
    .from(studioClosures)
    .where(eq(studioClosures.id, input.id));
  if (!existing) {
    return { ok: false, error: "recesso nao encontrado", field: "id" };
  }

  const [updated] = await db
    .update(studioClosures)
    .set({
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(studioClosures.id, input.id))
    .returning();
  if (!updated) return { ok: false, error: "falha ao gravar recesso" };

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    fromDate: minDate(existing.startDate, input.startDate, today),
    toDate: maxDate(existing.endDate, input.endDate),
  });

  return { ok: true, value: updated };
}

/**
 * Remove o recesso e desbloqueia as datas que nao ficam mais cobertas por
 * nenhum outro bloqueio (FER-11, AD-027).
 */
export async function deleteStudioClosure(
  db: DbClient,
  input: { id: string },
): Promise<BlockResult<{ id: string }>> {
  const [existing] = await db
    .select()
    .from(studioClosures)
    .where(eq(studioClosures.id, input.id));
  if (!existing) {
    return { ok: false, error: "recesso nao encontrado", field: "id" };
  }

  await db.delete(studioClosures).where(eq(studioClosures.id, input.id));

  const today = todayInStudio();
  await reconcileBlockedOccurrences(db, {
    fromDate: existing.startDate > today ? existing.startDate : today,
    toDate: existing.endDate,
  });

  return { ok: true, value: { id: existing.id } };
}

/** Os feriados para a tela, por data crescente (FER-16). */
export async function listHolidays(db: DbClient): Promise<Holiday[]> {
  return db.select().from(holidays).orderBy(asc(holidays.date));
}

/** Os recessos para a tela, por inicio crescente (FER-16). */
export async function listStudioClosures(db: DbClient): Promise<StudioClosure[]> {
  return db.select().from(studioClosures).orderBy(asc(studioClosures.startDate));
}

/** O menor entre duas datas "YYYY-MM-DD" clampado para "today" quando menor. */
function minDate(a: string, b: string, today: string): string {
  const min = a < b ? a : b;
  return min > today ? min : today;
}

/** O maior entre duas datas "YYYY-MM-DD". */
function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
