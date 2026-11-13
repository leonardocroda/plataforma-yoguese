import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classSessions, experimentals } from "../../../../db/schema";
import {
  createExperimental,
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { createBooking } from "../bookings";
import { getOccurrenceComposition } from "../composition";

// EXP-41, EXP-42: a composicao e a fonte unica da ocupacao. A
// experimental APROVADA ocupa a vaga da ocorrencia; os demais status nao.

describe("composition with experimentals", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("aprovada ocupa a vaga e pendente nao ocupa", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 2 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: date })
      .returning();

    const compositionInput = {
      classSlotId: slotId,
      sessionId: session.id,
      date,
      capacity: 2,
    };

    // A reserva EXPERIMENTAL de sempre continua contando (sem regressao)
    const [student] = await createStudents(pg.db, 1);
    const booking = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "EXPERIMENTAL",
    });
    expect(booking.ok).toBe(true);

    const withBooking = await getOccurrenceComposition(pg.db, compositionInput);
    expect(withBooking.experimentalCount).toBe(1);
    expect(withBooking.total).toBe(1);
    expect(withBooking.availableSpots).toBe(1);

    // A solicitacao pendente nao ocupa vaga
    const pending = await createExperimental(pg.db, {
      classSessionId: session.id,
      status: "PENDENTE",
    });
    const withPending = await getOccurrenceComposition(pg.db, compositionInput);
    expect(withPending.experimentalCount).toBe(1);
    expect(withPending.total).toBe(1);
    expect(withPending.availableSpots).toBe(1);

    // Aprovada, ela ocupa a vaga
    await pg.db
      .update(experimentals)
      .set({ status: "APROVADA" })
      .where(eq(experimentals.id, pending.id));

    const approved = await getOccurrenceComposition(pg.db, compositionInput);
    expect(approved.experimentalCount).toBe(2);
    expect(approved.total).toBe(2);
    expect(approved.availableSpots).toBe(0);
  });

  it("cancelada com direito, falta e convertida liberam a vaga", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 2 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: date })
      .returning();

    const compositionInput = {
      classSlotId: slotId,
      sessionId: session.id,
      date,
      capacity: 2,
    };

    const experimental = await createExperimental(pg.db, {
      classSessionId: session.id,
      status: "APROVADA",
    });

    const approved = await getOccurrenceComposition(pg.db, compositionInput);
    expect(approved.experimentalCount).toBe(1);
    expect(approved.availableSpots).toBe(1);

    // Nenhum outro status ocupa a vaga (EXP-42): cancelada com ou sem
    // direito, falta, convertida, recusada e a tentativa duplicada deixam
    // a composicao zerada. A pendente esta no outro titulo.
    for (const status of [
      "CANCELADA_COM_DIREITO",
      "CANCELADA_SEM_DIREITO",
      "FALTA",
      "CONVERTIDA",
      "RECUSADA",
      "DUPLICADA",
    ] as const) {
      await pg.db
        .update(experimentals)
        .set({ status })
        .where(eq(experimentals.id, experimental.id));

      const composition = await getOccurrenceComposition(
        pg.db,
        compositionInput,
      );
      expect(composition.experimentalCount).toBe(0);
      expect(composition.total).toBe(0);
      expect(composition.availableSpots).toBe(2);
    }
  });
});
