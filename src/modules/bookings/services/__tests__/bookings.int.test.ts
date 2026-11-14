import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookings,
  classSessions,
  credits,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  todayInStudio,
  nextOccurrence,
} from "../../../classes/domain/occurrences";
import { grantCredit } from "../../../credits/services/credits";
import { createEnrollment } from "../../../students/services/enrollments";
import { deactivateSlot } from "../../../classes/services/classes";
import { getComposition } from "../composition";
import { materializeSession } from "../sessions";
import { createBooking, BookingInput } from "../bookings";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    // A reposicao exige credito: o setup concede um antes de reservar
    const creditId =
      type === "MAKEUP"
        ? await grantTestCredit(pg.db, input.students[studentIndex])
        : undefined;
    return createBooking(pg.db, {
      studentId: input.students[studentIndex],
      classSlotId: input.slotId,
      date: input.date,
      type,
      creditId,
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
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(first.ok).toBe(true);

    const second = await createBooking(pg.db, {
      studentId: students[1],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[1]),
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
      students.map(async (studentId) =>
        createBooking(pg.db, {
          studentId,
          classSlotId: slotId,
          date,
          type: "MAKEUP",
          creditId: await grantTestCredit(pg.db, studentId),
        }),
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

  it("a class with eight bookings refuses the ninth", async () => {
    // Teste de aceitacao do PRD: "Turma com 8 reservas nao permite uma nona"
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 9);

    for (const studentId of students.slice(0, 8)) {
      const booking = await createBooking(pg.db, {
        studentId,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId: await grantTestCredit(pg.db, studentId),
      });
      expect(booking.ok).toBe(true);
    }

    const ninth = await createBooking(pg.db, {
      studentId: students[8],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[8]),
    });
    expect(ninth.ok).toBe(false);
    if (!ninth.ok) {
      expect(ninth.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(eq(bookings.status, "ATIVA"));
    expect(Number(total?.total)).toBe(8);
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
      creditId: await grantTestCredit(pg.db, student),
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

  it("refuses a booking on a cancelled occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) return;

    await pg.db
      .update(classSessions)
      .set({ status: "CANCELADA" })
      .where(eq(classSessions.id, materialized.value.id));

    const result = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("cancelada");
    }
    const createdBookings = await pg.db.select().from(bookings);
    expect(createdBookings).toHaveLength(0);
    const [storedCredit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(storedCredit.status).toBe("DISPONIVEL");
    expect(storedCredit.usedBookingId).toBeNull();
  });

  it("rejects a booking in an occurrence blocked by holiday or closure", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 2);

    // A mesma data com feriado e com recesso: uma ocorrencia so, bloqueada
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    await pg.db.insert(studioClosures).values({
      startDate: date,
      endDate: date,
      reason: "Recesso Teste",
    });

    const blocked = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain("bloqueada");
    }

    // Recesso sozinho tambem bloqueia a ocorrencia e recusa a reserva
    const closureDate = nextOccurrence({ weekday: 3 }, addDays(date, 1));
    await pg.db.insert(studioClosures).values({
      startDate: closureDate,
      endDate: addDays(closureDate, 7),
      reason: "Recesso de Inverno",
    });

    const closed = await createBooking(pg.db, {
      studentId: students[1],
      classSlotId: slotId,
      date: closureDate,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[1]),
    });
    expect(closed.ok).toBe(false);
    if (!closed.ok) {
      expect(closed.error).toContain("bloqueada");
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
      creditId: await grantTestCredit(pg.db, students[0]),
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
      creditId: await grantTestCredit(pg.db, students[0]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("dia da semana");
      expect(result.field).toBe("date");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("reserves the credit and links it to the booking", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);

    const result = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A reserva criada e do tipo MAKEUP e esta ativa na ocorrencia
    expect(result.value.bookingType).toBe("MAKEUP");
    expect(result.value.status).toBe("ATIVA");
    expect(result.value.studentId).toBe(student);
    expect(result.value.classSessionId).toBeTruthy();

    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("RESERVADO");
    expect(credit.usedBookingId).toBe(result.value.id);

    // O mesmo credito nao serve para uma segunda reserva, nem em outra turma
    const other = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const second = await createBooking(pg.db, {
      studentId: student,
      classSlotId: other.slotId,
      date,
      type: "MAKEUP",
      creditId,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("credito");
    }
  });

  it("requires a valid credit for a makeup booking", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student, other] = await createStudents(pg.db, 2);

    // Sem credito: a reserva e recusada
    const withoutCredit = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(withoutCredit.ok).toBe(false);
    if (!withoutCredit.ok) {
      expect(withoutCredit.error).toContain("credito");
      expect(withoutCredit.field).toBe("creditId");
    }

    // Credito de outro aluno: recusado
    const foreign = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, other),
    });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error).toContain("outro aluno");
    }

    // Credito vencido: recusado
    const expired = await grantCredit(pg.db, {
      studentId: student,
      source: "CONCESSAO_MANUAL",
      reason: "Credito vencido",
      adminLabel: "testes",
      generatedAt: new Date(Date.now() - 40 * DAY_MS),
    });
    expect(expired.ok).toBe(true);
    if (expired.ok) {
      const withExpired = await createBooking(pg.db, {
        studentId: student,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId: expired.value.credit.id,
      });
      expect(withExpired.ok).toBe(false);
      if (!withExpired.ok) {
        expect(withExpired.error).toContain("vencido");
      }
    }

    // Nenhuma reserva foi criada
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
