import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bookings, classSessions } from "../../../../db/schema";
import {
  createExperimental,
  createStudents,
  createTestClass,
  clearTables,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { grantCredit } from "../../../credits/services/credits";
import { createEnrollment } from "../../../students/services/enrollments";
import { blockClassSlotDate } from "../../../classes/services/blocks";
import { createBooking } from "../bookings";
import { getComposition } from "../composition";
import { listOccurrences } from "../occurrences";

const NOW = new Date("2026-11-14T15:00:00.000Z");
const TODAY = "2026-11-14";

describe("occurrences", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("materializes every scheduled date in the window and stays idempotent", async () => {
    const tuesday = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    const wednesday = await createTestClass(pg.db, {
      weekday: 4,
      capacity: 8,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });

    const first = await listOccurrences(pg.db, {
      from: TODAY,
      to: "2026-11-28",
      now: NOW,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      first.value.map((occurrence) => ({
        classSlotId: occurrence.classSlotId,
        date: occurrence.date,
      })),
    ).toEqual(
      expect.arrayContaining([
        { classSlotId: tuesday.slotId, date: "2026-11-17" },
        { classSlotId: tuesday.slotId, date: "2026-11-24" },
        { classSlotId: wednesday.slotId, date: "2026-11-18" },
        { classSlotId: wednesday.slotId, date: "2026-11-25" },
      ]),
    );
    expect(first.value).toHaveLength(4);

    const second = await listOccurrences(pg.db, {
      from: TODAY,
      to: "2026-11-28",
      now: NOW,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.map((occurrence) => occurrence.sessionId)).toEqual(
      first.value.map((occurrence) => occurrence.sessionId),
    );
    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toHaveLength(4);
  });

  it("derives every count from the single composition source", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 4,
    });
    const date = "2026-11-17";
    const [fixedStudent, makeupStudent, experimentalStudent] =
      await createStudents(pg.db, 3);

    const enrollment = await createEnrollment(pg.db, {
      studentId: fixedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const makeup = await createBooking(
      pg.db,
      {
        studentId: makeupStudent,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId: await grantTestCredit(pg.db, makeupStudent),
      },
      NOW,
    );
    expect(makeup.ok).toBe(true);
    if (makeup.ok) {
      expect(makeup.value.bookingType).toBe("MAKEUP");
      expect(makeup.value.status).toBe("ATIVA");
    }

    const experimentalBooking = await createBooking(
      pg.db,
      {
        studentId: experimentalStudent,
        classSlotId: slotId,
        date,
        type: "EXPERIMENTAL",
      },
      NOW,
    );
    expect(experimentalBooking.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    const approved = await createExperimental(pg.db, {
      classSessionId: session.id,
      name: "Visitante Aprovada",
      status: "APROVADA",
    });
    expect(approved.id).toBeTruthy();

    const granted = await grantCredit(
      pg.db,
      {
        studentId: fixedStudent,
        source: "CANCELAMENTO_ESTUDIO",
        sourceSessionId: session.id,
        reason: "Credito da ocorrencia",
        adminLabel: "testes",
        generatedAt: NOW,
      },
      NOW,
    );
    expect(granted.ok).toBe(true);

    const listed = await listOccurrences(pg.db, {
      from: date,
      to: date,
      now: NOW,
    });
    const reading = await getComposition(
      pg.db,
      { classSlotId: slotId, date },
      NOW,
    );

    expect(listed.ok).toBe(true);
    expect(reading.ok).toBe(true);
    if (!listed.ok || !reading.ok) return;
    const occurrence = listed.value[0];
    expect(occurrence.composition).toEqual({
      fixedCount: reading.value.fixedCount,
      makeupCount: reading.value.makeupCount,
      experimentalCount: reading.value.experimentalCount,
      total: reading.value.total,
      availableSpots: reading.value.availableSpots,
    });
    expect(occurrence.composition).toEqual({
      fixedCount: 1,
      makeupCount: 1,
      experimentalCount: 2,
      total: 4,
      availableSpots: 0,
    });
    expect(occurrence.credits.map((credit) => credit.id)).toEqual([
      granted.ok ? granted.value.credit.id : "",
    ]);
  });

  it("omits a past occurrence that was never materialized", async () => {
    await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });

    const listed = await listOccurrences(pg.db, {
      from: "2026-11-03",
      to: "2026-11-10",
      now: NOW,
    });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toEqual([]);
    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toEqual([]);
  });

  it("shows past occurrences that exist with their real status", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    await pg.db.insert(classSessions).values([
      { classSlotId: slotId, sessionDate: "2026-11-03", status: "CANCELADA" },
      { classSlotId: slotId, sessionDate: "2026-11-10", status: "BLOQUEADA" },
    ]);

    const listed = await listOccurrences(pg.db, {
      from: "2026-11-03",
      to: "2026-11-10",
      now: NOW,
    });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(
      listed.value.map((occurrence) => ({
        date: occurrence.date,
        sessionStatus: occurrence.sessionStatus,
      })),
    ).toEqual([
      { date: "2026-11-03", sessionStatus: "CANCELADA" },
      { date: "2026-11-10", sessionStatus: "BLOQUEADA" },
    ]);
  });

  it("returns a class-date-blocked occurrence as blocked", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    const date = "2026-11-17";
    const blocked = await blockClassSlotDate(
      pg.db,
      { classSlotId: slotId, date },
      NOW,
    );
    expect(blocked.ok).toBe(true);

    const listed = await listOccurrences(pg.db, {
      from: date,
      to: date,
      now: NOW,
    });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value[0].sessionStatus).toBe("BLOQUEADA");
    expect(listed.value[0].classBlocked).toBe(true);
    expect(listed.value[0].blockSource).toBe("classSlot");
  });

  it("includes participants and absence notices in each occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    const date = "2026-11-17";
    const [fixedStudent, notifiedStudent, makeupStudent] =
      await createStudents(pg.db, 3);

    const fixedEnrollment = await createEnrollment(pg.db, {
      studentId: fixedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    const notifiedEnrollment = await createEnrollment(pg.db, {
      studentId: notifiedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    expect(fixedEnrollment.ok).toBe(true);
    expect(notifiedEnrollment.ok).toBe(true);

    const makeup = await createBooking(
      pg.db,
      {
        studentId: makeupStudent,
        classSlotId: slotId,
        date,
        type: "MAKEUP",
        creditId: await grantTestCredit(pg.db, makeupStudent),
      },
      NOW,
    );
    expect(makeup.ok).toBe(true);

    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    await pg.db.insert(bookings).values({
      studentId: notifiedStudent,
      classSessionId: session.id,
      bookingType: "FIXED",
      status: "FALTA",
    });
    const approved = await createExperimental(pg.db, {
      classSessionId: session.id,
      name: "Visitante Aprovada",
      status: "APROVADA",
    });

    const listed = await listOccurrences(pg.db, {
      from: date,
      to: date,
      now: NOW,
    });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const occurrence = listed.value[0];
    expect(occurrence.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixedStudent, kind: "fixo" }),
        expect.objectContaining({ id: makeupStudent, kind: "reposição" }),
        expect.objectContaining({ id: approved.id, kind: "experimental" }),
      ]),
    );
    expect(
      occurrence.participants.some(
        (participant) => participant.id === notifiedStudent,
      ),
    ).toBe(false);
    expect(occurrence.notices).toEqual([
      expect.objectContaining({
        studentId: notifiedStudent,
        status: "FALTA",
      }),
    ]);
  });
});
