import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, credits, fixedEnrollments } from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { hoursUntilOccurrence } from "../../domain/credit-rules";
import { createEnrollment } from "../../../students/services/enrollments";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import {
  listStudentAttendanceHistory,
  registerNonAttendance,
} from "../cancellations";

// Aviso de nao comparecimento do aluno fixo (CRD-01 a CRD-08, CRD-10).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const START_TIME = "19:00:00";

describe("non attendance", () => {
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

  /** Ocorrecia de uma turma de terca, na proxima data do calendario. */
  async function setupOccurrence(): Promise<{
    slotId: string;
    sessionId: string;
    date: string;
    studentId: string;
  }> {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: START_TIME,
      endTime: "20:00:00",
    });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    expect(materialized.ok).toBe(true);
    const [student] = await createStudents(pg.db, 1);
    return {
      slotId,
      sessionId: materialized.ok ? materialized.value.id : "",
      date,
      studentId: student,
    };
  }

  /** Instante do aviso: `hoursBefore` horas antes do inicio da aula. */
  function noticeInstant(date: string, hoursBefore: number): Date {
    const reference = new Date("2026-11-01T12:00:00Z");
    const toStart = hoursUntilOccurrence(date, START_TIME, reference);
    const start = new Date(
      reference.getTime() + Math.round(toStart * HOUR_MS),
    );
    return new Date(start.getTime() - hoursBefore * HOUR_MS);
  }

  it("creates the occurrence record and releases the spot", async () => {
    const { slotId, sessionId, date, studentId } = await setupOccurrence();

    // O aluno tinha uma reserva fixa ativa na ocorrencia
    await pg.db.insert(bookings).values({
      studentId,
      classSessionId: sessionId,
      bookingType: "FIXED",
      status: "ATIVA",
    });

    const before = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 8,
    });
    expect(before.fixedCount).toBe(1);
    expect(before.availableSpots).toBe(7);

    const now = noticeInstant(date, 48);
    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.booking.bookingType).toBe("FIXED");
      expect(result.value.booking.status).toBe("CANCELADA");
      expect(result.value.booking.cancelledBy).toBe("ALUNO");
      expect(result.value.booking.cancelledAt?.toISOString()).toBe(
        now.toISOString(),
      );
    }

    // A vaga do aluno voltou
    const after = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 8,
    });
    expect(after.fixedCount).toBe(0);
    expect(after.total).toBe(0);
    expect(after.availableSpots).toBe(8);
  });

  it("records the cancellation when the notice is 24 hours or more", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      noticeInstant(date, 48),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("CANCELADA");
      expect(result.value.noticeHours).toBe(48);
    }

    const stored = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("CANCELADA");
    expect(stored[0].bookingType).toBe("FIXED");
  });

  it("records the absence when the notice is under 24 hours", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      noticeInstant(date, 5),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("FALTA");
    }

    const stored = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("FALTA");
  });

  it("grants a credit when the notice is 24 hours or more", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const now = noticeInstant(date, 48);
    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const credit = result.value.credit;
    expect(credit).not.toBeNull();
    if (!credit) return;

    expect(credit.studentId).toBe(studentId);
    expect(credit.source).toBe("CANCELAMENTO_AULA_FIXA");
    expect(credit.status).toBe("DISPONIVEL");
    expect(credit.sourceBookingId).toBe(result.value.booking.id);
    expect(credit.sourceSessionId).toBe(sessionId);
    expect(credit.generatedAt.toISOString()).toBe(now.toISOString());
    expect(credit.expiresAt.getTime() - credit.generatedAt.getTime()).toBe(
      30 * DAY_MS,
    );

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(1);
  });

  it("grants a credit at exactly 24 hours", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const now = noticeInstant(date, 24);
    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.noticeHours).toBe(24);
      expect(result.value.status).toBe("CANCELADA");
      expect(result.value.credit).not.toBeNull();
      expect(result.value.credit?.source).toBe("CANCELAMENTO_AULA_FIXA");
    }
  });

  it("grants no credit at 23 hours 59 minutes", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    // 23h59 antes do inicio: um minuto a menos de antecedencia
    const now = new Date(noticeInstant(date, 24).getTime() + 60 * 1000);
    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("FALTA");
      expect(result.value.credit).toBeNull();
      expect(result.value.noticeHours).toBeLessThan(24);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(0);
  });

  it("refuses a second notice for the same occurrence", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const first = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      noticeInstant(date, 48),
    );
    expect(first.ok).toBe(true);

    const second = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      noticeInstant(date, 48),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("ja existe registro");
    }

    // Sem credito novo e sem historico duplicado
    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(1);
    const storedBookings = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(storedBookings).toHaveLength(1);
    const history = await listStudentAttendanceHistory(pg.db, studentId);
    expect(history).toHaveLength(1);
  });

  it("keeps the fixed enrollment active for the next occurrences", async () => {
    const { slotId, sessionId, date, studentId } = await setupOccurrence();

    const enrollment = await createEnrollment(pg.db, {
      studentId,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      noticeInstant(date, 48),
    );
    expect(result.ok).toBe(true);

    // O vinculo fixo continua ativo
    if (enrollment.ok) {
      const [stored] = await pg.db
        .select()
        .from(fixedEnrollments)
        .where(eq(fixedEnrollments.id, enrollment.value.id));
      expect(stored.status).toBe("ATIVA");
      expect(stored.startDate).toBe(date);
      expect(stored.endDate).toBeNull();
    }

    // Na proxima ocorrencia o aluno segue contando como fixo (CRD-08)
    const nextDate = nextOccurrence({ weekday: 3 }, addDays(date, 1));
    const nextSession = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: nextDate,
    });
    expect(nextSession.ok).toBe(true);

    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId: nextSession.ok ? nextSession.value.id : "",
      date: nextDate,
      capacity: 8,
    });
    expect(composition.fixedCount).toBe(1);
    expect(composition.availableSpots).toBe(7);
  });

  it("records the notice in the student history", async () => {
    const { sessionId, date, studentId } = await setupOccurrence();

    const now = noticeInstant(date, 48);
    const result = await registerNonAttendance(
      pg.db,
      { studentId, classSessionId: sessionId },
      now,
    );
    expect(result.ok).toBe(true);

    const history = await listStudentAttendanceHistory(pg.db, studentId);
    expect(history).toHaveLength(1);
    const entry = history[0];
    expect(entry.classSessionId).toBe(sessionId);
    expect(entry.sessionDate).toBe(date);
    expect(entry.startTime).toBe(START_TIME);
    expect(entry.status).toBe("CANCELADA");
    expect(entry.noticeHours).toBe(48);
    expect(entry.cancelledBy).toBe("ALUNO");
    expect(entry.cancelledAt?.toISOString()).toBe(now.toISOString());
    expect(entry.createdAt.toISOString()).toBe(now.toISOString());
  });
});
