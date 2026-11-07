import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { holidays } from "../../../../db/schema";
import { createTestClass, clearTables } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio } from "../../domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { createHoliday, createStudioClosure } from "../blocks";

describe("blocks", () => {
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

  it("a holiday blocks the occurrence on that date", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.date).toBe(date);
      expect(created.value.name).toBe("Feriado Municipal");
    }

    const occurrence = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(occurrence.ok).toBe(true);
    if (occurrence.ok) {
      expect(occurrence.value.status).toBe("BLOQUEADA");
    }
  });

  it("a closure blocks the inclusive boundary dates", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const startDate = nextOccurrence({ weekday: 3 }, today);
    const endDate = addDays(startDate, 7); // mesma weekday, uma semana depois

    const created = await createStudioClosure(pg.db, {
      startDate,
      endDate,
      reason: "Recesso de Inverno",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.startDate).toBe(startDate);
      expect(created.value.endDate).toBe(endDate);
    }

    const first = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: startDate,
    });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.status).toBe("BLOQUEADA");

    const last = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: endDate,
    });
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.value.status).toBe("BLOQUEADA");

    // Fora do periodo a ocorrencia volta a ser agendada
    const after = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: addDays(endDate, 7),
    });
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.value.status).toBe("AGENDADA");
  });

  it("refuses a holiday on a date already registered", async () => {
    const date = nextOccurrence({ weekday: 3 }, today);

    const first = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(first.ok).toBe(true);

    const second = await createHoliday(pg.db, { date, name: "Feriado Repetido" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("feriado");
      expect(second.field).toBe("date");
    }

    // Nenhum segundo bloqueio para a mesma data
    const rows = await pg.db.select().from(holidays);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Feriado Municipal");
  });
});
