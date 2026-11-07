import { count } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedEnrollments } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { createBooking } from "../../../bookings/services/bookings";
import { createEnrollment, endEnrollment, listEnrollmentsByStudent } from "../enrollments";

describe("enrollments", () => {
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

  async function base(capacity: number) {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity });
    return { slotId, date: nextOccurrence({ weekday: 3 }, today) };
  }

  it("creates and counts from the start_date", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.startDate).toBe(date);
      expect(created.value.endDate).toBeNull();
      expect(created.value.status).toBe("ATIVA");
    }

    // O fixo ocupa vaga na propria data inicial: segundo fixo recusa
    const secondAttempt = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) {
      expect(secondAttempt.error).toContain("sem vaga");
    }
  });

  it("rejects a full class at the next occurrence", async () => {
    const { slotId, date } = await base(1);
    const [occupant, wantsFixed] = await createStudents(pg.db, 2);

    const booking = await createBooking(pg.db, {
      studentId: occupant,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(booking.ok).toBe(true);

    const result = await createEnrollment(pg.db, {
      studentId: wantsFixed,
      classSlotId: slotId,
      startDate: date,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(0);
  });

  it("capacity is checked before writing", async () => {
    const { slotId, date } = await base(2);
    const [fixed, occupant, third] = await createStudents(pg.db, 3);

    const first = await createEnrollment(pg.db, {
      studentId: fixed,
      classSlotId: slotId,
      startDate: date,
    });
    expect(first.ok).toBe(true);

    const booking = await createBooking(pg.db, {
      studentId: occupant,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(booking.ok).toBe(true);

    // segundo fixo estouraria a capacidade -> recusado sem estado parcial
    const excess = await createEnrollment(pg.db, {
      studentId: third,
      classSlotId: slotId,
      startDate: date,
    });
    expect(excess.ok).toBe(false);
    if (!excess.ok) {
      expect(excess.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(1);
  });

  it("an ended enrollment leaves the date count", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);

    const ended = await endEnrollment(pg.db, created.ok ? created.value.id : "");
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.status).toBe("INATIVA");
    }

    // Com o fixo encerrado, a vaga volta: o proximo aluno cria
    const next = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(next.ok).toBe(true);
  });

  it("end_date removes the count after the end", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);

    // end_date no proprio dia da proxima ocorrencia: a partir da data
    // encerrada o fixo deixa de contar (RES-23 AC4)
    const ended = await endEnrollment(
      pg.db,
      created.ok ? created.value.id : "",
      { date },
    );
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.endDate).toBe(date);
    }

    const next = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(next.ok).toBe(true);
  });

  it("student history", async () => {
    const classA = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const classB = await createTestClass(pg.db, { weekday: 5, capacity: 8 });
    const [a, lonely] = await createStudents(pg.db, 2);
    const dateA = nextOccurrence({ weekday: 3 }, today);
    const dateB = nextOccurrence({ weekday: 5 }, today);

    const fixedA = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: classA.slotId,
      startDate: dateA,
    });
    expect(fixedA.ok).toBe(true);
    const fixedB = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: classB.slotId,
      startDate: dateB,
    });
    expect(fixedB.ok).toBe(true);
    if (fixedB.ok) {
      // Ativo e encerrado vazam no historico (RES-24)
      await endEnrollment(pg.db, fixedB.value.id);
    }

    const history = await listEnrollmentsByStudent(pg.db, a);
    expect(history).toHaveLength(2);
    expect(history[0].classSlotId).toBe(classA.slotId);
    expect(history[0].startDate).toBe(dateA);
    expect(history[0].status).toBe("ATIVA");
    expect(history[0].endDate).toBeNull();
    expect(history[1].classSlotId).toBe(classB.slotId);
    expect(history[1].startDate).toBe(dateB);
    expect(history[1].status).toBe("INATIVA");

    const empty = await listEnrollmentsByStudent(pg.db, lonely);
    expect(empty).toHaveLength(0);
  });
});
