import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookings,
  classSessions,
  credits,
  creditTransactions,
  holidays,
} from "../../../../db/schema";
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
  weekdayOf,
} from "../../../classes/domain/occurrences";
import { hoursUntilOccurrence } from "../../domain/credit-rules";
import { createEnrollment } from "../../../students/services/enrollments";
import {
  cancelFutureSessions,
  materializeSession,
} from "../../../bookings/services/sessions";
import { reconcileBlockedOccurrences } from "../../../bookings/services/blocks";
import { createStudioClosure } from "../../../classes/services/blocks";
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

  it("cancels the occurrence of today and its active bookings", async () => {
    // O limite nomeado (CAL-12): a ocorrencia da propria data de hoje, e nao
    // so a proxima terca, tambem cancela e libera as reservas ativas.
    const todayOfCancellation = todayInStudio(cancelNow);
    const { slotId } = await createTestClass(pg.db, {
      weekday: weekdayOf(todayOfCancellation),
      capacity: 8,
      startTime: START_TIME,
      endTime: "20:00:00",
    });
    const materialized = await materializeSession(
      pg.db,
      { classSlotId: slotId, date: todayOfCancellation },
      cancelNow,
    );
    expect(materialized.ok).toBe(true);
    const sessionId = materialized.ok ? materialized.value.id : "";

    const [makeupStudent, fixedStudent] = await createStudents(pg.db, 2);
    const booked = await bookMakeupByStudent(
      pg.db,
      {
        studentId: makeupStudent,
        classSlotId: slotId,
        date: todayOfCancellation,
        creditId: await grantTestCredit(pg.db, makeupStudent),
      },
      cancelNow,
    );
    expect(booked.ok).toBe(true);

    await pg.db.insert(bookings).values({
      studentId: fixedStudent,
      classSessionId: sessionId,
      bookingType: "FIXED",
      status: "ATIVA",
    });

    const result = await cancelOccurrenceByStudio(
      pg.db,
      { classSessionId: sessionId },
      cancelNow,
    );
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
    expect(
      cancelled.every((row) => row.cancelledAt?.getTime() === cancelNow.getTime()),
    ).toBe(true);
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

    // Cada aluno fixo afetado recebeu o seu credito, exatamente uma vez
    const grantedStudents = stored.map((credit) => credit.studentId);
    expect(new Set(grantedStudents)).toEqual(new Set(students));
    expect(grantedStudents).toHaveLength(students.length);
    expect([...grantedStudents].sort()).toEqual([...students].sort());
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

    // Uma reserva ativa, para a repeticao poder altera-la (CAL-13, CRD-31/33)
    const [makeupStudent] = await createStudents(pg.db, 1);
    const booked = await bookMakeupByStudent(pg.db, {
      studentId: makeupStudent,
      classSlotId: slotId,
      date,
      creditId: await grantTestCredit(pg.db, makeupStudent),
    });
    expect(booked.ok).toBe(true);

    const first = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.grantedCredits).toBe(2);
      expect(first.value.cancelledBookings).toBe(1);
    }

    const [cancelledOnce] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, session.id));
    expect(cancelledOnce.status).toBe("CANCELADA");
    expect(cancelledOnce.cancelledBy).toBe("ESTUDIO");
    expect(cancelledOnce.cancelledAt).toEqual(cancelNow);
    expect(cancelledOnce.updatedAt).toEqual(cancelNow);

    const second = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: session.id,
    }, cancelNow);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.grantedCredits).toBe(0);
      expect(second.value.cancelledBookings).toBe(0);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(3);

    // A reserva ja cancelada nao e tocada pela segunda passada
    const [storedBooking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, cancelledOnce.id));
    expect(storedBooking.status).toBe(cancelledOnce.status);
    expect(storedBooking.cancelledBy).toBe(cancelledOnce.cancelledBy);
    expect(storedBooking.cancelledAt).toEqual(cancelledOnce.cancelledAt);
    expect(storedBooking.updatedAt).toEqual(cancelledOnce.updatedAt);
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

  it.each(["feriado", "recesso"] as const)(
    "refuses the cancellation of a blocked occurrence by %s (FER-09)",
    async (blockKind) => {
      const { slotId, sessionId } = await setupClass();
      const [makeupStudent] = await createStudents(pg.db, 1);

      const booked = await bookMakeupByStudent(pg.db, {
        studentId: makeupStudent,
        classSlotId: slotId,
        date,
        creditId: await grantTestCredit(pg.db, makeupStudent),
      });
      expect(booked.ok).toBe(true);

      // A ocorrencia fica BLOQUEADA pelo feriado ou pelo recesso, com a
      // reserva cancelada pelo reconcilio do bloqueio (FER-03) e o credito
      // devolvido (FER-04)
      if (blockKind === "feriado") {
        await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
        await reconcileBlockedOccurrences(pg.db, {
          fromDate: date,
          toDate: date,
        });
      } else {
        const closure = await createStudioClosure(pg.db, {
          startDate: date,
          endDate: date,
          reason: "Recesso Teste",
        });
        expect(closure.ok).toBe(true);
      }

      const result = await cancelOccurrenceByStudio(
        pg.db,
        { classSessionId: sessionId },
        cancelNow,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("bloqueada");
      }

      // Nada mudou: a ocorrencia segue BLOQUEADA, a reserva segue como ficou
      // e nenhum credito novo foi gerado (PRD 7.1)
      const [session] = await pg.db
        .select()
        .from(classSessions)
        .where(eq(classSessions.id, sessionId));
      expect(session.status).toBe("BLOQUEADA");
      const bookingRows = await pg.db.select().from(bookings);
      expect(bookingRows).toHaveLength(1);
      expect(bookingRows[0].status).toBe("CANCELADA");
      const creditsAfter = await pg.db.select().from(credits);
      expect(creditsAfter).toHaveLength(1);
      expect(creditsAfter[0].status).toBe("DISPONIVEL");
    },
  );

  it("refuses the cancellation of a past occurrence (AD-045)", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: START_TIME,
      endTime: "20:00:00",
    });
    const [student] = await createStudents(pg.db, 1);
    const pastDate = "2026-11-03";
    const [session] = await pg.db
      .insert(classSessions)
      .values({
        classSlotId: slotId,
        sessionDate: pastDate,
        status: "AGENDADA",
      })
      .returning();
    const [booking] = await pg.db
      .insert(bookings)
      .values({
        studentId: student,
        classSessionId: session.id,
        bookingType: "MAKEUP",
        status: "ATIVA",
      })
      .returning();
    const expiresAt = new Date("2026-12-09T15:00:00.000Z");
    const [credit] = await pg.db
      .insert(credits)
      .values({
        studentId: student,
        source: "CONCESSAO_MANUAL",
        status: "RESERVADO",
        usedBookingId: booking.id,
        generatedAt: new Date("2026-11-01T15:00:00.000Z"),
        expiresAt,
      })
      .returning();

    const counts = async () => ({
      sessions: (await pg.db.select().from(classSessions)).length,
      bookings: (await pg.db.select().from(bookings)).length,
      credits: (await pg.db.select().from(credits)).length,
      transactions: (await pg.db.select().from(creditTransactions)).length,
    });
    const before = await counts();
    expect(before).toEqual({ sessions: 1, bookings: 1, credits: 1, transactions: 0 });

    const result = await cancelOccurrenceByStudio(
      pg.db,
      { classSessionId: session.id },
      cancelNow,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("passado");
    }

    // Cardinalidade antes e depois: nenhuma linha extra (sessao, reserva,
    // credito ou transacao) pode ter entrado na recusa (CAL-15, AD-045)
    const after = await counts();
    expect(after).toEqual(before);

    const [storedSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, session.id));
    expect(storedSession.status).toBe("AGENDADA");
    expect(storedSession.updatedAt).toEqual(session.updatedAt);

    const [storedBooking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booking.id));
    expect(storedBooking.status).toBe("ATIVA");
    expect(storedBooking.cancelledAt).toBeNull();
    expect(storedBooking.cancelledBy).toBeNull();

    const [storedCredit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    expect(storedCredit.status).toBe("RESERVADO");
    expect(storedCredit.usedBookingId).toBe(booking.id);
    expect(storedCredit.expiresAt).toEqual(expiresAt);
  });

  it("keeps schedule-edit cancellation working for future occurrences", async () => {
    const { slotId, sessionId } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const booked = await bookMakeupByStudent(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      creditId: await grantTestCredit(pg.db, student),
    });
    expect(booked.ok).toBe(true);

    const summary = await cancelFutureSessions(
      pg.db,
      { classSlotId: slotId, fromDate: date },
      cancelNow,
    );

    expect(summary.cancelledOccurrences).toBe(1);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId));
    expect(session.status).toBe("CANCELADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(booking.status).toBe("CANCELADA");
  });
});
