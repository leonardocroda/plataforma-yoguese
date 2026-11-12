// Cancelamento das experimentais quando a ocorrencia deixa de acontecer
// (PRD 8.5, EXP-45, EXP-46). O estudio causou a impossibilidade: a
// solicitacao vira CANCELADA_COM_DIREITO, libera a vaga e mantem o direito
// ao reagendamento no mesmo registro.

import { and, eq, inArray } from "drizzle-orm";
import { experimentals } from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";

/**
 * Cancela as experimentais de uma ocorrencia que o estudio cancelou
 * (EXP-45): as PENDENTE e APROVADA viram CANCELADA_COM_DIREITO, com o
 * instante do cancelamento gravado. Os demais status ficam intactos - uma
 * recusada, uma falta ou uma convertida nao tem direito a reagendamento.
 *
 * A vaga volta porque so a APROVADA ocupa a ocorrencia (EXP-41). O bloqueio
 * nao restaura a experimental depois: remover o bloqueio devolve o status da
 * ocorrencia, nao o da solicitacao (EXP-46).
 *
 * Devolve quantas experimentais foram canceladas.
 */
export async function cancelExperimentalsForOccurrence(
  db: DbClient,
  classSessionId: string,
  now: Date = new Date(),
): Promise<number> {
  const cancelled = await db
    .update(experimentals)
    .set({
      status: "CANCELADA_COM_DIREITO",
      cancelledAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(experimentals.classSessionId, classSessionId),
        inArray(experimentals.status, ["PENDENTE", "APROVADA"]),
      ),
    )
    .returning({ id: experimentals.id });

  return cancelled.length;
}
