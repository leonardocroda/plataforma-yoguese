import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  classDateBlocks,
  classSessions,
  classSlots,
  credits,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio, weekdayOf } from "../../domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { createBooking } from "../../../bookings/services/bookings";
import { reconcileBlockedOccurrences } from "../../../bookings/services/blocks";
import { cancelOccurrenceByStudio } from "../../../credits/services/cancellations";
import { grantCredit } from "../../../credits/services/credits";
import { createEnrollment } from "../../../students/services/enrollments";
import {
  blockClassSlotDate,
  createHoliday,
  createStudioClosure,
  deleteHoliday,
  deleteStudioClosure,
  listClassDateBlocks,
  listHolidays,
  listStudioClosures,
  unblockClassSlotDate,
  updateHoliday,
  updateStudioClosure,
} from "../blocks";

const BLOCK_NOW = new Date("2026-11-14T15:00:00.000Z");
const BLOCK_TODAY = todayInStudio(BLOCK_NOW);

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
    const date2 = addDays(date, 7);
    const students = await createStudents(pg.db, 3);

    // Fixo com vinculo ativo + reposicao com credito reservado (feriado) e
    // experimental sem credito (recesso)
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
    const experimental = await createBooking(pg.db, {
      studentId: students[2],
      classSlotId: slotId,
      date: date2,
      type: "EXPERIMENTAL",
    });
    expect(experimental.ok).toBe(true);

    // O feriado bloqueia a primeira ocorrencia: nenhum credito novo
    const created = await createHoliday(pg.db, { date, name: "Feriado Municipal" });
    expect(created.ok).toBe(true);

    const creditsAfterHoliday = await pg.db.select().from(credits);
    expect(creditsAfterHoliday).toHaveLength(1);
    expect(creditsAfterHoliday[0].id).toBe(creditId);
    expect(creditsAfterHoliday[0].status).toBe("DISPONIVEL");
    const fixedStudentCredits = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.studentId, students[0]));
    expect(fixedStudentCredits).toHaveLength(0);

    // O recesso bloqueia a segunda ocorrencia: tambem nenhum credito
    // (PRD 7.2), e a experimental e cancelada sem credito
    const closure = await createStudioClosure(pg.db, {
      startDate: date2,
      endDate: date2,
      reason: "Recesso Teste",
    });
    expect(closure.ok).toBe(true);

    const creditsAfterClosure = await pg.db.select().from(credits);
    expect(creditsAfterClosure).toHaveLength(1);
    expect(creditsAfterClosure[0].id).toBe(creditId);
    const experimentalStudentCredits = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.studentId, students[2]));
    expect(experimentalStudentCredits).toHaveLength(0);
    const [experimentalBooking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, experimental.value!.id));
    expect(experimentalBooking.status).toBe("CANCELADA");
    expect(experimentalBooking.bookingType).toBe("EXPERIMENTAL");
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
    const sessions = await pg.db.select().from(classSessions);
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

  it("blocks a class slot on the date without granting studio credits (CAL-18)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    const [fixedStudent, makeupStudent] = await createStudents(pg.db, 2);
    const enrollment = await createEnrollment(pg.db, {
      studentId: fixedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);
    const materialized = await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(materialized.ok).toBe(true);
    const granted = await grantCredit(pg.db, {
      studentId: makeupStudent,
      source: "CONCESSAO_MANUAL",
      reason: "Credito de teste",
      adminLabel: "testes",
      generatedAt: BLOCK_NOW,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;
    const [creditBefore] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    const booked = await createBooking(
      pg.db,
      {
        studentId: makeupStudent,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId,
      },
      BLOCK_NOW,
    );
    expect(booked.ok).toBe(true);

    const blocked = await blockClassSlotDate(
      pg.db,
      {
        classSlotId: slotId,
        date,
        reason: "Professora ausente",
      },
      BLOCK_NOW,
    );

    expect(blocked.ok).toBe(true);
    if (blocked.ok) {
      expect(blocked.value.classSlotId).toBe(slotId);
      expect(blocked.value.sessionDate).toBe(date);
      expect(blocked.value.reason).toBe("Professora ausente");
    }
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("BLOQUEADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.ok ? booked.value.id : ""));
    expect(booking.status).toBe("CANCELADA");
    expect(booking.cancelledBy).toBe("ESTUDIO");
    const [creditAfter] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(creditAfter.status).toBe("DISPONIVEL");
    expect(creditAfter.expiresAt.getTime()).toBe(
      creditBefore.expiresAt.getTime(),
    );
    expect(creditAfter.usedBookingId).toBeNull();

    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(1);
    expect(
      storedCredits.some(
        (credit) => credit.source === "CANCELAMENTO_ESTUDIO",
      ),
    ).toBe(false);
    const fixedCredits = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.studentId, fixedStudent));
    expect(fixedCredits).toHaveLength(0);
  });

  it("unblocks the class slot without restoring cancelled bookings (CAL-19)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    const [student] = await createStudents(pg.db, 1);
    const granted = await grantCredit(pg.db, {
      studentId: student,
      source: "CONCESSAO_MANUAL",
      reason: "Credito de teste",
      adminLabel: "testes",
      generatedAt: BLOCK_NOW,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;
    await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    const booked = await createBooking(
      pg.db,
      {
        studentId: student,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId,
      },
      BLOCK_NOW,
    );
    expect(booked.ok).toBe(true);
    await blockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);

    const unblocked = await unblockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );

    expect(unblocked.ok).toBe(true);
    const blocks = await pg.db.select().from(classDateBlocks);
    expect(blocks).toHaveLength(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("AGENDADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.ok ? booked.value.id : ""));
    expect(booking.status).toBe("CANCELADA");
    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("DISPONIVEL");
  });

  it("unblocks the class slot of today without restoring cancelled bookings (CAL-19)", async () => {
    // O limite nomeado (CAL-19): hoje tambem volta a AGENDADA ao remover o
    // bloqueio e a reserva cancelada continua cancelada.
    const { slotId } = await createTestClass(pg.db, {
      weekday: weekdayOf(BLOCK_TODAY),
      capacity: 8,
    });
    const date = BLOCK_TODAY;
    const [student] = await createStudents(pg.db, 1);
    const granted = await grantCredit(pg.db, {
      studentId: student,
      source: "CONCESSAO_MANUAL",
      reason: "Credito de teste",
      adminLabel: "testes",
      generatedAt: BLOCK_NOW,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;
    await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    const booked = await createBooking(
      pg.db,
      {
        studentId: student,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId,
      },
      BLOCK_NOW,
    );
    expect(booked.ok).toBe(true);
    await blockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);

    const unblocked = await unblockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );

    expect(unblocked.ok).toBe(true);
    const blocks = await pg.db.select().from(classDateBlocks);
    expect(blocks).toHaveLength(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.sessionDate).toBe(BLOCK_TODAY);
    expect(session.status).toBe("AGENDADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.ok ? booked.value.id : ""));
    expect(booking.status).toBe("CANCELADA");
    expect(booking.cancelledBy).toBe("ESTUDIO");
    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("DISPONIVEL");
  });

  it("refuses studio cancellation while the class slot is blocked (CAL-20)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    const materialized = await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(materialized.ok).toBe(true);
    await blockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);

    const cancelled = await cancelOccurrenceByStudio(
      pg.db,
      { classSessionId: materialized.ok ? materialized.value.id : "" },
      BLOCK_NOW,
    );

    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.error).toContain("bloqueada");
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("BLOQUEADA");
    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(0);
  });

  it("keeps the occurrence blocked while any block covers the date (CAL-21)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    const materialized = await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(materialized.ok).toBe(true);
    if (materialized.ok) expect(materialized.value.status).toBe("BLOQUEADA");
    await blockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);

    await unblockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    let [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("BLOQUEADA");

    await pg.db.delete(holidays);
    await reconcileBlockedOccurrences(
      pg.db,
      { fromDate: date, toDate: date },
      BLOCK_NOW,
    );
    [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("AGENDADA");
  });

  it("keeps the occurrence blocked while a closure covers the date (CAL-21)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);

    // Recesso isolado: a ocorrencia nasce BLOQUEADA e so desbloqueia quando
    // nenhum bloqueio cobre a data
    const closure = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: date,
      reason: "Recesso Teste",
    });
    expect(closure.ok).toBe(true);
    const materialized = await materializeSession(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(materialized.ok).toBe(true);
    if (materialized.ok) expect(materialized.value.status).toBe("BLOQUEADA");
    if (closure.ok) {
      const removed = await deleteStudioClosure(pg.db, { id: closure.value.id });
      expect(removed.ok).toBe(true);
    }
    let [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("AGENDADA");

    // Recesso sobreposto a feriado e ao bloqueio da turma na mesma data:
    // enquanto qualquer um cobrir, a ocorrencia segue BLOQUEADA
    const overlapClosure = await createStudioClosure(pg.db, {
      startDate: date,
      endDate: date,
      reason: "Recesso sobreposto",
    });
    expect(overlapClosure.ok).toBe(true);
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    await reconcileBlockedOccurrences(
      pg.db,
      { fromDate: date, toDate: date },
      BLOCK_NOW,
    );
    await blockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);

    // Sem o bloqueio da turma, feriado e recesso ainda cobrem
    await unblockClassSlotDate(pg.db, { classSlotId: slotId, date }, BLOCK_NOW);
    [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("BLOQUEADA");

    // Sem o feriado, o recesso ainda cobre
    await pg.db.delete(holidays);
    await reconcileBlockedOccurrences(
      pg.db,
      { fromDate: date, toDate: date },
      BLOCK_NOW,
    );
    [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("BLOQUEADA");

    // Sem o recesso tambem, nenhum bloqueio cobre a data
    if (overlapClosure.ok) {
      await deleteStudioClosure(pg.db, { id: overlapClosure.value.id });
    }
    [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("AGENDADA");
  });

  it("records a past class block without changing past occurrences", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const [student] = await createStudents(pg.db, 1);
    const pastDate = "2026-01-07";
    const [session] = await pg.db
      .insert(classSessions)
      .values({
        classSlotId: slotId,
        sessionDate: pastDate,
        status: "AGENDADA",
      })
      .returning();
    await pg.db.insert(bookings).values({
      studentId: student,
      classSessionId: session.id,
      bookingType: "FIXED",
      status: "ATIVA",
    });

    const blocked = await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date: pastDate },
      BLOCK_NOW,
    );

    expect(blocked.ok).toBe(true);
    const blocks = await pg.db.select().from(classDateBlocks);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].sessionDate).toBe(pastDate);
    const [storedSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, session.id));
    expect(storedSession.status).toBe("AGENDADA");
    const storedBookings = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, session.id));
    expect(storedBookings[0].status).toBe("ATIVA");
  });

  it("validates the class slot and refuses a duplicate block", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    const missing = await blockClassSlotDate(
      pg.db,
      { classSlotId: "00000000-0000-0000-0000-000000000000", date },
      BLOCK_NOW,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).toContain("turma");
      expect(missing.field).toBe("classSlotId");
    }

    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, slotId));
    const inactive = await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) {
      expect(inactive.error).toContain("inativa");
      expect(inactive.field).toBe("classSlotId");
    }

    await pg.db
      .update(classSlots)
      .set({ status: "ATIVA" })
      .where(eq(classSlots.id, slotId));
    const first = await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(first.ok).toBe(true);
    const duplicate = await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      BLOCK_NOW,
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error).toContain("bloqueio");
      expect(duplicate.field).toBe("date");
    }
    const blocks = await pg.db.select().from(classDateBlocks);
    expect(blocks).toHaveLength(1);
  });

  it("lists class blocks in the requested date range", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const firstDate = nextOccurrence({ weekday: 3 }, BLOCK_TODAY);
    const secondDate = addDays(firstDate, 7);
    await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date: firstDate },
      BLOCK_NOW,
    );
    await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date: secondDate },
      BLOCK_NOW,
    );

    const listed = await listClassDateBlocks(pg.db, {
      from: firstDate,
      to: firstDate,
    });

    expect(listed).toHaveLength(1);
    expect(listed[0].classSlotId).toBe(slotId);
    expect(listed[0].sessionDate).toBe(firstDate);
  });
});
