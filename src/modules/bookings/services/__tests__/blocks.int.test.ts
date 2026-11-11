import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookings,
  classSessions,
  classSlots,
  creditTransactions,
  credits,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio, addDays } from "../../../classes/domain/occurrences";
import { cancelOccurrenceByStudio } from "../../../credits/services/cancellations";
import { createEnrollment } from "../../../students/services/enrollments";
import { createBooking } from "../bookings";
import { materializeSession } from "../sessions";
import { reconcileBlockedOccurrences } from "../blocks";

describe("block reconcile", () => {
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

  /** Turma de terca (weekday 3) e a proxima ocorrencia futura dela. */
  async function setupClass() {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    return { slotId, date };
  }

  async function bookMakeup(slotId: string, date: string, studentId: string) {
    const creditId = await grantTestCredit(pg.db, studentId);
    const booked = await createBooking(pg.db, {
      studentId,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId,
    });
    if (!booked.ok) throw new Error(booked.error);
    return { bookingId: booked.value.id, creditId };
  }

  async function sessionStatus(date: string, slotId: string) {
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(
        and(eq(classSessions.sessionDate, date), eq(classSessions.classSlotId, slotId)),
      );
    return session;
  }

  it("blocks the occurrences of the window and cancels their active bookings (FER-01, FER-03)", async () => {
    const { slotId, date } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const booked = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "FIXED",
    });
    if (!booked.ok) throw new Error(booked.error);

    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    const first = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });

    expect(first.blockedCount).toBe(1);
    expect(first.cancelledBookings).toBe(1);
    const session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("BLOQUEADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.value.id));
    expect(booking.status).toBe("CANCELADA");
    expect(booking.cancelledBy).toBe("ESTUDIO");
    expect(booking.cancelledAt).toBeTruthy();

    // Idempotencia: rodar de novo nao muda nada na segunda passada
    const second = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });
    expect(second).toEqual({
      blockedCount: 0,
      reopenedCount: 0,
      cancelledBookings: 0,
      returnedCredits: 0,
    });
  });

  it("returns the reserved makeup credit to DISPONIVEL keeping the original expiry (FER-04)", async () => {
    const { slotId, date } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const { creditId } = await bookMakeup(slotId, date, student);

    const [before] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(before.status).toBe("RESERVADO");

    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });
    expect(result.returnedCredits).toBe(1);

    const [after] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(after.status).toBe("DISPONIVEL");
    // O vencimento original e preservado (AD-020)
    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());

    const transactions = await pg.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.creditId, creditId));
    const devolution = transactions.find(
      (transaction) => transaction.action === "DEVOLUCAO",
    );
    expect(devolution).toBeTruthy();
    expect(devolution?.previousStatus).toBe("RESERVADO");
    expect(devolution?.newStatus).toBe("DISPONIVEL");
    expect(devolution?.reason).toContain("bloqueada");
  });

  it("creates no credit when blocking (FER-05, PRD 15)", async () => {
    const { slotId, date } = await setupClass();
    const date2 = addDays(date, 7); // mesma terca, semana seguinte
    // Fixo com vinculo ativo + reposicao com credito reservado (feriado) e
    // experimental sem credito (recesso)
    const students = await createStudents(pg.db, 3);
    const enrolled = await createEnrollment(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      startDate: today,
    });
    if (!enrolled.ok) throw new Error(enrolled.error);
    const { creditId } = await bookMakeup(slotId, date, students[1]);
    const experimental = await createBooking(pg.db, {
      studentId: students[2],
      classSlotId: slotId,
      date: date2,
      type: "EXPERIMENTAL",
    });
    if (!experimental.ok) throw new Error(experimental.error);

    const creditsBefore = await pg.db.select().from(credits);
    expect(creditsBefore).toHaveLength(1);

    // O feriado bloqueia a primeira ocorrencia: nenhum credito novo
    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    await reconcileBlockedOccurrences(pg.db, { fromDate: date, toDate: date2 });

    // Nenhuma linha de credito nova: o fixo nao recebe credito (PRD 7.1) e
    // o credito da reposicao e o mesmo, devolvido
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
    await pg.db.insert(studioClosures).values({
      startDate: date2,
      endDate: date2,
      reason: "Recesso Teste",
    });
    await reconcileBlockedOccurrences(pg.db, { fromDate: date2, toDate: date2 });

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
      .where(eq(bookings.id, experimental.value.id));
    expect(experimentalBooking.status).toBe("CANCELADA");
    expect(experimentalBooking.bookingType).toBe("EXPERIMENTAL");
  });

  it("leaves past occurrences untouched (FER-06)", async () => {
    const { slotId } = await setupClass();
    const pastDate = "2026-01-05"; // terca-feira no passado
    const [student] = await createStudents(pg.db, 1);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: pastDate, status: "AGENDADA" })
      .returning();
    await pg.db.insert(bookings).values({
      studentId: student,
      classSessionId: session.id,
      bookingType: "FIXED",
      status: "ATIVA",
    });

    await pg.db.insert(holidays).values({ date: pastDate, name: "Passado" });
    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: pastDate,
      toDate: pastDate,
    });

    expect(result.blockedCount).toBe(0);
    const [after] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, session.id));
    expect(after.status).toBe("AGENDADA");
    const [booking] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, session.id));
    expect(booking.status).toBe("ATIVA");
  });

  it("leaves cancelled occurrences untouched (FER-07)", async () => {
    const { slotId, date } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);

    // A ocorrencia tem historico: uma reserva cancelada pelo estudio
    const booked = await createBooking(pg.db, {
      studentId: student,
      classSlotId: slotId,
      date,
      type: "FIXED",
    });
    if (!booked.ok) throw new Error(booked.error);
    const cancelled = await cancelOccurrenceByStudio(pg.db, {
      classSessionId: materialized.value.id,
    });
    expect(cancelled.ok).toBe(true);

    const [before] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.value.id));
    expect(before.status).toBe("CANCELADA");

    await pg.db.insert(holidays).values({ date, name: "Feriado Teste" });
    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });

    expect(result.blockedCount).toBe(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, materialized.value.id));
    expect(session.status).toBe("CANCELADA");

    // A reserva historica segue intocada: mesmo status, mesmo cancelamento,
    // e nenhuma escrita na linha (o updatedAt nao muda)
    const [after] = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booked.value.id));
    expect(after.status).toBe("CANCELADA");
    expect(after.cancelledBy).toBe(before.cancelledBy);
    expect(after.cancelledAt?.getTime()).toBe(before.cancelledAt?.getTime());
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("restores uncovered blocked occurrences to AGENDADA (FER-10)", async () => {
    const { slotId, date } = await setupClass();
    const [holiday] = await pg.db
      .insert(holidays)
      .values({ date, name: "Feriado Teste" })
      .returning();
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    expect(materialized.value.status).toBe("BLOQUEADA");

    await pg.db.delete(holidays).where(eq(holidays.id, holiday.id));
    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });

    expect(result.reopenedCount).toBe(1);
    const session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("AGENDADA");
  });

  it("keeps the occurrence blocked while another block covers the date (FER-12)", async () => {
    const { slotId, date } = await setupClass();
    const [holiday] = await pg.db
      .insert(holidays)
      .values({ date, name: "Feriado Teste" })
      .returning();
    await pg.db.insert(studioClosures).values({
      startDate: date,
      endDate: date,
      reason: "Recesso sobreposto",
    });
    await materializeSession(pg.db, { classSlotId: slotId, date });

    // Removido o feriado, o recesso ainda cobre a data
    await pg.db.delete(holidays).where(eq(holidays.id, holiday.id));
    const stillBlocked = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });
    expect(stillBlocked.reopenedCount).toBe(0);
    let session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("BLOQUEADA");

    // Removido o recesso, nenhum bloqueio cobre mais a data
    await pg.db.delete(studioClosures);
    await reconcileBlockedOccurrences(pg.db, { fromDate: date, toDate: date });
    session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("AGENDADA");
  });

  it("keeps a past blocked occurrence blocked when unblocking (FER-13)", async () => {
    const { slotId } = await setupClass();
    const pastDate = "2026-01-05";
    await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: pastDate, status: "BLOQUEADA" });

    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: pastDate,
      toDate: pastDate,
    });

    expect(result.reopenedCount).toBe(0);
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, pastDate));
    expect(session.status).toBe("BLOQUEADA");
  });

  it("keeps the occurrence blocked when the slot weekday changed (FER-14)", async () => {
    const { slotId, date } = await setupClass();
    const [holiday] = await pg.db
      .insert(holidays)
      .values({ date, name: "Feriado Teste" })
      .returning();
    await materializeSession(pg.db, { classSlotId: slotId, date });

    // A turma mudou de dia: a data da ocorrencia nao corresponde mais
    await pg.db.delete(holidays).where(eq(holidays.id, holiday.id));
    await pg.db
      .update(classSlots)
      .set({ weekday: 4 })
      .where(eq(classSlots.id, slotId));

    const result = await reconcileBlockedOccurrences(pg.db, {
      fromDate: date,
      toDate: date,
    });

    expect(result.reopenedCount).toBe(0);
    const session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("BLOQUEADA");
  });

  it("restores no booking when unblocking (FER-15)", async () => {
    const { slotId, date } = await setupClass();
    const [student] = await createStudents(pg.db, 1);
    const { creditId } = await bookMakeup(slotId, date, student);
    const [holiday] = await pg.db
      .insert(holidays)
      .values({ date, name: "Feriado Teste" })
      .returning();

    await reconcileBlockedOccurrences(pg.db, { fromDate: date, toDate: date });
    await pg.db.delete(holidays).where(eq(holidays.id, holiday.id));
    await reconcileBlockedOccurrences(pg.db, { fromDate: date, toDate: date });

    const session = await sessionStatus(date, slotId);
    expect(session?.status).toBe("AGENDADA");
    const bookingRows = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, session!.id));
    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0].status).toBe("CANCELADA");

    const [credit] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(credit.status).toBe("DISPONIVEL");
  });
});
