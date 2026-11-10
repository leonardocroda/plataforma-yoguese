import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, classSessions, credits, holidays } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio } from "../../domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { createBooking } from "../../../bookings/services/bookings";
import { createEnrollment } from "../../../students/services/enrollments";
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

  it("a holiday and a closure on the same date block one single occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 1);

    const holiday = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(holiday.ok).toBe(true);
    const closure = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: date,
      reason: "Recesso de Inverno",
    });
    expect(closure.ok).toBe(true);

    const occurrence = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(occurrence.ok).toBe(true);
    if (occurrence.ok) {
      expect(occurrence.value.status).toBe("BLOQUEADA");
    }

    // Uma ocorrencia so para a data, mesmo com os dois bloqueios
    const again = await materializeSession(pg.db, { classSlotId: slotId, date });
    expect(again.ok).toBe(true);
    if (again.ok && occurrence.ok) {
      expect(again.value.id).toBe(occurrence.value.id);
    }
    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("BLOQUEADA");

    // E a ocorrencia bloqueada recusa reserva
    const booking = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(booking.ok).toBe(false);
    if (!booking.ok) {
      expect(booking.error).toContain("bloqueada");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
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

  it("blocks the existing occurrences when the holiday is created (FER-01)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);

    // A ocorrencia ja existe AGENDADA com reserva antes do cadastro
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(materialized.ok).toBe(true);
    const booked = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "FIXED",
    });
    expect(booked.ok).toBe(true);

    const created = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(created.ok).toBe(true);

    // Efeito imediato: sem nova leitura, a ocorrencia ja esta BLOQUEADA e a
    // reserva ativa foi cancelada
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("BLOQUEADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.value!.id));
    expect(booking.status).toBe("CANCELADA");

    // Data passada: o cadastro e aceito como registro e nao altera nada
    const pastDate = "2026-01-06"; // terca-feira no passado
    await pg.db.insert(classSessions).values({
      classSlotId: slotId,
      sessionDate: pastDate,
      status: "AGENDADA",
    });
    const past = await createHoliday(pg.db, { date: pastDate, name: "Registro antigo" });
    expect(past.ok).toBe(true);
    const [pastSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, pastDate));
    expect(pastSession.status).toBe("AGENDADA");
  });

  it("blocks every date of the closure range when the closure is created (FER-02)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const startDate = nextOccurrence({ weekday: 3 }, today);
    const middleDate = addDays(startDate, 7);
    const endDate = addDays(startDate, 14);
    const [student] = await createStudents(pg.db, 1);

    for (const date of [startDate, middleDate, endDate]) {
      const materialized = await materializeSession(pg.db, {
        classSlotId: slotId,
        date,
      });
      expect(materialized.ok).toBe(true);
    }
    const booked = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date: middleDate,
      type: "FIXED",
    });
    expect(booked.ok).toBe(true);

    const created = await createStudioClosure(pg.db, {
      startDate,
      endDate,
      reason: "Recesso de Inverno",
    });
    expect(created.ok).toBe(true);

    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.status === "BLOQUEADA")).toBe(true);
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.value!.id));
    expect(booking.status).toBe("CANCELADA");
  });

  it("creates no credit when a block is registered (FER-05, PRD 15)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 2);

    // Fixo com vinculo ativo na data + reposicao de outro aluno com credito
    const enrolled = await createEnrollment(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      startDate: today,
    });
    expect(enrolled.ok).toBe(true);
    const creditId = await grantTestCredit(pg.db, students[1]);
    const booked = await createBooking(pg.db, {
      studentId: students[1],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId,
    });
    expect(booked.ok).toBe(true);

    const created = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(created.ok).toBe(true);

    // Nenhuma linha de credito nova: o fixo nao recebe credito (PRD 7.1) e
    // o credito da reposicao e o mesmo, devolvido a DISPONIVEL
    const creditsAfter = await pg.db.select().from(credits);
    expect(creditsAfter).toHaveLength(1);
    expect(creditsAfter[0].id).toBe(creditId);
    expect(creditsAfter[0].status).toBe("DISPONIVEL");
    const fixedStudentCredits = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.studentId, students[0]));
    expect(fixedStudentCredits).toHaveLength(0);
  });
});
