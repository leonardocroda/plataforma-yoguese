import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookings,
  classSessions,
  classSlots,
  classTypes,
  fixedEnrollments,
  holidays,
  studioClosures,
  users,
} from "../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../test/fixtures";
import {
  authTestState,
  nextHeadersMock,
  resetAuthTestState,
  TEST_AUTH_SECRET,
} from "../../../test/auth";
import { PostgresTestInstance, startPostgres } from "../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio } from "../domain/occurrences";
import { materializeSession } from "../../bookings/services/sessions";
import { setSessionCookie } from "../../auth/services/session";
import {
  createBookingAction,
  createClassTypeAction,
  createEnrollmentAction,
  createHolidayAction,
  createSlotAction,
  createStudioClosureAction,
  deactivateClassTypeAction,
  deactivateSlotAction,
  deleteHolidayAction,
  deleteStudioClosureAction,
  endEnrollmentAction,
  updateHolidayAction,
  updateStudioClosureAction,
} from "../actions";

// AUTH-01 nas actions admin: toda action exige sessao de ADMIN no servidor.
// O cookie passa pelo mock de next/headers (src/test/auth.ts).

vi.mock("next/headers", () => nextHeadersMock());

describe("admin actions", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
    // As actions usam o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    resetAuthTestState();
    // A admin logada da sessao para os testes de action
    const [admin] = await pg.db
      .insert(users)
      .values({
        name: "Ana Admin",
        email: `admin-${Math.random().toString(16).slice(2, 10)}@yoguese.com`,
        passwordHash: "hash-de-teste",
        role: "ADMIN",
      })
      .returning();
    await setSessionCookie({ id: admin.id, role: "ADMIN" });
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    const { db } = await import("../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
    await pg.pool.end();
    await pg.container.stop();
  });

  it("creates a class type and a slot through the actions", async () => {
    const classType = await createClassTypeAction({ name: "Superioga Fluide" });
    expect(classType.ok).toBe(true);
    if (!classType.ok) return;
    expect(classType.value.name).toBe("Superioga Fluide");
    expect(classType.value.status).toBe("ATIVA");

    const slot = await createSlotAction({
      classTypeId: classType.value.id,
      weekday: 3,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(slot.ok).toBe(true);
    if (slot.ok) {
      expect(slot.value.classTypeId).toBe(classType.value.id);
      expect(slot.value.weekday).toBe(3);
      expect(slot.value.startTime).toBe("19:00:00");
      expect(slot.value.endTime).toBe("20:00:00");
      expect(slot.value.capacity).toBe(8);
      expect(slot.value.status).toBe("ATIVA");
    }

    const [storedSlot] = await pg.db.select().from(classSlots);
    expect(storedSlot.classTypeId).toBe(classType.value.id);
    expect(storedSlot.status).toBe("ATIVA");
    expect(storedSlot.weekday).toBe(3);
    expect(storedSlot.startTime).toBe("19:00:00");
    expect(storedSlot.endTime).toBe("20:00:00");
    expect(storedSlot.capacity).toBe(8);

    const [storedType] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.name, classType.value.name));
    expect(storedType.name).toBe("Superioga Fluide");
    expect(storedType.status).toBe("ATIVA");
  });

  it("propagates the slot validation error to the caller", async () => {
    const { classTypeId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const invalid = await createSlotAction({
      classTypeId,
      weekday: 3,
      startTime: "20:00:00",
      endTime: "19:00:00",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.field).toBe("endTime");
      expect(invalid.error).toContain("endTime");
    }

    // A recusa nao gravou nada: segue apenas a turma do fixture
    const slots = await pg.db.select().from(classSlots);
    expect(slots).toHaveLength(1);
    expect(slots[0].weekday).toBe(3);
  });

  it("deactivates a class type and a slot through the actions", async () => {
    const classType = await createClassTypeAction({ name: "Superioga Leve" });
    expect(classType.ok).toBe(true);
    if (!classType.ok) return;

    const deactivatedType = await deactivateClassTypeAction(classType.value.id);
    expect(deactivatedType.ok).toBe(true);
    if (deactivatedType.ok) {
      expect(deactivatedType.value.status).toBe("INATIVA");
    }

    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const deactivatedSlot = await deactivateSlotAction(slotId);
    expect(deactivatedSlot.ok).toBe(true);
    if (deactivatedSlot.ok) {
      expect(deactivatedSlot.value.status).toBe("INATIVA");
    }

    const [storedSlot] = await pg.db
      .select()
      .from(classSlots)
      .where(eq(classSlots.id, slotId));
    expect(storedSlot.status).toBe("INATIVA");
  });

  it("creates a manual booking through the action", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);

    const booking = await createBookingAction({
      studentId: student,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, student),
    });
    expect(booking.ok).toBe(true);
    if (booking.ok) {
      expect(booking.value.studentId).toBe(student);
      expect(booking.value.bookingType).toBe("MAKEUP");
      expect(booking.value.status).toBe("ATIVA");
      expect(booking.value.classSessionId).toBeTruthy();
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(eq(bookings.status, "ATIVA"));
    expect(Number(total?.total)).toBe(1);
  });

  it("propagates the no-vacancy error from the booking action", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 1 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const students = await createStudents(pg.db, 2);

    const first = await createBookingAction({
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(first.ok).toBe(true);

    const second = await createBookingAction({
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

    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(1);
  });

  it("creates and ends a fixed enrollment through the actions", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const startDate = nextOccurrence({ weekday: 3 }, today);
    const [student] = await createStudents(pg.db, 1);

    const enrollment = await createEnrollmentAction({
      studentId: student,
      classSlotId: slotId,
      startDate,
    });
    expect(enrollment.ok).toBe(true);
    if (enrollment.ok) {
      expect(enrollment.value.studentId).toBe(student);
      expect(enrollment.value.classSlotId).toBe(slotId);
      expect(enrollment.value.startDate).toBe(startDate);
      expect(enrollment.value.status).toBe("ATIVA");
    }

    const ended = await endEnrollmentAction(
      enrollment.ok ? enrollment.value.id : "",
    );
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.status).toBe("INATIVA");
    }

    const [stored] = await pg.db
      .select()
      .from(fixedEnrollments)
      .where(eq(fixedEnrollments.id, enrollment.ok ? enrollment.value.id : ""));
    expect(stored.status).toBe("INATIVA");
  });

  it("creates a holiday from the block action and returns the outcome (FER-17)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    await materializeSession(pg.db, { classSlotId: slotId, date });

    const created = await createHolidayAction({ date, name: "Feriado Municipal" });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.date).toBe(date);
      expect(created.value.name).toBe("Feriado Municipal");
    }

    // Efeito imediato pela action: a ocorrencia existente fica BLOQUEADA
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("BLOQUEADA");
  });

  it("refuses a holiday on a duplicated date (FER-18)", async () => {
    const date = nextOccurrence({ weekday: 3 }, today);

    const first = await createHolidayAction({ date, name: "Primeiro" });
    expect(first.ok).toBe(true);

    const second = await createHolidayAction({ date, name: "Repetido" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("feriado");
      expect(second.field).toBe("date");
    }
    const rows = await pg.db.select().from(holidays);
    expect(rows).toHaveLength(1);
  });

  it("edits a holiday from the block action and reprocesses the blocks (FER-19)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const oldDate = nextOccurrence({ weekday: 3 }, today);
    const newDate = addDays(oldDate, 7);

    const created = await createHolidayAction({ date: oldDate, name: "Feriado" });
    if (!created.ok) throw new Error(created.error);
    for (const date of [oldDate, newDate]) {
      await materializeSession(pg.db, { classSlotId: slotId, date });
    }

    const edited = await updateHolidayAction({
      id: created.value.id,
      date: newDate,
      name: "Feriado Corrigido",
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.value.date).toBe(newDate);
      expect(edited.value.name).toBe("Feriado Corrigido");
    }

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

  it("creates a studio closure from the block action and returns the outcome (FER-21)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const startDate = nextOccurrence({ weekday: 3 }, today);
    const endDate = addDays(startDate, 7);
    for (const date of [startDate, endDate]) {
      await materializeSession(pg.db, { classSlotId: slotId, date });
    }

    const created = await createStudioClosureAction({
      startDate,
      endDate,
      reason: "Recesso de Inverno",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.startDate).toBe(startDate);
      expect(created.value.endDate).toBe(endDate);
      expect(created.value.reason).toBe("Recesso de Inverno");
    }

    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.status === "BLOQUEADA")).toBe(true);
  });

  it("refuses a closure with an end before the start (FER-22)", async () => {
    const startDate = nextOccurrence({ weekday: 3 }, today);

    const created = await createStudioClosureAction({
      startDate: addDays(startDate, 7),
      endDate: startDate,
      reason: "Invalido",
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error).toContain("fim do recesso");
      expect(created.field).toBe("endDate");
    }
    const rows = await pg.db.select().from(studioClosures);
    expect(rows).toHaveLength(0);
  });

  it("edits a studio closure from the block action and reprocesses the blocks (FER-23)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const startDate = nextOccurrence({ weekday: 3 }, today);
    const endDate = addDays(startDate, 7);

    const created = await createStudioClosureAction({
      startDate,
      endDate,
      reason: "Recesso",
    });
    if (!created.ok) throw new Error(created.error);
    for (const date of [startDate, endDate]) {
      await materializeSession(pg.db, { classSlotId: slotId, date });
    }

    const edited = await updateStudioClosureAction({
      id: created.value.id,
      startDate,
      endDate: startDate,
      reason: "Recesso encurtado",
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.value.endDate).toBe(startDate);
      expect(edited.value.reason).toBe("Recesso encurtado");
    }

    const [startSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, startDate));
    expect(startSession.status).toBe("BLOQUEADA");
    const [endSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, endDate));
    expect(endSession.status).toBe("AGENDADA");
  });

  it("deletes a holiday from the block action and unblocks the occurrences (FER-24)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createHolidayAction({ date, name: "Feriado" });
    if (!created.ok) throw new Error(created.error);
    await materializeSession(pg.db, { classSlotId: slotId, date });

    const deleted = await deleteHolidayAction(created.value.id);
    expect(deleted.ok).toBe(true);

    const rows = await pg.db.select().from(holidays);
    expect(rows).toHaveLength(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("AGENDADA");
  });

  it("deletes a studio closure from the block action and unblocks the occurrences (FER-25)", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const created = await createStudioClosureAction({
      startDate: date,
      endDate: date,
      reason: "Recesso",
    });
    if (!created.ok) throw new Error(created.error);
    await materializeSession(pg.db, { classSlotId: slotId, date });

    const deleted = await deleteStudioClosureAction(created.value.id);
    expect(deleted.ok).toBe(true);

    const rows = await pg.db.select().from(studioClosures);
    expect(rows).toHaveLength(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, date));
    expect(session.status).toBe("AGENDADA");
  });

  it("recusa action sem sessao com redirect ao login (AUTH-01)", async () => {
    // Sem cookie: o guard manda para o login antes de tocar o banco
    authTestState.jar.clear();

    const error = await createClassTypeAction({
      name: "Superioga Sem Sessao",
    }).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as { digest?: string }).digest ?? "").toContain("/login");

    // Nada foi gravado: a recusa vem antes do servico
    const rows = await pg.db.select().from(classTypes);
    expect(rows).toHaveLength(0);
  });
});

// Segredo do ambiente de teste: setSessionCookie assina com ele
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
