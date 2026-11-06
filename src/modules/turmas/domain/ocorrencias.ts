// Dominio puro de datas do estudio: toda a matematica de datas usa o
// calendario local de America/Sao_Paulo (RES-06, RES-10). Datas sao strings
// "YYYY-MM-DD"; comparacoes lexicas sao seguras nesse formato.

export const FUSO_ESTUDIO = "America/Sao_Paulo";

const FORMATO_FUSO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_ESTUDIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje no fuso do estudio, como "YYYY-MM-DD". */
export function hojeEstudio(agora: Date = new Date()): string {
  return FORMATO_FUSO.format(agora);
}

/** Dado de calendario "YYYY-MM-DD" -> Date em UTC (meio-dia, imune a fuso). */
function parseData(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

function dataParaString(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Dia da semana de uma data no convencao do spec (RES-03):
 * 1 = domingo ... 7 = sabado, em America/Sao_Paulo.
 * O calculo usa Date.UTC, imune a transicoes de horario de verao.
 */
export function weekdayDaData(data: string): number {
  return parseData(data).getUTCDay() + 1;
}

/** Avanca N dias de calendario sobre uma data "YYYY-MM-DD". */
export function avancarDias(data: string, dias: number): string {
  const d = parseData(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return dataParaString(d);
}

/**
 * Datas de ocorrencia de um slot (pelo weekday) entre dois dias, extremos
 * inclusos. Range invalido (de > ate) devolve lista vazia.
 */
export function datasDeOcorrencia(
  slot: { weekday: number },
  de: string,
  ate: string,
): string[] {
  if (de > ate) return [];

  const datas: string[] = [];
  let atual = de;
  while (atual <= ate) {
    if (weekdayDaData(atual) === slot.weekday) datas.push(atual);
    atual = avancarDias(atual, 1);
  }
  return datas;
}

/**
 * Proxima data de ocorrencia do slot a partir de "aPartirDe" (inclusa).
 * Sem aPartirDe usa hoje no fuso do estudio. Uma semana sempre basta.
 */
export function proximaOcorrencia(
  slot: { weekday: number },
  aPartirDe: string = hojeEstudio(),
): string {
  let atual = aPartirDe;
  for (let i = 0; i < 7; i++) {
    if (weekdayDaData(atual) === slot.weekday) return atual;
    atual = avancarDias(atual, 1);
  }
  return atual;
}

/** Uma data esta no passado (estrita) relativo a "hoje" do estudio. */
export function isDataPassada(data: string, hoje: string): boolean {
  return data < hoje;
}
