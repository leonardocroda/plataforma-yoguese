// Reconcilio do bloqueio por feriado/recesso sobre as ocorrencias (FER-01 a
// FER-15, AD-026, AD-027). A transicao de status e decidida pela funcao pura
// do dominio (domain/blocks.ts); este servico aplica as consequencias: ao
// bloquear, cancela as reservas ativas da ocorrencia e devolve o credito
// RESERVADO de cada reposicao cancelada com o vencimento original (nenhum
// credito novo e criado - PRD 7.1/7.2). Ao desbloquear, apenas devolve o
// status: as reservas canceladas nao sao restauradas (o aluno remarca). O
// reconcilio e idempotente e roda em uma transacao unica por chamada.

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
  credits,
  holidays,
  studioClosures,
} from "../../../db/schema";
import { todayInStudio } from "../../classes/domain/occurrences";
import {
  BlockDate,
  isDateCoveredByBlocks,
  resolveBlockTransition,
} from "../domain/blocks";
import { returnCredit } from "../../credits/services/credits";
import { DbClient } from "./sessions";

export type ReconcileBlockedOccurrencesInput = {
  /** Janela reprocessada, extremos inclusos. Datas passadas sao ignoradas. */
  fromDate: string;
  toDate: string;
};

export type ReconcileBlockedOccurrencesResult = {
  blockedCount: number;
  reopenedCount: number;
  cancelledBookings: number;
  returnedCredits: number;
};

export async function reconcileBlockedOccurrences(
  db: DbClient,
  input: ReconcileBlockedOccurrencesInput,
  now: Date = new Date(),
): Promise<ReconcileBlockedOccurrencesResult> {
  const today = todayInStudio(now);
  const empty = {
    blockedCount: 0,
    reopenedCount: 0,
    cancelledBookings: 0,
    returnedCredits: 0,
  };

  // Janela vazia (ex.: bloqueio cadastrado so no passado): nada a fazer
  if (input.fromDate > input.toDate) return empty;

  return db.transaction(async (tx) => {
    // Os bloqueios sao pequenos e a cobertura de cada data pode vir de
    // qualquer um deles: carrega tudo uma vez e decide na funcao pura
    const holidayRows = await tx.select({ date: holidays.date }).from(holidays);
    const closureRows = await tx
      .select({
        startDate: studioClosures.startDate,
        endDate: studioClosures.endDate,
      })
      .from(studioClosures);
    const blocks: BlockDate[] = [
      ...holidayRows.map((row) => ({ kind: "holiday" as const, date: row.date })),
      ...closureRows.map((row) => ({
        kind: "closure" as const,
        startDate: row.startDate,
        endDate: row.endDate,
      })),
    ];

    const occurrences = await tx
      .select({
        id: classSessions.id,
        sessionDate: classSessions.sessionDate,
        status: classSessions.status,
        slotWeekday: classSlots.weekday,
      })
      .from(classSessions)
      .innerJoin(classSlots, eq(classSlots.id, classSessions.classSlotId))
      .where(
        and(
          gte(classSessions.sessionDate, input.fromDate),
          lte(classSessions.sessionDate, input.toDate),
          inArray(classSessions.status, ["AGENDADA", "BLOQUEADA"]),
        ),
      );

    const result = { ...empty };

    for (const occurrence of occurrences) {
      const transition = resolveBlockTransition({
        date: occurrence.sessionDate,
        currentStatus: occurrence.status,
        slotWeekday: occurrence.slotWeekday,
        isCovered: isDateCoveredByBlocks(occurrence.sessionDate, blocks),
        today,
      });
      if (!transition || transition === occurrence.status) continue;

      if (transition === "BLOQUEADA") {
        await tx
          .update(classSessions)
          .set({ status: "BLOQUEADA", updatedAt: now })
          .where(eq(classSessions.id, occurrence.id));
        result.blockedCount += 1;

        // As reservas ativas da ocorrencia bloqueada sao canceladas pelo
        // estudio (FER-03, AD-026) e o credito da reposicao volta a
        // DISPONIVEL com o vencimento original (FER-04)
        const activeBookings = await tx
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.classSessionId, occurrence.id),
              eq(bookings.status, "ATIVA"),
            ),
          );

        for (const booking of activeBookings) {
          const [cancelled] = await tx
            .update(bookings)
            .set({
              status: "CANCELADA",
              cancelledAt: now,
              cancelledBy: "ESTUDIO",
              updatedAt: now,
            })
            .where(eq(bookings.id, booking.id))
            .returning();
          if (!cancelled) continue;
          result.cancelledBookings += 1;

          const [credit] = await tx
            .select()
            .from(credits)
            .where(eq(credits.usedBookingId, cancelled.id));
          if (credit && credit.status === "RESERVADO") {
            const returned = await returnCredit(
              tx,
              {
                creditId: credit.id,
                reason: "Ocorrencia bloqueada por feriado/recesso",
                adminLabel: "admin",
              },
              now,
            );
            if (returned.ok) result.returnedCredits += 1;
          }
        }
      } else {
        // Desbloqueio (FER-10, AD-027): so o status volta; as reservas
        // canceladas pelo bloqueio nao sao restauradas (FER-15)
        await tx
          .update(classSessions)
          .set({ status: "AGENDADA", updatedAt: now })
          .where(eq(classSessions.id, occurrence.id));
        result.reopenedCount += 1;
      }
    }

    return result;
  });
}
