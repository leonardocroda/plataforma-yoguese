import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, classSessions, credits } from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { hoursUntilOccurrence } from "../../domain/credit-rules";
import { createEnrollment } from "../../../students/services/enrollments";
import { materializeSession } from "../../../bookings/services/sessions";
import { bookMakeupByStudent } from "../makeups";
import {
  cancelOccurrenceByStudio,
  registerNonAttendance,
} from "../cancellations";

// Cancelamento de aula pelo estudio (CRD-28 a CRD-31, CRD-33).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const START_TIME = "19:00:00";
/** Instante fixo do cancelamento: o credito vence 30 dias depois dele. */
const cancelNow = new Date("2026-11-09T15:00:00.000Z");

describe("studio cancellation", () => {
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

  async function setupClass(): Promise<{ slotId: string; sessionId: string }> {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: START_TIME,
      endTime: "20:00:00",
    });
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(materialized.ok).toBe(true);
    return { slotId, sessionId: materialized.ok ? materialized.value.id : "" };
  }

  /** Instante do aviso: `hoursBefore` horas antes do inicio da aula. */
  function noticeInstant(hoursBefore: number): Date {
    const reference = new Date("2026-11-01T12:00:00Z");
    const toStart = hoursUntilOccurrence(date, START_TIME, reference);
    const start = new Date(
      reference.getTime() + Math.round(toStart * HOUR_MS),
    );
    return new Date(start.getTime() - hoursBefore * HOUR_MS);
  }

  it("cancels the occurrence and its active bookings", async () => {
    const { slotId, sessionId } = await setupClass();
    const [makeupStudent, fixedStudent] = await createStudents(pg.db, 2);

    const booked = await bookMakeupByStudent(pg.db, {
      studentId: makeupStudent,
      classSlotId: slotId,
      date,
      creditId: await grantTestCredit(pg.db, makeupStudent),
    });
    expect(booked.ok).toBe(true);

    await pg.db.insert(bookings).values({
      studentId: fixedStudent,
      classSessionId: sessionId,
      bookingType: "FIXED",
      status: "ATIVA",
    });

    const result = await cancelOccurrenceByStudio(pg.db, { classSessionId: sessionId }, cancelNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.status).toBe("CANCELADA");
      expect(result.value.cancelledBookings).toBe(2);
    }

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId));
    expect(session.status).toBe("CANCELADA");

    const cancelled = await pg.db.select().from(bookings);
    expect(cancelled).toHaveLength(2);
    expect(cancelled.every((row) => row.status === "CANCELADA")).toBe(true);
    expect(cancelled.every((row) => row.cancelledBy === "ESTUDIO")).toBe(true);
  });

  it("grants one credit per affected fixed student", async () => {
    const { slotId } = await setupClass();
    const students = await createStudents(pg.db, 3);
    for (const studentId of students) {
      const enrollment = await createEnrollment(pg.db, {
        studentId,
        classSlotId: slotId,
        startDate: date,
      });
      expect(enrollment.ok).toBe(true);
    }

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));

    const result = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grantedCredits).toBe(3);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(3);
    for (const credit of stored) {
      expect(credit.source).toBe("CANCELAMENTO_ESTUDIO");
      expect(credit.status).toBe("DISPONIVEL");
      expect(credit.sourceSessionId).toBe(session.id);
      expect(credit.expiresAt.getTime() - credit.generatedAt.getTime()).toBe(
        30 * DAY_MS,
      );
    }
  });

  it("returns the makeup credit to DISPONIVEL", async () => {
    const { slotId, sessionId } = await setupClass();
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

    const result = await cancelOccurrenceByStudio(pg.db, { classSessionId: sessionId }, cancelNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.returnedCredits).toBe(1);
    }

    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("DISPONIVEL");
    expect(credit.expiresAt.toISOString()).toBe(expiresAt);
    expect(credit.usedBookingId).toBeNull();
  });

  it("grants no duplicate credit when the cancellation repeats", async () => {
    const { slotId } = await setupClass();
    const students = await createStudents(pg.db, 2);
    for (const studentId of students) {
      const enrollment = await createEnrollment(pg.db, {
        studentId,
        classSlotId: slotId,
        startDate: date,
      });
      expect(enrollment.ok).toBe(true);
    }

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));

    const first = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.grantedCredits).toBe(2);
    }

    const second = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.grantedCredits).toBe(0);
      expect(second.value.cancelledBookings).toBe(0);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(2);
  });

  it("grants the studio credit to a student who already missed", async () => {
    const { slotId } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const enrollment = await createEnrollment(pg.db, {
      studentId: student,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));

    // Aviso tarde: falta sem credito
    const notice = await registerNonAttendance(
      pg.db,
      { studentId: student, classSessionId: session.id },
      noticeInstant(2),
    );
    expect(notice.ok).toBe(true);
    if (notice.ok) {
      expect(notice.value.status).toBe("FALTA");
      expect(notice.value.credit).toBeNull();
    }

    const result = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grantedCredits).toBe(1);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(1);
    expect(stored[0].studentId).toBe(student);
    expect(stored[0].source).toBe("CANCELAMENTO_ESTUDIO");
    expect(stored[0].status).toBe("DISPONIVEL");
  });

  it("grants no second credit to a student who already has one for the occurrence", async () => {
    const { slotId } = await setupClass();
    const students = await createStudents(pg.db, 2);
    for (const studentId of students) {
      const enrollment = await createEnrollment(pg.db, {
        studentId,
        classSlotId: slotId,
        startDate: date,
      });
      expect(enrollment.ok).toBe(true);
    }

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));

    // O primeiro aluno avisou com 48h: ja tem credito da ocorrencia
    const notice = await registerNonAttendance(
      pg.db,
      { studentId: students[0], classSessionId: session.id },
      noticeInstant(48),
    );
    expect(notice.ok).toBe(true);
    if (notice.ok) {
      expect(notice.value.credit?.source).toBe("CANCELAMENTO_AULA_FIXA");
    }

    const result = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // So o segundo aluno affected recebe o credito do estudio
      expect(result.value.grantedCredits).toBe(1);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(2);
    const own = stored.filter((credit) => credit.studentId === students[0]);
    expect(own).toHaveLength(1);
    expect(own[0].source).toBe("CANCELAMENTO_AULA_FIXA");
    const studio = stored.filter(
      (credit) => credit.studentId === students[1],
    );
    expect(studio).toHaveLength(1);
    expect(studio[0].source).toBe("CANCELAMENTO_ESTUDIO");
  });
});
