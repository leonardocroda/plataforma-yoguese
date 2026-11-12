import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, credits, experimentals } from "../../../../db/schema";
import {
  createExperimental,
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
import { createEnrollment } from "../../../students/services/enrollments";
import { materializeSession } from "../../../bookings/services/sessions";
import { bookMakeupByStudent } from "../makeups";
import { cancelOccurrenceByStudio } from "../cancellations";

// EXP-45: o cancelamento de ocorrencia pelo estudio cancela a experimental
// da ocorrencia com direito a reagendamento, sem mexer no comportamento
// existente de reservas e creditos.

describe("studio cancellation with experimentals", () => {
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

  /** Turma de quarta com a ocorrencia do proximo dia da semana. */
  async function occurrence(capacity = 8) {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity });
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { slotId, sessionId: materialized.value.id };
  }

  async function statusOf(experimentalId: string): Promise<string> {
    const [row] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimentalId));
    return row?.status ?? "";
  }

  it("cancela a experimental da ocorrencia com direito", async () => {
    const { sessionId } = await occurrence();

    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
    });
    const pendente = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      name: "Joana Visitante",
      phone: "(11) 97777-6666",
    });

    const now = new Date("2026-11-09T15:00:00.000Z");
    const result = await cancelOccurrenceByStudio(
      pg.db,
      { classSessionId: sessionId },
      now,
    );
    expect(result.ok).toBe(true);

    // A experimental da ocorrencia cancelada vira cancelada com direito
    expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");
    expect(await statusOf(pendente.id)).toBe("CANCELADA_COM_DIREITO");

    const [row] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, aprovada.id));
    expect(row.cancelledAt?.toISOString()).toBe(now.toISOString());
  });

  it("nao mexe nas reservas e creditos da ocorrencia", async () => {
    const { slotId, sessionId } = await occurrence();
    const [makeupStudent, fixedStudent] = await createStudents(pg.db, 2);

    // Uma reposicao com credito reservado e uma aluna fixa na turma
    const creditId = await grantTestCredit(pg.db, makeupStudent);
    const booked = await bookMakeupByStudent(pg.db, {
      studentId: makeupStudent,
      classSlotId: slotId,
      date,
      creditId,
    });
    expect(booked.ok).toBe(true);

    const enrollment = await createEnrollment(pg.db, {
      studentId: fixedStudent,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    const result = await cancelOccurrenceByStudio(
      pg.db,
      { classSessionId: sessionId },
      new Date("2026-11-09T15:00:00.000Z"),
    );
    expect(result.ok).toBe(true);

    // A reserva ativa e cancelada pelo estudio
    const bookingRows = await pg.db.select().from(bookings);
    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0].status).toBe("CANCELADA");
    expect(bookingRows[0].cancelledBy).toBe("ESTUDIO");

    // O credito da reposicao volta a DISPONIVEL e a aluna fixa recebe o
    // credito do studio
    const creditRows = await pg.db.select().from(credits);
    const reposicao = creditRows.find((row) => row.id === creditId);
    expect(reposicao?.status).toBe("DISPONIVEL");
    const doStudio = creditRows.filter(
      (row) => row.source === "CANCELAMENTO_ESTUDIO",
    );
    expect(doStudio).toHaveLength(1);
    expect(doStudio[0].studentId).toBe(fixedStudent);
  });
});
