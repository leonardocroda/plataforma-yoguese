import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classSessions } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { createEnrollment } from "../../../students/services/enrollments";
import { createBooking } from "../bookings";
import { getComposition, getOccurrenceComposition } from "../composition";

describe("occurrence composition", () => {
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

  it("the single composition service feeds the booking and the reading paths", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 2 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [fixed, casual, extra] = await createStudents(pg.db, 3);

    const enrollment = await createEnrollment(pg.db, {
      studentId: fixed,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const booking = await createBooking(pg.db, {
      studentId: casual,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, casual),
    });
    expect(booking.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));

    // Fonte unica: o servico devolve fixos, reposicoes, experimentais e vagas
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId: session.id,
      date,
      capacity: 2,
    });
    expect(composition).toEqual({
      fixedCount: 1,
      makeupCount: 1,
      experimentalCount: 0,
      total: 2,
      availableSpots: 0,
    });

    // A leitura devolve exatamente os mesmos numeros
    const reading = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.fixedCount).toBe(composition.fixedCount);
      expect(reading.value.makeupCount).toBe(composition.makeupCount);
      expect(reading.value.experimentalCount).toBe(composition.experimentalCount);
      expect(reading.value.total).toBe(composition.total);
      expect(reading.value.availableSpots).toBe(composition.availableSpots);
    }

    // E o agendamento decide pela mesma conta: sem vaga, recusa
    const over = await createBooking(pg.db, {
      studentId: extra,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, extra),
    });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error).toContain("sem vaga");
    }
  });
});
