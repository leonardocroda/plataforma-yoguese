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
