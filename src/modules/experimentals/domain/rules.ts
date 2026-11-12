// Regras do ciclo de vida da experimental (PRD 8.5, 8.6, EXP-34, EXP-35,
// EXP-36, EXP-38, EXP-56). O status decide o que o admin ainda pode
// fazer com a solicitacao; a regra das 24 horas decide se o cancelamento
// mantem o direito ao reagendamento.

import type { ExperimentalStatus } from "./validators";

/** Status sem nenhuma acao possivel (EXP-38). */
const TERMINAL_STATUSES: readonly ExperimentalStatus[] = [
  "RECUSADA",
  "CANCELADA_SEM_DIREITO",
  "FALTA",
  "CONVERTIDA",
  "DUPLICADA",
];

/** A solicitacao acabou: nenhuma acao do admin se aplica. */
export function isTerminalStatus(status: ExperimentalStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** O admin pode cancelar a solicitacao enquanto ela esta viva. */
export function canCancel(status: ExperimentalStatus): boolean {
  return status === "PENDENTE" || status === "APROVADA";
}

/** O direito ao reagendamento so existe na cancelada com direito (EXP-39). */
export function canReschedule(status: ExperimentalStatus): boolean {
  return status === "CANCELADA_COM_DIREITO";
}

/** A conversao em aluna so sai de uma experimental aprovada (EXP-56). */
export function canConvert(status: ExperimentalStatus): boolean {
  return status === "APROVADA";
}

/**
 * Regra das 24 horas do PRD 8.5: com 24 horas ou mais de antecedencia o
 * cancelamento mantem o direito ao reagendamento; com menos, o direito
 * acaba.
 */
export function cancellationKeepsRight(hoursBeforeStart: number): boolean {
  return hoursBeforeStart >= 24;
}

/**
 * A aula ja acabou: a conversao so vale depois do fim da ocorrencia
 * (EXP-56). O instante recebido e o do fim da aula.
 */
export function occurrenceHasEnded(endInstant: Date, now: Date): boolean {
  return endInstant.getTime() <= now.getTime();
}
