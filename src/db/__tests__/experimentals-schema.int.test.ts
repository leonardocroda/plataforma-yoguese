import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classSessions, experimentals, students } from "../schema";
import { clearTables, createTestClass } from "../../test/fixtures";
import { startPostgres, type PostgresTestInstance } from "../../test/postgres";

// Schema da experimental (EXP-06, EXP-14, EXP-16, EXP-48, EXP-50): tabela
// propria com os 8 status do PRD, o historico de reagendamento e a
// declaracao de saude copiada para a aluna convertida. O indice unico
// parcial garante uma solicitacao canonica por telefone sem impedir as
// tentativas DUPLICADA nem a nova solicitacao depois de uma RECUSADA.

const DECLARATION =
  "Declaro estar em condicoes de saude aptas a pratica de yoga e me comprometo a informar a professora qualquer condicao ou limitacao relevante para a realizacao das atividades.";

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

describe("experimentals schema", () => {
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

  /** Ocorrencia materializada: a experimental sempre aponta para uma. */
  async function createSession(): Promise<string> {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 4 });
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: "2026-12-02" })
      .returning();
    return session.id;
  }

  it("experimental guarda a declaracao e o instante da solicitacao", async () => {
    const sessionId = await createSession();
    const requestedAt = new Date("2026-11-12T13:45:00.000Z");

    const [created] = await pg.db
      .insert(experimentals)
      .values({
        name: "Maria Visitante",
        phone: "(11) 98888-7777",
        phoneNormalized: "11988887777",
        classSessionId: sessionId,
        healthDeclaration: DECLARATION,
        requestedAt,
      })
      .returning();

    // O texto aceito e o instante da solicitacao ficam gravados (EXP-16)
    expect(created.healthDeclaration).toBe(DECLARATION);
    expect(created.requestedAt.toISOString()).toBe(requestedAt.toISOString());
    // O telefone gravado e o normalizado: a identidade da duplicidade (EXP-10)
    expect(created.phone).toBe("(11) 98888-7777");
    expect(created.phoneNormalized).toBe("11988887777");
    // A solicitacao nasce pendente, com pagamento pendente (EXP-06)
    expect(created.status).toBe("PENDENTE");
    expect(created.paymentStatus).toBe("PENDENTE");
    expect(created.duplicateOfId).toBeNull();
    expect(created.approvedAt).toBeNull();
    expect(created.cancelledAt).toBeNull();
    expect(created.noShowAt).toBeNull();
    expect(created.attendedAt).toBeNull();
    expect(created.whatsappContactedAt).toBeNull();
    expect(created.convertedStudentId).toBeNull();

    // Os 8 status e os 4 status de pagamento do PRD 8.3 a 8.6 (EXP-32,
    // EXP-33): os enums sao a fonte dos termos exatos da tela.
    const statusEnum = await pg.db.execute<{ enumlabel: string }>(
      `select enumlabel from pg_enum
         join pg_type on pg_type.oid = pg_enum.enumtypid
        where pg_type.typname = 'status_experimental'
        order by enumsortorder`,
    );
    expect(statusEnum.rows.map((row) => row.enumlabel)).toEqual([
      "PENDENTE",
      "APROVADA",
      "RECUSADA",
      "CANCELADA_COM_DIREITO",
      "CANCELADA_SEM_DIREITO",
      "FALTA",
      "CONVERTIDA",
      "DUPLICADA",
    ]);

    const paymentEnum = await pg.db.execute<{ enumlabel: string }>(
      `select enumlabel from pg_enum
         join pg_type on pg_type.oid = pg_enum.enumtypid
        where pg_type.typname = 'status_pagamento_experimental'
        order by enumsortorder`,
    );
    expect(paymentEnum.rows.map((row) => row.enumlabel)).toEqual([
      "PENDENTE",
      "PAGO",
      "ISENTO",
      "REEMBOLSADO",
    ]);

    // A ocorrencia e obrigatoria: a experimental nao existe sem ela
    const error = await pg.db
      .insert(experimentals)
      .values({
        name: "Sem Ocorrencia",
        phone: "11988880000",
        phoneNormalized: "11988880000",
        classSessionId: "00000000-0000-0000-0000-000000000000",
        healthDeclaration: DECLARATION,
        requestedAt,
      })
      .then(
        () => null,
        (reason: unknown) => reason,
      );
    expect(error).toBeInstanceOf(Error);
    expect(errorChain(error)).toContain(
      "experimentals_class_session_id_class_sessions_id_fk",
    );
  });

  it("indice parcial aceita uma canonica e varias duplicadas", async () => {
    const sessionId = await createSession();
    const base = {
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
      classSessionId: sessionId,
      healthDeclaration: DECLARATION,
      requestedAt: new Date("2026-11-12T13:45:00.000Z"),
    };

    // A solicitacao canonica do telefone entra
    const [canonical] = await pg.db.insert(experimentals).values(base).returning();
    expect(canonical.status).toBe("PENDENTE");

    // A segunda canonica do mesmo telefone e recusada pelo indice
    const error = await pg.db
      .insert(experimentals)
      .values({ ...base, name: "Outra Visita" })
      .then(
        () => null,
        (reason: unknown) => reason,
      );
    expect(error).toBeInstanceOf(Error);
    expect(errorChain(error)).toContain(
      "duplicate key value violates unique constraint",
    );
    expect(errorChain(error)).toContain("experimentals_telefone_unico");

    // As tentativas DUPLICADA do mesmo telefone sao varias (EXP-09): elas
    // ficam fora do indice, ligadas a solicitacao existente
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await pg.db.insert(experimentals).values({
        ...base,
        name: `Tentativa ${attempt}`,
        status: "DUPLICADA",
        duplicateOfId: canonical.id,
      });
    }

    // A recusada tambem fica fora do indice: o telefone volta a ficar livre
    // (EXP-48)
    await pg.db.insert(experimentals).values({
      ...base,
      name: "Recusada",
      status: "RECUSADA",
    });

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.status === "DUPLICADA")).toHaveLength(3);
    expect(rows.filter((row) => row.status === "RECUSADA")).toHaveLength(1);
    expect(
      rows
        .filter((row) => row.status === "DUPLICADA")
        .every((row) => row.duplicateOfId === canonical.id),
    ).toBe(true);
  });

  it("student guarda a declaracao de saude copiada", async () => {
    const acceptedAt = new Date("2026-11-12T13:45:00.000Z");

    const [created] = await pg.db
      .insert(students)
      .values({
        name: "Maria Convertida",
        phone: "11988887777",
        email: "maria-convertida@teste.com",
        birthDate: "1990-05-10",
        healthDeclaration: DECLARATION,
        healthDeclarationAcceptedAt: acceptedAt,
      })
      .returning();

    // A conversao copia a declaracao aceita na experimental (EXP-50)
    expect(created.healthDeclaration).toBe(DECLARATION);
    expect(created.healthDeclarationAcceptedAt?.toISOString()).toBe(
      acceptedAt.toISOString(),
    );

    // O cadastro comum fica com as duas colunas nulas
    const [common] = await pg.db
      .insert(students)
      .values({
        name: "Aluna Comum",
        phone: "11988880000",
        email: "aluna-comum@teste.com",
        birthDate: "1990-05-10",
      })
      .returning();
    expect(common.healthDeclaration).toBeNull();
    expect(common.healthDeclarationAcceptedAt).toBeNull();
  });
});
