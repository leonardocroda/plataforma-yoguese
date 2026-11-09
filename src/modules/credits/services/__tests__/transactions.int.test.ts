import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creditTransactions, credits } from "../../../../db/schema";
import { createStudents, clearTables } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { recordCreditTransaction } from "../transactions";

// Transacoes de credito (CRD-15, CRD-16).

describe("credit transactions", () => {
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

  /** Credito criado direto no banco: a transacao e o que esta em teste. */
  async function createCredit(status: "DISPONIVEL" | "RESERVADO" = "DISPONIVEL") {
    const [student] = await createStudents(pg.db, 1);
    const [credit] = await pg.db
      .insert(credits)
      .values({
        studentId: student,
        source: "CONCESSAO_MANUAL",
        generatedAt: new Date("2026-11-09T12:00:00Z"),
        expiresAt: new Date("2026-12-09T12:00:00Z"),
        status,
      })
      .returning();
    return credit;
  }

  it("records the previous status, the new status, the reason and the responsible", async () => {
    const credit = await createCredit();
    const now = new Date("2026-11-09T15:00:00Z");

    const result = await recordCreditTransaction(
      pg.db,
      {
        creditId: credit.id,
        action: "RESERVA",
        previousStatus: "DISPONIVEL",
        newStatus: "RESERVADO",
        reason: "Reserva de reposicao",
        adminLabel: "admin",
        manual: false,
      },
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.creditId).toBe(credit.id);
      expect(result.value.action).toBe("RESERVA");
      expect(result.value.previousStatus).toBe("DISPONIVEL");
      expect(result.value.newStatus).toBe("RESERVADO");
      expect(result.value.reason).toBe("Reserva de reposicao");
      expect(result.value.adminLabel).toBe("admin");
      expect(result.value.createdAt.toISOString()).toBe(now.toISOString());
    }

    // O novo estado foi aplicado no credito
    const [stored] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    expect(stored.status).toBe("RESERVADO");

    const transactions = await pg.db.select().from(creditTransactions);
    expect(transactions).toHaveLength(1);
  });

  it("refuses a manual change without a reason", async () => {
    const credit = await createCredit("RESERVADO");

    const result = await recordCreditTransaction(pg.db, {
      creditId: credit.id,
      action: "CANCELAMENTO",
      previousStatus: "RESERVADO",
      newStatus: "CANCELADO",
      reason: "   ",
      adminLabel: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("motivo");
      expect(result.field).toBe("reason");
    }

    // Nada gravado: sem transacao e com o credito intacto
    const transactions = await pg.db.select().from(creditTransactions);
    expect(transactions).toHaveLength(0);
    const [unchanged] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    expect(unchanged.status).toBe("RESERVADO");
  });
});
