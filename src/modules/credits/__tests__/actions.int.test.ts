import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookings, creditTransactions, credits } from "../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../test/postgres";
import { createBooking } from "../../bookings/services/bookings";
import { materializeSession } from "../../bookings/services/sessions";
import { weekdayOf } from "../../classes/domain/occurrences";
import { createEnrollment } from "../../students/services/enrollments";
import {
  bookMakeupByAdminAction,
  cancelCreditAction,
  cancelOccurrenceByStudioAction,
  grantCreditAction,
  registerNonAttendanceAction,
  returnCreditAction,
} from "../actions";

// Server actions de creditos (CRD-34 a CRD-36, CRD-40 a CRD-43).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STUDIO_TIMEZONE = "America/Sao_Paulo";

describe("credit actions", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
    // As actions usam o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
  });

  afterAll(async () => {
    const { db } = await import("../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
    await pg.pool.end();
    await pg.container.stop();
  });

  /** Data e hora (fuso do estudio) de um instante `hoursAhead` a frente. */
  function studioMoment(hoursAhead: number): { date: string; time: string } {
    const target = new Date(Date.now() + hoursAhead * HOUR_MS);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: STUDIO_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(target);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: STUDIO_TIMEZONE,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(target);
    return { date, time };
  }

  /**
   * Ocorrencia de uma turma criada `hoursAhead` horas a frente: a antecedencia
   * do aviso e a propria distancia do inicio da aula, o que deixa o teste
   * deterministico em qualquer hora do dia.
   */
  async function createOccurrence(hoursAhead: number): Promise<{
    slotId: string;
    sessionId: string;
    date: string;
  }> {
    const start = studioMoment(hoursAhead);
    const end = studioMoment(hoursAhead + 1);
    const { slotId } = await createTestClass(pg.db, {
      weekday: weekdayOf(start.date),
      capacity: 8,
      startTime: start.time,
      endTime: end.time,
    });
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: start.date,
    });
    expect(materialized.ok).toBe(true);
    return {
      slotId,
      sessionId: materialized.ok ? materialized.value.id : "",
      date: start.date,
    };
  }

  it("grants a credit from the admin action and returns the new status", async () => {
    const [student] = await createStudents(pg.db, 1);

    const result = await grantCreditAction({
      studentId: student,
      reason: "Bonificacao do estudio",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { credit, transaction } = result.value;
    expect(credit.studentId).toBe(student);
    expect(credit.source).toBe("CONCESSAO_MANUAL");
    expect(credit.status).toBe("DISPONIVEL");
    // Validade de 30 dias contados da geracao (CRD-11, CRD-34)
    const validityDays =
      (credit.expiresAt.getTime() - credit.generatedAt.getTime()) / DAY_MS;
    expect(validityDays).toBeGreaterThan(29.9);
    expect(validityDays).toBeLessThan(30.1);

    expect(transaction.creditId).toBe(credit.id);
    expect(transaction.action).toBe("CONCESSAO");
    expect(transaction.previousStatus).toBeNull();
    expect(transaction.newStatus).toBe("DISPONIVEL");
    expect(transaction.reason).toBe("Bonificacao do estudio");
    expect(transaction.adminLabel).toBe("admin");

    const storedCredits = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    expect(storedCredits).toHaveLength(1);
    expect(storedCredits[0].status).toBe("DISPONIVEL");

    const storedTransactions = await pg.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.creditId, credit.id));
    expect(storedTransactions).toHaveLength(1);
    expect(storedTransactions[0].action).toBe("CONCESSAO");
  });

  it("returns a credit from the admin action and returns the new status", async () => {
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCreditAction({
      studentId: student,
      reason: "Bonificacao do estudio",
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;
    const originalExpiry = granted.value.credit.expiresAt.toISOString();

    const cancelled = await cancelCreditAction({
      creditId,
      reason: "Ajuste do estudio",
    });
    expect(cancelled.ok).toBe(true);

    const returned = await returnCreditAction({
      creditId,
      reason: "Credito devolvido ao aluno",
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;

    // A devolucao volta a DISPONIVEL e mantem o vencimento original (AD-021)
    expect(returned.value.credit.status).toBe("DISPONIVEL");
    expect(returned.value.credit.expiresAt.toISOString()).toBe(originalExpiry);
    expect(returned.value.transaction.action).toBe("DEVOLUCAO");
    expect(returned.value.transaction.previousStatus).toBe("CANCELADO");
    expect(returned.value.transaction.newStatus).toBe("DISPONIVEL");
    expect(returned.value.transaction.reason).toBe("Credito devolvido ao aluno");

    const stored = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(stored[0].status).toBe("DISPONIVEL");
    expect(stored[0].expiresAt.toISOString()).toBe(originalExpiry);
  });

  it("cancels a credit from the admin action and returns the new status", async () => {
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCreditAction({
      studentId: student,
      reason: "Bonificacao do estudio",
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;

    const result = await cancelCreditAction({
      creditId,
      reason: "Credito indevido",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.credit.status).toBe("CANCELADO");
    expect(result.value.transaction.action).toBe("CANCELAMENTO");
    expect(result.value.transaction.previousStatus).toBe("DISPONIVEL");
    expect(result.value.transaction.newStatus).toBe("CANCELADO");
    expect(result.value.transaction.reason).toBe("Credito indevido");

    const stored = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(stored[0].status).toBe("CANCELADO");

    const storedTransactions = await pg.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.creditId, creditId));
    expect(storedTransactions).toHaveLength(2);
  });

  it("refuses a manual credit change without a reason", async () => {
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCreditAction({
      studentId: student,
      reason: "Bonificacao do estudio",
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;

    const returned = await returnCreditAction({ creditId, reason: "   " });
    expect(returned.ok).toBe(false);
    if (!returned.ok) {
      expect(returned.field).toBe("reason");
      expect(returned.error).toContain("motivo");
    }

    const cancelled = await cancelCreditAction({ creditId, reason: "" });
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) {
      expect(cancelled.field).toBe("reason");
    }

    // Nada mudou: o credito segue DISPONIVEL e sem transacao nova
    const stored = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(stored[0].status).toBe("DISPONIVEL");
    const storedTransactions = await pg.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.creditId, creditId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("registers the non attendance from the admin action and returns the outcome", async () => {
    const { slotId, sessionId, date } = await createOccurrence(48);
    const [student] = await createStudents(pg.db, 1);
    // O aviso so vale para o aluno fixo da turma (CRD-45)
    const enrollment = await createEnrollment(pg.db, {
      studentId: student,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const result = await registerNonAttendanceAction({
      studentId: student,
      classSessionId: sessionId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Com 48h de antecedencia: cancelamento com credito gerado (CRD-04)
    expect(result.value.status).toBe("CANCELADA");
    expect(result.value.noticeHours).toBeGreaterThanOrEqual(24);
    expect(result.value.booking.status).toBe("CANCELADA");
    expect(result.value.booking.bookingType).toBe("FIXED");
    expect(result.value.credit).not.toBeNull();
    expect(result.value.credit?.studentId).toBe(student);
    expect(result.value.credit?.source).toBe("CANCELAMENTO_AULA_FIXA");
    expect(result.value.credit?.status).toBe("DISPONIVEL");

    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(1);
  });

  it("registers the absence from the admin action without a credit", async () => {
    const { slotId, sessionId, date } = await createOccurrence(2);
    const [student] = await createStudents(pg.db, 1);
    const enrollment = await createEnrollment(pg.db, {
      studentId: student,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const result = await registerNonAttendanceAction({
      studentId: student,
      classSessionId: sessionId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Com menos de 24h: falta registrada e nenhum credito (CRD-06)
    expect(result.value.status).toBe("FALTA");
    expect(result.value.noticeHours).toBeLessThan(24);
    expect(result.value.credit).toBeNull();

    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(0);
  });

  it("cancels the class from the admin action and returns the counts", async () => {
    const { slotId, sessionId, date } = await createOccurrence(48);
    const [fixedStudent, makeupStudent, experimentalStudent] =
      await createStudents(pg.db, 3);

    const enrollment = await createEnrollment(pg.db, {
      studentId: fixedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const makeup = await bookMakeupByAdminAction({
      studentId: makeupStudent,
      classSlotId: slotId,
      date,
      creditId: await grantTestCredit(pg.db, makeupStudent),
    });
    expect(makeup.ok).toBe(true);

    const experimental = await createBooking(pg.db, {
      studentId: experimentalStudent,
      classSlotId: slotId,
      date,
      type: "EXPERIMENTAL",
    });
    expect(experimental.ok).toBe(true);

    const result = await cancelOccurrenceByStudioAction({ classSessionId: sessionId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.session.status).toBe("CANCELADA");
    expect(result.value.cancelledBookings).toBe(2);
    expect(result.value.returnedCredits).toBe(1);
    expect(result.value.grantedCredits).toBe(1);

    const storedBookings = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(storedBookings).toHaveLength(2);
    for (const booking of storedBookings) {
      expect(booking.status).toBe("CANCELADA");
      expect(booking.cancelledBy).toBe("ESTUDIO");
    }

    // O credito da reposicao voltou a DISPONIVEL e o fixo ganhou o do estudio
    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(2);
    const studioCredit = storedCredits.find(
      (credit) => credit.source === "CANCELAMENTO_ESTUDIO",
    );
    expect(studioCredit?.studentId).toBe(fixedStudent);
    expect(studioCredit?.status).toBe("DISPONIVEL");
    const makeupCredit = storedCredits.find(
      (credit) => credit.source === "CONCESSAO_MANUAL",
    );
    expect(makeupCredit?.status).toBe("DISPONIVEL");
  });

  it("refuses a manual makeup without a credit", async () => {
    const { slotId, date } = await createOccurrence(48);
    const [student] = await createStudents(pg.db, 1);

    const result = await bookMakeupByAdminAction({
      studentId: student,
      classSlotId: slotId,
      date,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("creditId");
      expect(result.error).toContain("credito");
    }

    // Nenhuma reserva criada e nenhum credito reservado
    const storedBookings = await pg.db.select().from(bookings);
    expect(storedBookings).toHaveLength(0);
    const storedCredits = await pg.db.select().from(credits);
    expect(storedCredits).toHaveLength(0);
  });
});
