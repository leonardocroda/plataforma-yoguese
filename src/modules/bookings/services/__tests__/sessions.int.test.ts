import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  classSlots,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import { createTestClass, clearTables } from "../../../../test/fixtures";
import {
  PostgresTestInstance,
  startPostgres,
} from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { materializeSession } from "../sessions";

describe("sessions", () => {
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

  it("creates on the first query and re-queries without duplicating", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const first = await materializeSession(pg.db, { classSlotId: slotId, date });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.status).toBe("AGENDADA");
      expect(first.value.sessionDate).toBe(date);
      expect(first.value.classSlotId).toBe(slotId);
    }

    const second = await materializeSession(pg.db, { classSlotId: slotId, date });
    expect(second.ok).toBe(true);
    if (second.ok && first.ok) {
      expect(second.value.id).toBe(first.value.id);
    }

    const created = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(created).toHaveLength(1);
  });

  it("a holiday blocks the occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });

    const result = await materializeSession(pg.db, { classSlotId: slotId, date });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("BLOQUEADA");
    }

    const [row] = await pg.db.select().from(classSessions);
    expect(row?.status).toBe("BLOQUEADA");
  });

  it("a closure blocks the occurrence within the inclusive range", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    await pg.db.insert(studioClosures).values({
      startDate: date, // extremo inicial incluso
      endDate: daysAfter(date, 8),
      reason: "Recesso Teste",
    });

    const result = await materializeSession(pg.db, { classSlotId: slotId, date });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("BLOQUEADA");
    }
  });

  it("rejects materializing a past date", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const result = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: "2024-01-02", // terca no passado
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("data passada");
      expect(result.field).toBe("date");
    }

    const created = await pg.db.select().from(classSessions);
    expect(created).toHaveLength(0);
  });

  it("an inactive class does not generate new occurrences", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, slotId));

    const result = await materializeSession(pg.db, { classSlotId: slotId, date });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("inativa");
    }
    const created = await pg.db.select().from(classSessions);
    expect(created).toHaveLength(0);
  });
});

/** Soma dias de calendario sobre uma data "YYYY-MM-DD" (meio-dia UTC). */
function daysAfter(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
