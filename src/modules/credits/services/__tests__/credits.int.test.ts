import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  creditSourceEnum,
  creditStatusEnum,
  credits,
} from "../../../../db/schema";
import {
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { bookMakeupByAdmin } from "../makeups";
import {
  cancelCredit,
  grantCredit,
  listCreditsExpiringSoon,
  listStudentCredits,
  reserveCredit,
  returnCredit,
} from "../credits";

// Ledger de creditos (CRD-11 a CRD-14, CRD-34 a CRD-38).

const DAY_MS = 24 * 60 * 60 * 1000;

describe("credits", () => {
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

  async function setupOccurrence(): Promise<{ sessionId: string }> {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: date })
      .returning();
    return { sessionId: session.id };
  }

  it("grants a manual credit with a 30 day expiry and a transaction", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    const result = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Bonificacao do estudio",
        adminLabel: "admin",
      },
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const credit = result.value.credit;
      expect(credit.studentId).toBe(student);
      expect(credit.source).toBe("CONCESSAO_MANUAL");
      expect(credit.status).toBe("DISPONIVEL");
      expect(credit.sourceBookingId).toBeNull();
      expect(credit.sourceSessionId).toBeNull();
      expect(credit.usedBookingId).toBeNull();
      expect(credit.generatedAt.toISOString()).toBe(now.toISOString());
      // Validade de 30 dias contados da geracao (CRD-11)
      expect(credit.expiresAt.getTime() - credit.generatedAt.getTime()).toBe(
        30 * DAY_MS,
      );

      const transaction = result.value.transaction;
      expect(transaction.creditId).toBe(credit.id);
      expect(transaction.action).toBe("CONCESSAO");
      expect(transaction.previousStatus).toBeNull();
      expect(transaction.newStatus).toBe("DISPONIVEL");
      expect(transaction.reason).toBe("Bonificacao do estudio");
      expect(transaction.adminLabel).toBe("admin");
      expect(transaction.createdAt.toISOString()).toBe(now.toISOString());
    }
  });

  it("keeps the documented origins and statuses", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    expect(creditSourceEnum.enumValues).toEqual([
      "CANCELAMENTO_AULA_FIXA",
      "CANCELAMENTO_ESTUDIO",
      "CONCESSAO_MANUAL",
    ]);
    expect(creditStatusEnum.enumValues).toEqual([
      "DISPONIVEL",
      "RESERVADO",
      "UTILIZADO",
      "VENCIDO",
      "CANCELADO",
    ]);

    for (const source of creditSourceEnum.enumValues) {
      const granted = await grantCredit(
        pg.db,
        {
          studentId: student,
          source,
          reason: "Origem documentada",
          adminLabel: "admin",
        },
        now,
      );
      expect(granted.ok).toBe(true);
    }

    const stored = await pg.db.select().from(credits);
    expect(stored.map((row) => row.source).sort()).toEqual([
      "CANCELAMENTO_AULA_FIXA",
      "CANCELAMENTO_ESTUDIO",
      "CONCESSAO_MANUAL",
    ]);
    expect(stored.every((row) => row.status === "DISPONIVEL")).toBe(true);
  });

  it("blocks the use of an expired credit", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Credito antigo",
        adminLabel: "admin",
        generatedAt: new Date("2026-10-01T15:00:00Z"),
      },
      now,
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;

    const reservation = await reserveCredit(
      pg.db,
      { creditId, studentId: student },
      now,
    );
    expect(reservation.ok).toBe(false);
    if (!reservation.ok) {
      expect(reservation.error).toContain("vencido");
    }

    // O credito nao foi reservado
    const [stored] = await pg.db
      .select()
      .from(credits)
      .where(eq(credits.id, creditId));
    expect(stored.status).toBe("DISPONIVEL");

    // Na leitura ele aparece como VENCIDO (CRD-13)
    const listed = await listStudentCredits(pg.db, student, now);
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe("VENCIDO");
  });

  it("refuses a second credit for the same origin", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);
    const { sessionId } = await setupOccurrence();

    const first = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CANCELAMENTO_ESTUDIO",
        sourceSessionId: sessionId,
        reason: "Aula cancelada pelo estudio",
        adminLabel: "admin",
      },
      now,
    );
    expect(first.ok).toBe(true);

    const second = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CANCELAMENTO_ESTUDIO",
        sourceSessionId: sessionId,
        reason: "Aula cancelada pelo estudio",
        adminLabel: "admin",
      },
      now,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("mesma origem");
    }

    const stored = await pg.db.select().from(credits);
    expect(stored).toHaveLength(1);
  });

  it("returns a credit to DISPONIVEL keeping the original expiry", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Bonificacao do estudio",
        adminLabel: "admin",
      },
      now,
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;
    const expiresAt = granted.value.credit.expiresAt.toISOString();

    const reserved = await reserveCredit(
      pg.db,
      { creditId, studentId: student },
      now,
    );
    expect(reserved.ok).toBe(true);
    if (reserved.ok) {
      expect(reserved.value.credit.status).toBe("RESERVADO");
    }

    const returned = await returnCredit(
      pg.db,
      {
        creditId,
        reason: "Reposicao devolvida",
        adminLabel: "admin",
      },
      now,
    );
    expect(returned.ok).toBe(true);
    if (returned.ok) {
      expect(returned.value.credit.status).toBe("DISPONIVEL");
      expect(returned.value.credit.expiresAt.toISOString()).toBe(expiresAt);
      expect(returned.value.transaction.previousStatus).toBe("RESERVADO");
      expect(returned.value.transaction.newStatus).toBe("DISPONIVEL");
      expect(returned.value.transaction.reason).toBe("Reposicao devolvida");
    }
  });

  it("cancels a credit and keeps the history", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const later = new Date("2026-11-09T16:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    const granted = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Bonificacao do estudio",
        adminLabel: "admin",
      },
      now,
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    const cancelled = await cancelCredit(
      pg.db,
      {
        creditId: granted.value.credit.id,
        reason: "Credito indevido",
        adminLabel: "admin",
      },
      later,
    );
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.value.credit.status).toBe("CANCELADO");
      expect(cancelled.value.transaction.previousStatus).toBe("DISPONIVEL");
      expect(cancelled.value.transaction.newStatus).toBe("CANCELADO");
      expect(cancelled.value.transaction.reason).toBe("Credito indevido");
    }

    const listed = await listStudentCredits(pg.db, student, later);
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe("CANCELADO");
    expect(listed[0].transactions.map((row) => row.action)).toEqual([
      "CONCESSAO",
      "CANCELAMENTO",
    ]);
  });

  it("lists the credits of a student with their transactions", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const later = new Date("2026-11-09T16:00:00Z");
    const [student, other] = await createStudents(pg.db, 2);

    const first = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Primeira concessao",
        adminLabel: "admin",
      },
      now,
    );
    const second = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Segunda concessao",
        adminLabel: "admin",
      },
      later,
    );
    await grantCredit(
      pg.db,
      {
        studentId: other,
        source: "CONCESSAO_MANUAL",
        reason: "Concessao de outro aluno",
        adminLabel: "admin",
      },
      later,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const listed = await listStudentCredits(pg.db, student, later);
    expect(listed).toHaveLength(2);

    // O mais recente vem primeiro
    expect(listed[0].id).toBe(second.ok ? second.value.credit.id : "");
    expect(listed[0].studentId).toBe(student);
    expect(listed[0].source).toBe("CONCESSAO_MANUAL");
    expect(listed[0].status).toBe("DISPONIVEL");
    expect(listed[0].generatedAt).toBeInstanceOf(Date);
    expect(listed[0].expiresAt).toBeInstanceOf(Date);
    expect(listed[0].transactions).toHaveLength(1);
    expect(listed[0].transactions[0].reason).toBe("Segunda concessao");

    const older = listed.find((row) => row.id === (first.ok ? first.value.credit.id : ""));
    expect(older?.transactions[0].reason).toBe("Primeira concessao");
  });

  it("lists the available credits expiring in the next 7 days", async () => {
    const now = new Date("2026-11-09T15:00:00Z");
    const [student] = await createStudents(pg.db, 1);

    // Vence em 3 dias
    const soon = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Vence logo",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 27 * DAY_MS),
      },
      now,
    );
    // Vence em 20 dias
    await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Vence depois",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 10 * DAY_MS),
      },
      now,
    );
    // Ja vencido
    await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Ja vencido",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 40 * DAY_MS),
      },
      now,
    );
    // Vence em exatamente 7 dias: a borda entra
    const onLimit = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Vence na borda",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 23 * DAY_MS),
      },
      now,
    );
    // Vence 1 segundo depois da borda: fica de fora
    await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Vence depois da borda",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 23 * DAY_MS + 1000),
      },
      now,
    );
    // Vence em 2 dias, mas esta reservado
    const reserved = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Reservado",
        adminLabel: "admin",
        generatedAt: new Date(now.getTime() - 28 * DAY_MS),
      },
      now,
    );
    expect(reserved.ok).toBe(true);
    if (reserved.ok) {
      const locked = await reserveCredit(
        pg.db,
        { creditId: reserved.value.credit.id, studentId: student },
        now,
      );
      expect(locked.ok).toBe(true);
    }

    const expiring = await listCreditsExpiringSoon(pg.db, now);
    expect(expiring).toHaveLength(2);
    expect(expiring.map((credit) => credit.id)).toContain(
      soon.ok ? soon.value.credit.id : "",
    );
    expect(expiring.map((credit) => credit.id)).toContain(
      onLimit.ok ? onLimit.value.credit.id : "",
    );
  });

  it("settles a reserved credit as UTILIZADO after the class ends", async () => {
    // A reposicao acontece numa data fixa: 10 de novembro, das 19h as 20h
    const { slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    const date = "2026-11-10";
    const [student] = await createStudents(pg.db, 1);
    const granted = await grantCredit(
      pg.db,
      {
        studentId: student,
        source: "CONCESSAO_MANUAL",
        reason: "Credito da reposicao",
        adminLabel: "admin",
      },
      new Date("2026-11-09T12:00:00Z"),
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const creditId = granted.value.credit.id;

    const booked = await bookMakeupByAdmin(
      pg.db,
      { studentId: student, classSlotId: slotId, date, creditId },
      new Date("2026-11-09T12:00:00Z"),
    );
    expect(booked.ok).toBe(true);

    // Antes do fim da aula o credito segue RESERVADO (19h59 no fuso do estudio)
    const beforeEnd = await listStudentCredits(
      pg.db,
      student,
      new Date("2026-11-10T22:59:00Z"),
    );
    expect(beforeEnd[0].status).toBe("RESERVADO");

    // Passado o fim da aula o credito vira UTILIZADO, sem etapa manual
    const afterEnd = await listStudentCredits(
      pg.db,
      student,
      new Date("2026-11-10T23:01:00Z"),
    );
    expect(afterEnd[0].status).toBe("UTILIZADO");
    expect(afterEnd[0].persistedStatus).toBe("RESERVADO");
  });
});
