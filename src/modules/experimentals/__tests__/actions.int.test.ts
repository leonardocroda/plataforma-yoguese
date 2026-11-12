import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { experimentals } from "../../../db/schema";
import { createTestClass, clearTables } from "../../../test/fixtures";
import {
  authTestState,
  nextHeadersMock,
  resetAuthTestState,
  TEST_AUTH_SECRET,
} from "../../../test/auth";
import { PostgresTestInstance, startPostgres } from "../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../classes/domain/occurrences";
import { materializeSession } from "../../bookings/services/sessions";
import { requestExperimentalAction } from "../actions";

// EXP-06, EXP-29: a solicitacao publica nao exige sessao - a action
// funciona sem cookie e devolve o erro do servico para a tela.

vi.mock("next/headers", () => nextHeadersMock());

describe("experimental actions", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
    // As actions usam o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    resetAuthTestState();
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    const { db } = await import("../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
    await pg.pool.end();
    await pg.container.stop();
  });

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

  it("action publica cria solicitacao sem sessao", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(2);

    // Sem cookie de sessao: a solicitacao e do visitante
    authTestState.jar.clear();
    expect(authTestState.jar.size).toBe(0);

    const result = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDENTE");
    expect(result.value.paymentStatus).toBe("PENDENTE");
    expect(result.value.classSessionId).toBe(sessionId);
    expect(result.value.phoneNormalized).toBe("11988887777");

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.value.id);
  });

  it("action devolve o erro do servico para a tela", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);

    const semNome = await requestExperimentalAction({
      name: "  ",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(semNome.ok).toBe(false);
    if (!semNome.ok) {
      expect(semNome.field).toBe("name");
      expect(semNome.error).toContain("nome obrigatorio");
    }

    const semDeclaracao = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: false,
    });
    expect(semDeclaracao.ok).toBe(false);
    if (!semDeclaracao.ok) {
      expect(semDeclaracao.field).toBe("healthDeclaration");
    }

    // O telefone repetido volta com a mensagem de experimental existente
    const primeira = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(primeira.ok).toBe(true);

    const duplicada = await requestExperimentalAction({
      name: "Outra Maria",
      phone: "11988887777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(duplicada.ok).toBe(false);
    if (!duplicada.ok) {
      expect(duplicada.field).toBe("phone");
      expect(duplicada.error).toContain("ja existe uma aula experimental");
    }
  });
});

// Segredo do ambiente de teste: o jar de cookies do mock usa ele
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
