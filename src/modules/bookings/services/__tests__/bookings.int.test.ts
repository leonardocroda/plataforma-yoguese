import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookings,
  classSessions,
  holidays,
} from "../../../../db/schema";
import { createStudents, createTestClass, clearTables } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { createEnrollment } from "../../../students/services/enrollments";
import { deactivateSlot } from "../../../classes/services/classes";
import { getComposition } from "../composition";
import { materializeSession } from "../sessions";
import { createBooking, BookingInput } from "../bookings";

describe("bookings", () => {
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

  async function setup(
    extra: Partial<BookingInput> = {},
  ): Promise<{ slotId: string; date: string; students: string[] }> {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today); // terca futura
    const students = await createStudents(pg.db, 1);
    return { slotId, date, students, ...extra };
  }

  async function book(
    input: { slotId: string; date: string; students: string[] },
    studentIndex = 0,
    type: BookingInput["type"] = "MAKEUP",
  ) {
    return createBooking(pg.db, {
      studentId: input.students[studentIndex],
      classSlotId: input.slotId,
      date: input.date,
      type,
    });
  }

  it("confirms when a spot is available", async () => {
    const input = await setup();

    const result = await book(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.studentId).toBe(input.students[0]);
      expect(result.value.classSessionId).toBeTruthy();
      expect(result.value.bookingType).toBe("MAKEUP");
      expect(result.value.status).toBe("ATIVA");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(and(eq(bookings.status, "ATIVA")));
    expect(Number(total?.total)).toBe(1);
  });

  it("rejects when full with a clear message and no partial state", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 1 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 2);

    const first = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(first.ok).toBe(true);

    const second = await createBooking(pg.db, {
      studentId: students[1],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("sem vaga");
    }

    // Nenhum estado parcial: a recusa nao gravou nada
    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(1);
  });

  it("concurrency on the last spot confirms one", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 1 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 8);

    const attempts = await Promise.allSettled(
      students.map((studentId) =>
        createBooking(pg.db, { studentId, classSlotId: slotId, date, type: "MAKEUP" }),
      ),
    );

    // Nenhuma falha de infraestrutura: todas terminam com resultado de negocio
    expect(attempts.every((t) => t.status === "fulfilled")).toBe(true);
    const results = attempts.map(
      (t) => t.status === "fulfilled" ? t.value : { ok: false, error: String(t.reason) },
    );
    const confirmed = results.filter((r) => r.ok);
    const rejected = results.filter(
      (r): r is { ok: false; error: string; field?: string } => !r.ok,
    );

    // Teste do PRD secao 15: N concorrentes na ultima vaga -> exatamente 1
    expect(confirmed).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const rejection of rejected) {
      expect(rejection.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(eq(bookings.status, "ATIVA"));
    expect(Number(total?.total)).toBe(1);
  });

  it("rejects a duplicate in the same session", async () => {
    const input = await setup();

    const first = await book(input);
    expect(first.ok).toBe(true);

    const second = await book(input);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("reserva ativa");
    }

    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(1);
  });

  it("counts a fixed student once and refuses the duplicate booking", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);

    const enrollment = await createEnrollment(pg.db, {
      studentId: student,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    // O mesmo aluno nao e reserva na ocorrencia em que ja e fixo
    const booking = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(booking.ok).toBe(false);
    if (!booking.ok) {
      expect(booking.error).toContain("fixo");
      expect(booking.field).toBe("studentId");
    }

    const reading = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.fixedCount).toBe(1);
      expect(reading.value.makeupCount).toBe(0);
      expect(reading.value.total).toBe(1);
      expect(reading.value.availableSpots).toBe(7);
    }

    // Mesmo com uma reserva gravada fora do servico, o aluno conta uma vez
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    await pg.db.insert(bookings).values({
      studentId: student,
      classSessionId: session.id,
      bookingType: "MAKEUP",
      status: "ATIVA",
    });

    const after = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value.fixedCount).toBe(1);
      expect(after.value.makeupCount).toBe(0);
      expect(after.value.total).toBe(1);
      expect(after.value.availableSpots).toBe(7);
    }
  });

  it("second class on the same day with admin", async () => {
    // AD-011: o admin pode marcar o mesmo aluno em outra turma no mesmo dia
    const first = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 1);
    const second = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const a = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: first.slotId,
      date,
      type: "FIXED",
    });
    expect(a.ok).toBe(true);

    const b = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: second.slotId,
      date,
      type: "FIXED",
    });
    expect(b.ok).toBe(true);

    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(2);
  });

  it("rejects a past date", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 1);

    const result = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date: "2024-01-02", // terca passada
      type: "FIXED",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("data passada");
      expect(result.field).toBe("date");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("rejects a booking in a blocked occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 1);
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });

    const result = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("bloqueada");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("refuses a booking on an occurrence of an inactive class", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 1);

    // A ocorrencia ja materializada continua no banco
    const occurrence = await materializeSession(pg.db, { classSlotId: slotId, date });
    expect(occurrence.ok).toBe(true);

    const deactivated = await deactivateSlot(pg.db, slotId);
    expect(deactivated.ok).toBe(true);

    const result = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("inativa");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("refuses a booking on a date outside the class weekday", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 4 }, today); // quarta numa turma de terca
    const students = await createStudents(pg.db, 1);

    const result = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("dia da semana");
      expect(result.field).toBe("date");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("records audit data", async () => {
    const input = await setup();

    const result = await book(input, 0, "EXPERIMENTAL");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const record = result.value;
      expect(record.id).toBeTruthy();
      expect(record.studentId).toBe(input.students[0]);
      expect(record.classSessionId).toBeTruthy();
      expect(record.bookingType).toBe("EXPERIMENTAL");
      expect(record.status).toBe("ATIVA");
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    }
  });
});
