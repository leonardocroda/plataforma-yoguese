import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, classSessions, credits, holidays, studioClosures } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio } from "../../domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { createBooking } from "../../../bookings/services/bookings";
import { createEnrollment } from "../../../students/services/enrollments";
import { createHoliday, createStudioClosure, updateHoliday, deleteHoliday, updateStudioClosure, deleteStudioClosure, listHolidays, listStudioClosures } from "../blocks";

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

  it("moves the block when the holiday is edited (FER-19)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const oldDate = nextOccurrence({ weekday: 3 }, today);
    const newDate = addDays(oldDate, 7);

    const created = await createHoliday(pg.db, { date: oldDate, name: "Feriado" });
    if (!created.ok) throw new Error(created.error);
    for (const date of [oldDate, newDate]) {
      const materialized = await materializeSession(pg.db, {
        classSlotId: slotId,
        date,
      });
      expect(materialized.ok).toBe(true);
    }

    const edited = await updateHoliday(pg.db, {
      id: created.value.id,
      date: newDate,
      name: "Feriado Corrigido",
    });
    expect(edited.ok).toBe(true);

    // A data antiga desbloqueia e a nova bloqueia na mesma operacao
    const [oldSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, oldDate));
    expect(oldSession.status).toBe("AGENDADA");
    const [newSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, newDate));
    expect(newSession.status).toBe("BLOQUEADA");
  });

  it("refuses to edit a holiday onto another holiday date (FER-20)", async () => {
    const firstDate = nextOccurrence({ weekday: 3 }, today);
    const secondDate = addDays(firstDate, 7);

    const first = await createHoliday(pg.db, { date: firstDate, name: "Primeiro" });
    const second = await createHoliday(pg.db, { date: secondDate, name: "Segundo" });
    if (!first.ok || !second.ok) throw new Error("fixture falhou");

    const edited = await updateHoliday(pg.db, {
      id: first.value.id,
      date: secondDate,
      name: "Colisao",
    });
    expect(edited.ok).toBe(false);
    if (!edited.ok) {
      expect(edited.error).toContain("feriado");
      expect(edited.field).toBe("date");
    }

    // Nada mudou
    const rows = await pg.db.select().from(holidays);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === first.value.id)?.name).toBe("Primeiro");
  });

  it("unblocks the occurrences when the holiday is deleted (FER-10)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createHoliday(pg.db, { date, name: "Feriado" });
    if (!created.ok) throw new Error(created.error);
    await materializeSession(pg.db, { classSlotId: slotId, date });

    const deleted = await deleteHoliday(pg.db, { id: created.value.id });
    expect(deleted.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("AGENDADA");
  });

  it("blocks new dates and releases removed dates when the closure is edited (FER-11, FER-23)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const firstDate = nextOccurrence({ weekday: 3 }, today);
    const secondDate = addDays(firstDate, 7);
    const thirdDate = addDays(firstDate, 14);

    const created = await createStudioClosure(pg.db, {
      startDate: firstDate,
      endDate: thirdDate,
      reason: "Recesso",
    });
    if (!created.ok) throw new Error(created.error);
    for (const date of [firstDate, secondDate, thirdDate]) {
      const materialized = await materializeSession(pg.db, {
        classSlotId: slotId,
        date,
      });
      expect(materialized.ok).toBe(true);
    }
    let sessions = await pg.db.select().from(classSessions);
    expect(sessions.every((session) => session.status === "BLOQUEADA")).toBe(true);

    // Encurtado para o primeiro dia: as datas que sairam voltam
    const shrunk = await updateStudioClosure(pg.db, {
      id: created.value.id,
      startDate: firstDate,
      endDate: firstDate,
      reason: "Recesso encurtado",
    });
    expect(shrunk.ok).toBe(true);
    const byDate = (date: string) =>
      pg.db.select().from(classSessions).where(eq(classSessions.sessionDate, date));
    expect((await byDate(firstDate))[0].status).toBe("BLOQUEADA");
    expect((await byDate(secondDate))[0].status).toBe("AGENDADA");
    expect((await byDate(thirdDate))[0].status).toBe("AGENDADA");

    // Estendido ate o segundo dia: a data que entrou bloqueia de novo
    const extended = await updateStudioClosure(pg.db, {
      id: created.value.id,
      startDate: firstDate,
      endDate: secondDate,
      reason: "Recesso estendido",
    });
    expect(extended.ok).toBe(true);
    expect((await byDate(secondDate))[0].status).toBe("BLOQUEADA");
    expect((await byDate(thirdDate))[0].status).toBe("AGENDADA");
  });

  it("unblocks the occurrences when the closure is deleted (FER-11)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: date,
      reason: "Recesso",
    });
    if (!created.ok) throw new Error(created.error);
    await materializeSession(pg.db, { classSlotId: slotId, date });

    const deleted = await deleteStudioClosure(pg.db, { id: created.value.id });
    expect(deleted.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("AGENDADA");
  });

  it("keeps the occurrence blocked when one of two overlapping blocks is removed (FER-12)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const holiday = await createHoliday(pg.db, { date, name: "Feriado" });
    const closure = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: date,
      reason: "Recesso sobreposto",
    });
    if (!holiday.ok || !closure.ok) throw new Error("fixture falhou");
    await materializeSession(pg.db, { classSlotId: slotId, date });

    // Removido o feriado, o recesso mantem a ocorrencia bloqueada
    const removedHoliday = await deleteHoliday(pg.db, { id: holiday.value.id });
    expect(removedHoliday.ok).toBe(true);
    let [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("BLOQUEADA");

    // Removido o recesso, nenhum bloqueio cobre mais a data
    const removedClosure = await deleteStudioClosure(pg.db, { id: closure.value.id });
    expect(removedClosure.ok).toBe(true);
    [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("AGENDADA");
  });

  it("refuses a closure whose end is before its start (FER-22)", async () => {
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createStudioClosure(pg.db, {
      startDate: addDays(date, 7),
      endDate: date,
      reason: "Periodo invalido",
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error).toContain("fim do recesso");
      expect(created.field).toBe("endDate");
    }
    const rows = await pg.db.select().from(studioClosures);
    expect(rows).toHaveLength(0);

    // A recusa vale tambem na edicao
    const valid = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: addDays(date, 7),
      reason: "Recesso",
    });
    if (!valid.ok) throw new Error(valid.error);
    const edited = await updateStudioClosure(pg.db, {
      id: valid.value.id,
      startDate: addDays(date, 14),
      endDate: date,
      reason: "Edicao invalida",
    });
    expect(edited.ok).toBe(false);
    if (!edited.ok) {
      expect(edited.error).toContain("fim do recesso");
      expect(edited.field).toBe("endDate");
    }
  });

  it("lists holidays and studio closures (FER-16)", async () => {
    const firstDate = nextOccurrence({ weekday: 3 }, today);
    const secondDate = addDays(firstDate, 14);

    await createStudioClosure(pg.db, {
      startDate: secondDate,
      endDate: addDays(secondDate, 3),
      reason: "Recesso de julho",
    });
    await createStudioClosure(pg.db, {
      startDate: firstDate,
      endDate: addDays(firstDate, 1),
      reason: "Recesso de inverno",
    });
    await createHoliday(pg.db, { date: secondDate, name: "Natal" });
    await createHoliday(pg.db, { date: firstDate, name: "Ano Novo" });

    const holidaysList = await listHolidays(pg.db);
    expect(holidaysList.map((holiday) => holiday.name)).toEqual([
      "Ano Novo",
      "Natal",
    ]);

    const closures = await listStudioClosures(pg.db);
    expect(closures.map((closure) => closure.reason)).toEqual([
      "Recesso de inverno",
      "Recesso de julho",
    ]);
  });
});
