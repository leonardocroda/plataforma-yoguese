// Dominio puro de datas do estudio: toda a matematica de datas usa o
// calendario local de America/Sao_Paulo (RES-06, RES-10). Datas sao strings
// "YYYY-MM-DD"; comparacoes lexicas sao seguras nesse formato.

export const STUDIO_TIMEZONE = "America/Sao_Paulo";

const TIMEZONE_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDIO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje no fuso do estudio, como "YYYY-MM-DD". */
export function todayInStudio(now: Date = new Date()): string {
  return TIMEZONE_DATE_FORMAT.format(now);
}

/** Dado de calendario "YYYY-MM-DD" -> Date em UTC (meio-dia, imune a fuso). */
function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Dia da semana de uma data no convencao do spec (RES-03):
 * 1 = domingo ... 7 = sabado, em America/Sao_Paulo.
 * O calculo usa Date.UTC, imune a transicoes de horario de verao.
 */
export function weekdayOf(date: string): number {
  return parseDate(date).getUTCDay() + 1;
}

/** Avanca N dias de calendario sobre uma data "YYYY-MM-DD". */
export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToString(d);
}

/**
 * Datas de ocorrencia de um slot (pelo weekday) entre dois dias, extremos
 * inclusos. Range invalido (de > ate) devolve lista vazia.
 */
export function occurrenceDates(
  slot: { weekday: number },
  from: string,
  to: string,
): string[] {
  if (from > to) return [];

  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    if (weekdayOf(current) === slot.weekday) dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

/**
 * Proxima data de ocorrencia do slot a partir de "aPartirDe" (inclusa).
 * Sem aPartirDe usa hoje no fuso do estudio. Uma semana sempre basta.
 */
export function nextOccurrence(
  slot: { weekday: number },
  fromDate: string = todayInStudio(),
): string {
  let current = fromDate;
  for (let i = 0; i < 7; i++) {
    if (weekdayOf(current) === slot.weekday) return current;
    current = addDays(current, 1);
  }
  return current;
}

/** Uma data esta no passado (estrita) relativo a "hoje" do estudio. */
export function isDatePast(date: string, today: string): boolean {
  return date < today;
}

/**
 * Deslocamento do fuso do estudio (ms) no instante informado: o horario
 * local lido no fuso menos o mesmo horario em UTC.
 */
function studioOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const localAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return localAsUtc - instant.getTime();
}

/**
 * Data + horario do estudio -> instante absoluto (EXP-34, EXP-56). A
 * regua das 24 horas e o fim da aula dependem do fuso do estudio, nao do
 * fuso do servidor. O deslocamento e lido do fuso, e nao fixo no codigo.
 */
export function studioDateTimeToInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(guess - studioOffsetMs(new Date(guess)));
}
