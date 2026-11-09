import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, classSessions, creditTransactions, credits } from "../schema";
import {
  createStudents,
  createTestClass,
  clearTables,
} from "../../test/fixtures";
import { startPostgres, type PostgresTestInstance } from "../../test/postgres";
import {
  nextOccurrence,
  todayInStudio,
} from "../../modules/classes/domain/occurrences";

// Migrations do modulo de creditos (CRD-11, CRD-14): as tabelas novas, o
// status FALTA, as colunas de cancelamento e os indices unicos de origem.

/** O Drizzle embrulha o erro do Postgres: a mensagem original vem no cause. */
function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(" | ");
}

/** A insercao precisa ser recusada pelo indice unico esperado. */
async function expectUniqueViolation(
  run: Promise<unknown>,
  indexName: string,
): Promise<void> {
  const error = await run.then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(Error);
  expect(errorChain(error)).toContain(
    "duplicate key value violates unique constraint",
  );
  expect(errorChain(error)).toContain(indexName);
}

describe("credit schema", () => {
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

  async function setupOccurrence(): Promise<{
    slotId: string;
    sessionId: string;
    studentId: string;
  }> {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const [student] = await createStudents(pg.db, 1);
    const date = nextOccurrence({ weekday: 3 }, today);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: date })
      .returning();
    return { slotId, sessionId: session.id, studentId: student };
  }

  it("applies the credit tables on an empty postgres", async () => {
    const tables = await pg.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public'
            and table_name in ('credits', 'credit_transactions')
          order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "credit_transactions",
      "credits",
    ]);

    const types = await pg.db.execute<{ typname: string }>(
      sql`select typname from pg_type
          where typname in ('origem_credito', 'status_credito', 'cancelado_por')
          order by typname`,
    );
    expect(types.rows.map((row) => row.typname)).toEqual([
      "cancelado_por",
      "origem_credito",
      "status_credito",
    ]);

    const bookingStatuses = await pg.db.execute<{ enumlabel: string }>(
      sql`select enumlabel from pg_enum
          join pg_type on pg_type.oid = pg_enum.enumtypid
          where pg_type.typname = 'status_reserva'
          order by enumsortorder`,
    );
    expect(bookingStatuses.rows.map((row) => row.enumlabel)).toEqual([
      "ATIVA",
      "CANCELADA",
      "FALTA",
    ]);
  });

  it("stores the absence and the cancellation of a booking", async () => {
    const { sessionId, studentId } = await setupOccurrence();
    const cancelledAt = new Date("2026-11-09T12:00:00Z");

    const [absence] = await pg.db
      .insert(bookings)
      .values({
        studentId,
        classSessionId: sessionId,
        bookingType: "FIXED",
        status: "FALTA",
      })
      .returning();
    const [cancelled] = await pg.db
      .insert(bookings)
      .values({
        studentId,
        classSessionId: sessionId,
        bookingType: "MAKEUP",
        status: "CANCELADA",
        cancelledAt,
        cancelledBy: "ALUNO",
      })
      .returning();

    expect(absence.status).toBe("FALTA");
    expect(absence.cancelledAt).toBeNull();
    expect(absence.cancelledBy).toBeNull();
    expect(cancelled.status).toBe("CANCELADA");
    expect(cancelled.cancelledBy).toBe("ALUNO");
    expect(cancelled.cancelledAt?.toISOString()).toBe(cancelledAt.toISOString());

    // A origem da tabela booking segue valendo
    const stored = await pg.db
      .select()
      .from(bookings)
      .where(eq(bookings.classSessionId, sessionId));
    expect(stored).toHaveLength(2);
  });

  it("rejects two fixed bookings of the same student in the same occurrence", async () => {
    const { sessionId, studentId } = await setupOccurrence();

    await pg.db.insert(bookings).values({
      studentId,
      classSessionId: sessionId,
      bookingType: "FIXED",
    });

    await expectUniqueViolation(
      pg.db.insert(bookings).values({
        studentId,
        classSessionId: sessionId,
        bookingType: "FIXED",
      }),
      "bookings_aluno_ocorrencia_fixa_unica",
    );

    // O indice e parcial: so as reservas fixas entram na unicidade
    await pg.db.insert(bookings).values({
      studentId,
      classSessionId: sessionId,
      bookingType: "MAKEUP",
    });

    const stored = await pg.db.select().from(bookings);
    expect(stored).toHaveLength(2);
    expect(stored.filter((row) => row.bookingType === "FIXED")).toHaveLength(1);
  });

  it("rejects a second credit with the same source", async () => {
    const { sessionId, studentId } = await setupOccurrence();
    const generatedAt = new Date("2026-11-09T12:00:00Z");
    const expiresAt = new Date("2026-12-09T12:00:00Z");

    const [booking] = await pg.db
      .insert(bookings)
      .values({
        studentId,
        classSessionId: sessionId,
        bookingType: "FIXED",
      })
      .returning();

    const [credit] = await pg.db
      .insert(credits)
      .values({
        studentId,
        source: "CANCELAMENTO_AULA_FIXA",
        sourceBookingId: booking.id,
        generatedAt,
        expiresAt,
      })
      .returning();
    expect(credit.status).toBe("DISPONIVEL");
    expect(credit.expiresAt.toISOString()).toBe(expiresAt.toISOString());

    // Mesma origem (a reserva): recusado
    await expectUniqueViolation(
      pg.db.insert(credits).values({
        studentId,
        source: "CANCELAMENTO_AULA_FIXA",
        sourceBookingId: booking.id,
        generatedAt,
        expiresAt,
      }),
      "credits_origem_reserva_unica",
    );

    // Mesma origem (a ocorrencia): recusado
    await pg.db.insert(credits).values({
      studentId,
      source: "CANCELAMENTO_ESTUDIO",
      sourceSessionId: sessionId,
      generatedAt,
      expiresAt,
    });
    await expectUniqueViolation(
      pg.db.insert(credits).values({
        studentId,
        source: "CANCELAMENTO_ESTUDIO",
        sourceSessionId: sessionId,
        generatedAt,
        expiresAt,
      }),
      "credits_origem_sessao_unica",
    );

    // Concessao manual nao tem reserva de origem: o indice parcial nao pega
    await pg.db.insert(credits).values({
      studentId,
      source: "CONCESSAO_MANUAL",
      generatedAt,
      expiresAt,
    });
    await pg.db.insert(credits).values({
      studentId,
      source: "CONCESSAO_MANUAL",
      generatedAt,
      expiresAt,
    });

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(4);
  });

  it("records a credit transaction with the previous and the new status", async () => {
    const { studentId } = await setupOccurrence();
    const [credit] = await pg.db
      .insert(credits)
      .values({
        studentId,
        source: "CONCESSAO_MANUAL",
        generatedAt: new Date("2026-11-09T12:00:00Z"),
        expiresAt: new Date("2026-12-09T12:00:00Z"),
      })
      .returning();

    const [transaction] = await pg.db
      .insert(creditTransactions)
      .values({
        creditId: credit.id,
        action: "CONCESSAO",
        previousStatus: null,
        newStatus: "DISPONIVEL",
        reason: "Concessao inicial",
        adminLabel: "admin",
      })
      .returning();

    expect(transaction.creditId).toBe(credit.id);
    expect(transaction.previousStatus).toBeNull();
    expect(transaction.newStatus).toBe("DISPONIVEL");
    expect(transaction.reason).toBe("Concessao inicial");
    expect(transaction.adminLabel).toBe("admin");
    expect(transaction.createdAt).toBeInstanceOf(Date);
  });
});
