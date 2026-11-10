import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { hoursUntilOccurrence } from "../../../credits/domain/credit-rules";
import { registerNonAttendance } from "../../../credits/services/cancellations";
import { createEnrollment } from "../../../students/services/enrollments";
import { getComposition } from "../composition";

// Composicao com o fixo cancelado ou faltante (CRD-09).

const HOUR_MS = 60 * 60 * 1000;
const START_TIME = "19:00:00";

describe("composition", () => {
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

  /** Instante do aviso: `hoursBefore` horas antes do inicio da aula. */
  function noticeInstant(date: string, hoursBefore = 48): Date {
    const reference = new Date("2026-11-01T12:00:00Z");
    const toStart = hoursUntilOccurrence(date, START_TIME, reference);
    const start = new Date(
      reference.getTime() + Math.round(toStart * HOUR_MS),
    );
    return new Date(start.getTime() - hoursBefore * HOUR_MS);
  }

  it("drops the fixed student who cancelled or missed the occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: START_TIME,
      endTime: "20:00:00",
    });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [cancelled, missed] = await createStudents(pg.db, 2);

    for (const student of [cancelled, missed]) {
      const enrollment = await createEnrollment(pg.db, {
        studentId: student,
        classSlotId: slotId,
        startDate: date,
      });
      expect(enrollment.ok).toBe(true);
    }

    const before = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.fixedCount).toBe(2);
    expect(before.value.availableSpots).toBe(6);

    // O primeiro aluno avisa que nao comparece com 48h: cancelamento
    const notice = await registerNonAttendance(
      pg.db,
      { studentId: cancelled, classSessionId: before.value.sessionId },
      noticeInstant(date),
    );
    expect(notice.ok).toBe(true);
    if (notice.ok) {
      expect(notice.value.status).toBe("CANCELADA");
    }

    // O segundo avisa com menos de 24h: falta
    const absence = await registerNonAttendance(
      pg.db,
      { studentId: missed, classSessionId: before.value.sessionId },
      noticeInstant(date, 5),
    );
    expect(absence.ok).toBe(true);
    if (absence.ok) {
      expect(absence.value.status).toBe("FALTA");
    }

    // Na ocorrencia nenhum dos dois conta como fixo: as 2 vagas voltam
    const after = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value.fixedCount).toBe(0);
      expect(after.value.makeupCount).toBe(0);
      expect(after.value.total).toBe(0);
      expect(after.value.availableSpots).toBe(8);
    }

    // Nas ocorrencias futuras o aluno segue contando como fixo (CRD-08)
    const nextDate = nextOccurrence({ weekday: 3 }, addDays(date, 1));
    const next = await getComposition(pg.db, {
      classSlotId: slotId,
      date: nextDate,
    });
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.value.fixedCount).toBe(2);
      expect(next.value.total).toBe(2);
      expect(next.value.availableSpots).toBe(6);
    }
  });
});
