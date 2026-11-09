// Dominio puro do credito: a antecedencia e a validade sao calculadas no
// servidor, no fuso America/Sao_Paulo (CRD-02 a CRD-06).

import { addDays, STUDIO_TIMEZONE } from "../../classes/domain/occurrences";

const MS_PER_HOUR = 3_600_000;
const CREDIT_VALIDITY_DAYS = 30;

/** Antecedencia minima para o cancelamento gerar credito (PRD 6.1). */
export const MIN_CREDIT_NOTICE_HOURS = 24;

const STUDIO_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type StudioParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  date: string;
  time: string;
};

/** Data e hora de um instante no calendario do estudio. */
function studioParts(instant: Date): StudioParts {
  const values: Record<string, string> = {};
  for (const part of STUDIO_FORMAT.formatToParts(instant)) {
    values[part.type] = part.value;
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  // Alguns runtimes devolvem "24" para a meia-noite
  const hour = Number(values.hour) % 24;
  const minute = Number(values.minute);
  const second = Number(values.second);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
  };
}

/** Deslocamento do fuso do estudio em relacao ao UTC, no instante dado. */
function studioOffsetMs(instant: Date): number {
  const parts = studioParts(instant);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - instant.getTime();
}

/**
 * Instante UTC de uma data ("YYYY-MM-DD") e hora ("HH:MM[:SS]") do
 * calendario do estudio.
 */
function studioInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);

  const offset = studioOffsetMs(new Date(naive));
  const instant = new Date(naive - offset);
  // Refina com o offset no instante estimado (virada de horario de verao)
  const refined = studioOffsetMs(instant);
  return refined === offset ? instant : new Date(naive - refined);
}

/**
 * Antecedencia em horas entre o instante atual e o inicio da ocorrencia,
 * medida no fuso do estudio (CRD-02).
 */
export function hoursUntilOccurrence(
  sessionDate: string,
  startTime: string,
  now: Date = new Date(),
): number {
  const start = studioInstant(sessionDate, startTime);
  return (start.getTime() - now.getTime()) / MS_PER_HOUR;
}

/** Antecedencia de 24h ou mais gera credito (CRD-05, CRD-06). */
export function isEligibleForCredit(hours: number): boolean {
  return hours >= MIN_CREDIT_NOTICE_HOURS;
}

/** Vencimento do credito: 30 dias contados da geracao (CRD-04). */
export function creditExpiresAt(generatedAt: Date): Date {
  const local = studioParts(generatedAt);
  return studioInstant(
    addDays(local.date, CREDIT_VALIDITY_DAYS),
    local.time,
  );
}
