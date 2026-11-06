import { and, eq, gte, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema";
import { classSessions, classSlots } from "../../../db/schema";
import {
  holidays,
  studioClosures,
} from "../../../db/schema";
import { hojeEstudio, isDataPassada } from "../../turmas/domain/ocorrencias";

export type DbClient = NodePgDatabase<typeof schema>;

export type Sessao = typeof classSessions.$inferSelect;

export type ResultadoSessao =
  | { ok: true; valor: Sessao }
  | { ok: false; erro: string; campo?: string };

/**
 * Get-or-create da ocorrencia de (slot, data) - RES-06. Idempotente, sem job
 * e sem horizonte fixo (AD-008). Marca BLOQUEADA em feriado/recesso (RES-07)
 * e recusa materializar data passada para agendamento (RES-10).
 */
export async function materializarSessao(
  db: DbClient,
  entrada: { classSlotId: string; data: string },
  agora: Date = new Date(),
): Promise<ResultadoSessao> {
  const hoje = hojeEstudio(agora);
  if (isDataPassada(entrada.data, hoje)) {
    return {
      ok: false,
      erro: "data passada nao permite materializacao para agendamento",
      campo: "data",
    };
  }

  const [existente] = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classSlotId, entrada.classSlotId),
        eq(classSessions.sessionDate, entrada.data),
      ),
    );

  const bloqueado = await temBloqueio(db, entrada.data);

  if (existente) {
    // Bloqueio registrado depois da materializacao reflete na ocorrencia
    if (bloqueado && existente.status === "AGENDADA") {
      const [atualizada] = await db
        .update(classSessions)
        .set({ status: "BLOQUEADA", updatedAt: agora })
        .where(eq(classSessions.id, existente.id))
        .returning();
      return { ok: true, valor: atualizada };
    }
    return { ok: true, valor: existente };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, entrada.classSlotId));

  if (!slot) {
    return { ok: false, erro: "turma nao encontrada" };
  }
  if (slot.status === "INATIVA") {
    return {
      ok: false,
      erro: "turma inativa nao gera novas ocorrencias",
      campo: "status",
    };
  }

  const [criada] = await db
    .insert(classSessions)
    .values({
      classSlotId: entrada.classSlotId,
      sessionDate: entrada.data,
      status: bloqueado ? "BLOQUEADA" : "AGENDADA",
    })
    // Idempotencia em corrida de duas leituras simultaneas (RES-19 do spec)
    .onConflictDoNothing({
      target: [classSessions.classSlotId, classSessions.sessionDate],
    })
    .returning();

  if (criada) return { ok: true, valor: criada };

  // Perdeu a corrida de insercao: a sessao ja existe, devolve a existente
  const [vencedora] = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classSlotId, entrada.classSlotId),
        eq(classSessions.sessionDate, entrada.data),
      ),
    );
  return vencedora
    ? { ok: true, valor: vencedora }
    : { ok: false, erro: "falha ao materializar ocorrencia" };
}

/** A data cai em feriado cadastrado ou dentro de um recesso (extremos inclusos). */
async function temBloqueio(db: DbClient, data: string): Promise<boolean> {
  const [feriado] = await db.select().from(holidays).where(eq(holidays.date, data));
  const recessos = await db
    .select({ id: studioClosures.id })
    .from(studioClosures)
    .where(
      and(
        lte(studioClosures.startDate, data),
        gte(studioClosures.endDate, data),
      ),
    );

  return Boolean(feriado) || recessos.length > 0;
}
