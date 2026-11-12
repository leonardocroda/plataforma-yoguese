"use server";

import type { DbClient } from "../bookings/services/sessions";
import {
  createExperimentalRequest as createExperimentalRequestService,
  type ExperimentalRequestInput,
} from "./services/experimentals";

/**
 * Actions da experimental. A solicitacao publica nao exige sessao: quem
 * solicita e o visitante do site. As actions administrativas (aprovar,
 * recusar, cancelar, converter) vao nascer em `actions.ts` com o guard de
 * ADMIN.
 */

/**
 * O client so e necessario em tempo de execucao. O import dinamico mantem o
 * build (`next build`) funcionando sem DATABASE_URL configurada.
 */
async function dbClient(): Promise<DbClient> {
  const { db } = await import("../../db");
  return db;
}

/**
 * Envia a solicitacao de aula experimental (EXP-06, EXP-29). Devolve o
 * resultado do servico: `ok/value` ou `error/field`, para a tela mostrar a
 * mensagem no campo certo.
 */
export async function requestExperimentalAction(
  input: ExperimentalRequestInput,
) {
  return createExperimentalRequestService(await dbClient(), input);
}
