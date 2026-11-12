import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { experimentals } from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  nextOccurrence,
  studioDateTimeToInstant,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import {
  cancelExperimental,
  createExperimentalRequest,
  registerNoShow,
  rescheduleExperimental,
} from "../experimentals";

// EXP-34 a EXP-38 e EXP-47: a regra das 24 horas decide o direito ao
// reagendamento, o cancelamento depois do inicio e recusado, a falta so
// depois do inicio e o telefone com cancelamento com direito continua
// bloqueado.

describe("experimental cancellation", () => {
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

  /** Turma com a ocorrencia e o instante do inicio da aula. */
  async function occurrence(capacity = 2, weekday = 3) {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday,
      capacity,
      startTime: "19:00:00",
    });
    const date = nextOccurrence({ weekday }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return {
      classTypeId,
      slotId,
      date,
      sessionId: materialized.value.id,
      start: studioDateTimeToInstant(date, "19:00:00"),
    };
  }

  it("cancelamento com 24h exatas vira cancelada com direito", async () => {
    const { sessionId, slotId, date, start } = await occurrence();
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
    });

    // Exatamente 24 horas antes do inicio
    const now = new Date(start.getTime() - 24 * 3_600_000);
    const result = await cancelExperimental(
      pg.db,
      { experimentalId: aprovada.id },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CANCELADA_COM_DIREITO");
    expect(result.value.cancelledAt?.toISOString()).toBe(now.toISOString());

    // A vaga volta: so a aprovada ocupa
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 2,
    });
    expect(composition.experimentalCount).toBe(0);
    expect(composition.availableSpots).toBe(2);

    // O direito ao reagendamento sobrevive: o mesmo registro volta a
    // ser aprovado em outra ocorrencia com vaga
    const destino = await occurrence(2, 4);
    const reagendamento = await rescheduleExperimental(pg.db, {
      experimentalId: aprovada.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });
    expect(reagendamento.ok).toBe(true);
    if (!reagendamento.ok) return;
    expect(reagendamento.value.status).toBe("APROVADA");
    expect(reagendamento.value.classSessionId).toBe(destino.sessionId);
  });

  it("cancelamento com 23h59 vira cancelada sem direito", async () => {
    const { sessionId, start } = await occurrence();
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
    });

    // 23h59 antes do inicio: o direito acaba
    const now = new Date(start.getTime() - 23 * 3_600_000 - 59 * 60_000);
    const result = await cancelExperimental(
      pg.db,
      { experimentalId: aprovada.id },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CANCELADA_SEM_DIREITO");
    expect(result.value.cancelledAt?.toISOString()).toBe(now.toISOString());

    // O direito acabou: o mesmo registro nao pode ser reagendado
    const destino = await occurrence(2, 4);
    const reagendamento = await rescheduleExperimental(pg.db, {
      experimentalId: aprovada.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });
    expect(reagendamento.ok).toBe(false);
    if (!reagendamento.ok) {
      expect(reagendamento.error).toContain("reagendada");
    }

    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, aprovada.id));
    expect(registro.status).toBe("CANCELADA_SEM_DIREITO");
  });

  it("cancelamento depois do inicio e recusado", async () => {
    const { sessionId, start } = await occurrence();
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
    });

    const now = new Date(start.getTime() + 60_000);
    const result = await cancelExperimental(
      pg.db,
      { experimentalId: aprovada.id },
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // A recusa aponta o registro de falta como caminho
      expect(result.error).toContain("falta");
    }

    // A solicitacao continua aprovada
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, aprovada.id));
    expect(registro.status).toBe("APROVADA");
    expect(registro.cancelledAt).toBeNull();
  });

  it("falta depois do inicio encerra o direito e libera a vaga", async () => {
    const { sessionId, slotId, date, start } = await occurrence();
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
    });

    const now = new Date(start.getTime() + 30 * 60_000);
    const result = await registerNoShow(
      pg.db,
      { experimentalId: aprovada.id },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("FALTA");
    expect(result.value.noShowAt?.toISOString()).toBe(now.toISOString());

    // A vaga volta
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 2,
    });
    expect(composition.experimentalCount).toBe(0);
    expect(composition.availableSpots).toBe(2);

    // O direito acabou: a falta nao pode ser reagendada
    const destino = await occurrence(2, 4);
    const reagendamento = await rescheduleExperimental(pg.db, {
      experimentalId: aprovada.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });
    expect(reagendamento.ok).toBe(false);
  });

  it("falta antes do inicio e recusada", async () => {
    const { sessionId, start } = await occurrence();
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
    });

    const now = new Date(start.getTime() - 60 * 60_000);
    const result = await registerNoShow(
      pg.db,
      { experimentalId: aprovada.id },
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("depois do inicio");
    }

    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, aprovada.id));
    expect(registro.status).toBe("APROVADA");
    expect(registro.noShowAt).toBeNull();
  });

  it("status terminal recusa cancelamento", async () => {
    const { sessionId } = await occurrence();

    const canonica = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 91111-1111",
    });

    const terminais = [
      "RECUSADA",
      "CANCELADA_SEM_DIREITO",
      "FALTA",
      "CONVERTIDA",
      "DUPLICADA",
    ] as const;

    let index = 0;
    for (const status of terminais) {
      index += 1;
      const experimental = await createExperimental(pg.db, {
        classSessionId: sessionId,
        status,
        phone: `(11) 90000-000${index}`,
        duplicateOfId: status === "DUPLICADA" ? canonica.id : null,
      });

      const result = await cancelExperimental(pg.db, {
        experimentalId: experimental.id,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // A tentativa duplicada e somente leitura; os demais status
        // terminais recusam o cancelamento
        expect(result.error).toContain(
          status === "DUPLICADA" ? "somente leitura" : "cancelamento",
        );
      }
    }

    // Nenhum status mudou
    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(6);
    expect(
      rows.filter((row) => row.cancelledAt !== null),
    ).toHaveLength(0);
  });

  it("nova solicitacao apos cancelamento com direito e bloqueada", async () => {
    const { classTypeId, slotId, date, sessionId, start } = await occurrence();
    const cancelada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
    });

    const now = new Date(start.getTime() - 24 * 3_600_000);
    const cancelamento = await cancelExperimental(
      pg.db,
      { experimentalId: cancelada.id },
      now,
    );
    expect(cancelamento.ok).toBe(true);
    if (!cancelamento.ok) return;
    expect(cancelamento.value.status).toBe("CANCELADA_COM_DIREITO");

    // O direito nao abre uma solicitacao nova: o telefone continua
    // bloqueado
    const nova = await createExperimentalRequest(pg.db, {
      name: "Maria de novo",
      phone: "11988887777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });

    expect(nova.ok).toBe(false);
    if (!nova.ok) {
      expect(nova.error).toContain("ja existe uma aula experimental");
      expect(nova.field).toBe("phone");
    }
  });
});
