"use server";

import type { DbClient } from "../bookings/services/sessions";
import { requireAdminSession } from "../auth/services/session";
import {
  approveExperimental as approveExperimentalService,
  cancelExperimental as cancelExperimentalService,
  changeExperimentalOccurrence as changeExperimentalOccurrenceService,
  createExperimentalRequest as createExperimentalRequestService,
  refuseExperimental as refuseExperimentalService,
  registerNoShow as registerNoShowService,
  registerPayment as registerPaymentService,
  registerWhatsAppContact as registerWhatsAppContactService,
  rescheduleExperimental as rescheduleExperimentalService,
  type ExperimentalRequestInput,
} from "./services/experimentals";
import {
  convertExperimental as convertExperimentalService,
  type ConversionInput,
} from "./services/conversion";

/**
 * Actions da experimental. A solicitacao publica nao exige sessao: quem
 * solicita e o visitante do site. Toda action administrativa exige sessao
 * de ADMIN no servidor (EXP-28): server action e endpoint POST
 * alcancavel sem a pagina.
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

/** Aprovacao (EXP-20): a solicitacao pendente ocupa a vaga da ocorrencia. */
export async function approveExperimentalAction(input: {
  experimentalId: string;
}) {
  await requireAdminSession();
  return approveExperimentalService(await dbClient(), input);
}

/** Recusa (EXP-23): o registro continua consultavel e o telefone e liberado. */
export async function refuseExperimentalAction(input: {
  experimentalId: string;
}) {
  await requireAdminSession();
  return refuseExperimentalService(await dbClient(), input);
}

/** Troca de data/horario (EXP-24). */
export async function changeExperimentalOccurrenceAction(input: {
  experimentalId: string;
  classSlotId: string;
  date: string;
}) {
  await requireAdminSession();
  return changeExperimentalOccurrenceService(await dbClient(), input);
}

/** Reagendamento (EXP-39): a cancelada com direito volta a aprovada. */
export async function rescheduleExperimentalAction(input: {
  experimentalId: string;
  classSlotId: string;
  date: string;
}) {
  await requireAdminSession();
  return rescheduleExperimentalService(await dbClient(), input);
}

/** Cancelamento (EXP-34): a regra das 24 horas decide o direito. */
export async function cancelExperimentalAction(input: {
  experimentalId: string;
}) {
  await requireAdminSession();
  return cancelExperimentalService(await dbClient(), input);
}

/** Falta (EXP-36): so depois do inicio da ocorrencia. */
export async function registerNoShowAction(input: { experimentalId: string }) {
  await requireAdminSession();
  return registerNoShowService(await dbClient(), input);
}

/** Pagamento manual (EXP-25): um dos quatro status do PRD 8.4. */
export async function registerPaymentAction(input: {
  experimentalId: string;
  paymentStatus: string;
}) {
  await requireAdminSession();
  return registerPaymentService(await dbClient(), input);
}

/** Contato via WhatsApp (EXP-26). */
export async function registerWhatsAppContactAction(input: {
  experimentalId: string;
}) {
  await requireAdminSession();
  return registerWhatsAppContactService(await dbClient(), input);
}

/**
 * Conversao em aluna (EXP-50): a experimental aprovada vira aluna ativa com
 * plano, horarios fixos e a declaracao copiada. Os erros do servico voltam
 * com o campo, para a tela mostrar a mensagem no lugar certo.
 */
export async function convertExperimentalAction(input: ConversionInput) {
  await requireAdminSession();
  return convertExperimentalService(await dbClient(), input);
}
