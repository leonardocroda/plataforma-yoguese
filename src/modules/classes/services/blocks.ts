import { holidays, studioClosures } from "../../../db/schema";
import { DbClient } from "../../bookings/services/sessions";

export type Holiday = typeof holidays.$inferSelect;
export type StudioClosure = typeof studioClosures.$inferSelect;

export type BlockResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

/**
 * Cadastro de feriados e recessos (RES-11 a RES-13). O feriado tem data
 * unica: cadastrar a mesma data de novo e recusado em vez de duplicar o
 * bloqueio. O recesso e um periodo com extremos inclusos. O efeito sobre as
 * ocorrencias (status BLOQUEADA) vive no servico de sessoes, que consulta
 * estes registros.
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

  return created
    ? { ok: true, value: created }
    : {
        ok: false,
        error: "ja existe feriado cadastrado para esta data",
        field: "date",
      };
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
  return created
    ? { ok: true, value: created }
    : { ok: false, error: "falha ao gravar recesso" };
}
