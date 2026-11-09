// Semana do credito: segunda a domingo no fuso do estudio (CRD-19, CRD-20).
// O limite de reposicoes conta a semana da data da ocorrencia da reposicao.

import {
  bookingStatusEnum,
  bookingTypeEnum,
} from "../../../db/schema/sessions";
import { addDays, weekdayOf } from "../../classes/domain/occurrences";

export type BookingType = (typeof bookingTypeEnum.enumValues)[number];

export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];

export type MakeupBooking = {
  bookingType: BookingType;
  status: BookingStatus;
  sessionDate: string;
};

/**
 * Chave da semana de uma data do calendario do estudio ("YYYY-MM-DD"): a
 * data da segunda-feira da semana. As sete datas da semana devolvem a mesma
 * chave e a semana seguinte devolve outra (AD-024).
 */
export function weekKey(date: string): string {
  // weekdayOf: 1 = domingo ... 7 = sabado; a segunda e o dia 2
  const daysSinceMonday = (weekdayOf(date) + 5) % 7;
  return addDays(date, -daysSinceMonday);
}

/**
 * Quantas reposicoes ativas caem na semana da ocorrencia informada: as
 * reservas MAKEUP ativas cuja data da ocorrencia esta na mesma semana
 * (CRD-20).
 */
export function countWeeklyMakeups(
  bookings: MakeupBooking[],
  occurrenceDate: string,
): number {
  const week = weekKey(occurrenceDate);

  return bookings.filter(
    (booking) =>
      booking.bookingType === "MAKEUP" &&
      booking.status === "ATIVA" &&
      weekKey(booking.sessionDate) === week,
  ).length;
}
