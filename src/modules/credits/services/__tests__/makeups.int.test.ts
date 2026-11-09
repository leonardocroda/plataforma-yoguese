import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, credits } from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { hoursUntilOccurrence } from "../../domain/credit-rules";
import {
  bookMakeupByAdmin,
  bookMakeupByStudent,
  cancelMakeup,
  getMakeupEligibility,
  listMakeupTargets,
} from "../makeups";

// Reposicao (CRD-17, CRD-19 a CRD-27).

const HOUR_MS = 60 * 60 * 1000;
const START_TIME = "19:00:00";

describe("makeups", () => {
  let pg: PostgresTestInstance;
  let today: string;
  let date: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
    date = nextOccurrence({ weekday: 3 }, today);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  /** Turmas de terca com vaga, na data da ocorrencia. */
  async function createClasses(count: number, capacity = 8): Promise<string[]> {
    const slots: string[] = [];
    for (let i = 0; i < count; i++) {
      const { slotId } = await createTestClass(pg.db, {
        weekday: 3,
        capacity,
        startTime: START_TIME,
        endTime: "20:00:00",
      });
      slots.push(slotId);
    }
    return slots;
  }

  /** Instante do cancelamento: `hoursBefore` horas antes do inicio da aula. */
  function cancelInstant(occurrenceDate: string, hoursBefore: number): Date {
    const reference = new Date("2026-11-01T12:00:00Z");
    const toStart = hoursUntilOccurrence(occurrenceDate, START_TIME, reference);
    const start = new Date(
      reference.getTime() + Math.round(toStart * HOUR_MS),
    );
    return new Date(start.getTime() - hoursBefore * HOUR_MS);
  }

  it("blocks the third makeup of the week for the student self service", async () => {
    const slots = await createClasses(3);
    const [student] = await createStudents(pg.db, 1);
    const creditsGranted = await Promise.all([
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
    ]);

    const first = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slots[0],
      date,
      creditId: creditsGranted[0],
    });
    expect(first.ok).toBe(true);

    const second = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slots[1],
      date,
      creditId: creditsGranted[1],
    });
    expect(second.ok).toBe(true);

    const third = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slots[2],
      date,
      creditId: creditsGranted[2],
    });
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.error).toContain("limite");
    }

    // Duas reposicoes confirmadas e o terceiro credito intacto
    const active = await pg.db.select().from(bookings);
    expect(active).toHaveLength(2);
    const [kept] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditsGranted[2]));
    expect(kept.status).toBe("DISPONIVEL");
    expect(kept.usedBookingId).toBeNull();
  });

  it("counts only the makeups of the occurrence week", async () => {
    const slots = await createClasses(3);
    const [student] = await createStudents(pg.db, 1);
    const granted = await Promise.all([
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
    ]);

    for (const index of [0, 1]) {
      const booked = await bookMakeupByStudent(pg.db, {
        studentId: student,
        classSlotId: slots[index],
        date,
        creditId: granted[index],
      });
      expect(booked.ok).toBe(true);
    }

    // A semana da ocorrencia agenda e outra: o limite nao conta a anterior
    const nextWeek = addDays(date, 7);
    const third = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slots[2],
      date: nextWeek,
      creditId: granted[2],
    });
    expect(third.ok).toBe(true);

    const active = await pg.db.select().from(bookings);
    expect(active).toHaveLength(3);
  });

  it("lets the admin book a makeup without the weekly limit", async () => {
    const slots = await createClasses(3);
    const [student] = await createStudents(pg.db, 1);
    const granted = await Promise.all([
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
    ]);

    for (const index of [0, 1]) {
      const booked = await bookMakeupByStudent(pg.db, {
        studentId: student,
        classSlotId: slots[index],
        date,
        creditId: granted[index],
      });
      expect(booked.ok).toBe(true);
    }

    // O admin agenda a terceira reposicao da mesma semana
    const byAdmin = await bookMakeupByAdmin(pg.db, {
      studentId: student,
      classSlotId: slots[2],
      date,
      creditId: granted[2],
    });
    expect(byAdmin.ok).toBe(true);

    const active = await pg.db.select().from(bookings);
    expect(active).toHaveLength(3);
    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, granted[2]));
    expect(credit.status).toBe("RESERVADO");
  });

  it("confirms one of two concurrent bookings with the same credit", async () => {
    const slots = await createClasses(2);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);

    const attempts = await Promise.allSettled(
      slots.map((classSlotId) =>
        bookMakeupByStudent(pg.db, {
          studentId: student,
          classSlotId,
          date,
          creditId,
        }),
      ),
    );

    expect(attempts.every((attempt) => attempt.status === "fulfilled")).toBe(
      true,
    );
    const results = attempts.map((attempt) =>
      attempt.status === "fulfilled"
        ? attempt.value
        : { ok: false as const, error: String(attempt.reason) },
    );
    const confirmed = results.filter((result) => result.ok);
    expect(confirmed).toHaveLength(1);

    // O credito ficou reservado uma unica vez, ligado a reserva confirmada
    const active = await pg.db.select().from(bookings);
    expect(active).toHaveLength(1);
    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("RESERVADO");
    expect(credit.usedBookingId).toBe(active[0].id);
  });

  it("allows a makeup in any class type", async () => {
    const slots = await createClasses(2);
    const [student] = await createStudents(pg.db, 1);
    const granted = await Promise.all([
      grantTestCredit(pg.db, student),
      grantTestCredit(pg.db, student),
    ]);

    for (const index of [0, 1]) {
      const booked = await bookMakeupByStudent(pg.db, {
        studentId: student,
        classSlotId: slots[index],
        date,
        creditId: granted[index],
      });
      expect(booked.ok).toBe(true);
      if (booked.ok) {
        expect(booked.value.bookingType).toBe("MAKEUP");
        expect(booked.value.status).toBe("ATIVA");
      }
    }
  });

  it("reports eligibility and lists only classes with a free spot", async () => {
    const [withSpot] = await createClasses(1);
    const [full] = await createClasses(1, 1);
    const [student, other] = await createStudents(pg.db, 2);

    await grantTestCredit(pg.db, student);
    const occupied = await bookMakeupByStudent(pg.db, {
      studentId: other,
      classSlotId: full,
      date,
      creditId: await grantTestCredit(pg.db, other),
    });
    expect(occupied.ok).toBe(true);

    const eligibility = await getMakeupEligibility(pg.db, {
      studentId: student,
      date,
    });
    expect(eligibility.hasValidCredit).toBe(true);
    expect(eligibility.canBook).toBe(true);
    expect(eligibility.weeklyMakeups).toBe(0);
    expect(eligibility.weeklyLimit).toBe(2);
    expect(eligibility.credits).toHaveLength(1);
    expect(eligibility.reason).toBeNull();

    const targets = await listMakeupTargets(pg.db, { date });
    expect(targets.map((target) => target.classSlotId)).toEqual([withSpot]);
    expect(targets[0].availableSpots).toBe(8);
  });

  it("returns the credit to DISPONIVEL when the makeup is cancelled 24 hours ahead", async () => {
    const [slotId] = await createClasses(1);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);
    const [granted] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    const expiresAt = granted.expiresAt.toISOString();

    const booked = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      creditId,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const cancelled = await cancelMakeup(
      pg.db,
      { bookingId: booked.value.id },
      cancelInstant(date, 48),
    );
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.value.booking.status).toBe("CANCELADA");
      expect(cancelled.value.credit?.status).toBe("DISPONIVEL");
      expect(cancelled.value.credit?.expiresAt.toISOString()).toBe(expiresAt);
    }

    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("DISPONIVEL");
  });

  it("cancels the credit when the makeup is cancelled under 24 hours", async () => {
    const [slotId] = await createClasses(1);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);

    const booked = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      creditId,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const cancelled = await cancelMakeup(
      pg.db,
      { bookingId: booked.value.id },
      cancelInstant(date, 2),
    );
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.value.booking.status).toBe("CANCELADA");
      expect(cancelled.value.credit?.status).toBe("CANCELADO");
    }

    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("CANCELADO");
  });

  it("grants no new credit when a makeup is cancelled", async () => {
    const [slotId] = await createClasses(1);
    const [student] = await createStudents(pg.db, 1);
    const creditId = await grantTestCredit(pg.db, student);

    const booked = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      creditId,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const cancelled = await cancelMakeup(
      pg.db,
      { bookingId: booked.value.id },
      cancelInstant(date, 48),
    );
    expect(cancelled.ok).toBe(true);

    // Nenhum credito novo: o mesmo credito continua sendo o do aluno
    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(creditId);
    expect(stored[0].source).toBe("CONCESSAO_MANUAL");
  });
});
