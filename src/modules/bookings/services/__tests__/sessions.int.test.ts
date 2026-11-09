import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  classSlots,
  credits,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import {
  PostgresTestInstance,
  startPostgres,
} from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { createEnrollment } from "../../../students/services/enrollments";
import { updateSlot } from "../../../classes/services/classes";
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

  it("refuses materializing a date outside the class weekday", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 4 }, today); // quarta numa turma de terca

    const result = await materializeSession(pg.db, { classSlotId: slotId, date });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("dia da semana");
      expect(result.field).toBe("date");
    }
    const created = await pg.db.select().from(classSessions);
    expect(created).toHaveLength(0);
  });

  it("grants one credit per fixed student per cancelled future occurrence on a schedule edit", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 4);

    // Oito ocorrencias futuras da grade antiga
    const dates: string[] = [];
    let current = nextOccurrence({ weekday: 3 }, today);
    for (let i = 0; i < 8; i++) {
      dates.push(current);
      const materialized = await materializeSession(pg.db, {
        classSlotId: slotId,
        date: current,
      });
      expect(materialized.ok).toBe(true);
      current = daysAfter(current, 7);
    }

    // Quatro alunos fixos da turma
    for (const studentId of students) {
      const enrollment = await createEnrollment(pg.db, {
        studentId,
        classSlotId: slotId,
        startDate: dates[0],
      });
      expect(enrollment.ok).toBe(true);
    }

    // Editar o dia da turma cancela as ocorrencias futuras antigas
    const edited = await updateSlot(pg.db, slotId, {
      weekday: 4,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(edited.ok).toBe(true);

    // Nenhuma ocorrencia futura antiga sobrevive
    const oldSessions = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(oldSessions).toHaveLength(8);
    expect(oldSessions.every((row) => row.status === "CANCELADA")).toBe(true);

    // Oito ocorrencias x quatro fixos = 32 creditos do estudio
    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(32);
    expect(stored.every((row) => row.source === "CANCELAMENTO_ESTUDIO")).toBe(
      true,
    );
    expect(stored.every((row) => row.status === "DISPONIVEL")).toBe(true);

    for (const studentId of students) {
      const own = stored.filter((row) => row.studentId === studentId);
      expect(own).toHaveLength(8);
      // Um credito por ocorrencia cancelada
      expect(new Set(own.map((row) => row.sourceSessionId)).size).toBe(8);
    }
  });
});

/** Soma dias de calendario sobre uma data "YYYY-MM-DD" (meio-dia UTC). */
function daysAfter(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
