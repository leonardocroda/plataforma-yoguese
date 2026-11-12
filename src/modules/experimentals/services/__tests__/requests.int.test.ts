import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { experimentals, holidays } from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import { HEALTH_DECLARATION } from "../../domain/validators";
import {
  createExperimentalRequest,
  type ExperimentalRequestInput,
} from "../experimentals";

// EXP-06 a EXP-16: a solicitacao publica nasce pendente, nao ocupa vaga,
// respeita a duplicidade por telefone normalizado e recusa ocorrencia
// invalida.

describe("experimental requests", () => {
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

  /** Turma com a modalidade e a ocorrencia do proximo dia da semana. */
  async function occurrence(capacity = 2) {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity,
    });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { classTypeId, slotId, date, sessionId: materialized.value.id };
  }

  function requestData(
    input: Partial<ExperimentalRequestInput> & {
      classTypeId: string;
      classSlotId: string;
      date: string;
    },
  ): ExperimentalRequestInput {
    return {
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      declarationAccepted: true,
      ...input,
    };
  }

  it("cria solicitacao pendente sem ocupar vaga", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(2);
    const now = new Date("2026-11-12T13:45:00.000Z");

    const result = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date }),
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDENTE");
    expect(result.value.paymentStatus).toBe("PENDENTE");
    expect(result.value.classSessionId).toBe(sessionId);
    expect(result.value.healthDeclaration).toBe(HEALTH_DECLARATION);
    expect(result.value.requestedAt.toISOString()).toBe(now.toISOString());
    expect(result.value.phoneNormalized).toBe("11988887777");
    expect(result.value.duplicateOfId).toBeNull();

    // WHILE pendente, ela nao ocupa vaga (EXP-11)
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 2,
    });
    expect(composition.experimentalCount).toBe(0);
    expect(composition.availableSpots).toBe(2);
  });

  it("recusa campo obrigatorio e ocorrencia invalida", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const semNome = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date, name: "  " }),
    );
    expect(semNome.ok).toBe(false);
    if (!semNome.ok) expect(semNome.field).toBe("name");

    const telefoneInvalido = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date, phone: "123" }),
    );
    expect(telefoneInvalido.ok).toBe(false);
    if (!telefoneInvalido.ok) expect(telefoneInvalido.field).toBe("phone");

    const semDeclaracao = await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date,
        declarationAccepted: false,
      }),
    );
    expect(semDeclaracao.ok).toBe(false);
    if (!semDeclaracao.ok) {
      expect(semDeclaracao.field).toBe("healthDeclaration");
    }

    // Ocorrencia passada: nao existe para agendamento (EXP-15)
    const passada = await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date: addDays(today, -7),
      }),
    );
    expect(passada.ok).toBe(false);
    if (!passada.ok) expect(passada.field).toBe("date");

    // Nada foi gravado
    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(0);
  });

  it("bloqueia telefone com experimental anterior mesmo com mascara diferente", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const first = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date }),
    );
    expect(first.ok).toBe(true);

    // Mesma pessoa, outra mascara
    const second = await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date,
        name: "Outra Maria",
        phone: "11 98888 7777",
      }),
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("ja existe uma aula experimental");
      expect(second.field).toBe("phone");
    }
  });

  it("registra a tentativa bloqueada como duplicada", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const first = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date }),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date,
        name: "Outra Maria",
        phone: "+55 11 98888-7777",
      }),
    );

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(2);

    const canonical = rows.find((row) => row.status === "PENDENTE");
    const duplicate = rows.find((row) => row.status === "DUPLICADA");
    expect(canonical).toBeDefined();
    expect(duplicate).toBeDefined();
    // A tentativa fica ligada a solicitacao existente, com o telefone
    // normalizado
    expect(duplicate?.duplicateOfId).toBe(canonical?.id);
    expect(duplicate?.phoneNormalized).toBe("11988887777");
    expect(duplicate?.healthDeclaration).toBe(HEALTH_DECLARATION);
  });

  it("recusada libera o telefone para nova solicitacao", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const first = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date }),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // O studio recusa a solicitacao: o telefone volta a ficar livre
    await pg.db
      .update(experimentals)
      .set({ status: "RECUSADA" })
      .where(eq(experimentals.id, first.value.id));

    const second = await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date,
        name: "Maria de novo",
        phone: "11988887777",
      }),
    );

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.status).toBe("PENDENTE");
      expect(second.value.id).not.toBe(first.value.id);
    }

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === "PENDENTE")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "RECUSADA")).toHaveLength(1);
  });

  it("duas submissoes concorrentes geram uma solicitacao e uma duplicada", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const results = await Promise.all([
      createExperimentalRequest(
        pg.db,
        requestData({ classTypeId, classSlotId: slotId, date }),
      ),
      createExperimentalRequest(
        pg.db,
        requestData({
          classTypeId,
          classSlotId: slotId,
          date,
          name: "Mesma pessoa",
          phone: "11988887777",
        }),
      ),
    ]);

    const ok = results.filter((result) => result.ok);
    const refused = results.filter((result) => !result.ok);
    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(2);

    const canonical = rows.find((row) => row.status === "PENDENTE");
    const duplicate = rows.find((row) => row.status === "DUPLICADA");
    expect(canonical).toBeDefined();
    expect(duplicate).toBeDefined();
    expect(duplicate?.duplicateOfId).toBe(canonical?.id);
  });

  it("nao cria solicitacao sem vaga ou em ocorrencia bloqueada", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(1);

    // A unica vaga da ocorrencia ja esta ocupada por uma aprovada
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
    });

    const semVaga = await createExperimentalRequest(
      pg.db,
      requestData({ classTypeId, classSlotId: slotId, date }),
    );
    expect(semVaga.ok).toBe(false);
    if (!semVaga.ok) {
      expect(semVaga.error).toContain("sem vaga");
    }

    // Ocorrencia bloqueada por feriado
    await pg.db.insert(holidays).values({ date, name: "Feriado" });
    const bloqueada = await createExperimentalRequest(
      pg.db,
      requestData({
        classTypeId,
        classSlotId: slotId,
        date,
        phone: "11977776666",
      }),
    );
    expect(bloqueada.ok).toBe(false);
    if (!bloqueada.ok) {
      expect(bloqueada.error).toContain("bloqueada");
    }

    // Nenhuma solicitacao foi criada
    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("APROVADA");
  });
});
