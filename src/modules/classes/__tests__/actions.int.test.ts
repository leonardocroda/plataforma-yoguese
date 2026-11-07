import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookings,
  classSlots,
  classTypes,
  fixedEnrollments,
} from "../../../db/schema";
import { createStudents, createTestClass, clearTables } from "../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../domain/occurrences";
import {
  createBookingAction,
  createClassTypeAction,
  createEnrollmentAction,
  createSlotAction,
  deactivateClassTypeAction,
  deactivateSlotAction,
  endEnrollmentAction,
} from "../actions";

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
    });
    expect(first.ok).toBe(true);

    const second = await createBookingAction({
      studentId: students[1],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
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
});
