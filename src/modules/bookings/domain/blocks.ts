// Dominio puro do bloqueio por feriado e recesso (FER-01 a FER-15). A regra
// de cobertura de datas e a transicao de status de uma ocorrencia vivem aqui,
// em fonte unica: a materializacao (services/sessions.ts) e o reconcilio
// (services/blocks.ts) consultam estas funcoes. Datas sao strings
// "YYYY-MM-DD"; comparacoes lexicas sao seguras nesse formato.

import { weekdayOf } from "../../classes/domain/occurrences";

export type BlockDate =
  | { kind: "holiday"; date: string }
  | { kind: "closure"; startDate: string; endDate: string };

export type OccurrenceStatus = "AGENDADA" | "BLOQUEADA" | "CANCELADA";

/** "BLOQUEADA" ou "AGENDADA" quando ha transicao; null quando nada muda. */
export type BlockTransition = "BLOQUEADA" | "AGENDADA" | null;

/**
 * A data cai em feriado cadastrado ou dentro de um recesso, com extremos
 * inclusos (RES-07, FER-02).
 */
export function isDateCoveredByBlocks(
  date: string,
  blocks: BlockDate[],
): boolean {
  return blocks.some((block) => {
    if (block.kind === "holiday") return block.date === date;
    return date >= block.startDate && date <= block.endDate;
  });
}

export type BlockTransitionInput = {
  date: string;
  currentStatus: OccurrenceStatus;
  /** Dia da semana ATUAL da turma (1 = domingo ... 7 = sabado). */
  slotWeekday: number;
  isCovered: boolean;
  today: string;
};

/**
 * Transicao de status da ocorrencia diante dos bloqueios vigentes (FER-01 a
 * FER-15). O bloqueio so alcanca o presente e o futuro (FER-06: hoje entra,
 * ontem nao). Ocorrencia CANCELADA nunca muda (FER-07). Coberta e AGENDADA
 * vira BLOQUEADA (FER-01); descoberta e BLOQUEADA volta a AGENDADA (FER-10)
 * so se o dia da semana da data ainda corresponder a turma - a guarda
 * protege a ocorrencia orfa da edicao de dia/horario (FER-14, AD-013). Os
 * demais casos ficam como estao: bloquear e idempotente (FER-12).
 */
export function resolveBlockTransition(
  input: BlockTransitionInput,
): BlockTransition {
  if (input.currentStatus === "CANCELADA") return null;
  if (input.date < input.today) return null;

  if (input.isCovered) {
    return input.currentStatus === "AGENDADA" ? "BLOQUEADA" : null;
  }

  if (input.currentStatus !== "BLOQUEADA") return null;
  return weekdayOf(input.date) === input.slotWeekday ? "AGENDADA" : null;
}
