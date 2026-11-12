import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { experimentals } from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import { cancelExperimentalsForOccurrence } from "../cancellations";

// EXP-45, EXP-46: o cancelamento por ocorrencia mantem o direito ao
// reagendamento (CANCELADA_COM_DIREITO), nao mexe nos status terminais e
// libera a vaga da ocorrencia.

describe("experimental occurrence cancellation", () => {
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

  /** Turma de quarta com a ocorrencia do proximo dia da semana. */
  async function occurrence(capacity = 2) {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { slotId, date, sessionId: materialized.value.id };
  }

  async function statusOf(experimentalId: string): Promise<string> {
    const [row] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimentalId));
    return row?.status ?? "";
  }

  it("cancela pendente e aprovada com direito e deixa os terminais intactos", async () => {
    const { sessionId } = await occurrence();

    const pendente = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 98888-7777",
    });
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      phone: "(11) 97777-6666",
    });

    // Status terminais: nao tem direito a reagendamento (EXP-38)
    const recusada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "RECUSADA",
      phone: "(11) 96666-5555",
    });
    const convertida = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "CONVERTIDA",
      phone: "(11) 95555-4444",
    });
    const falta = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "FALTA",
      phone: "(11) 94444-3333",
    });
    const duplicada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "DUPLICADA",
      phone: "(11) 93333-2222",
    });

    const now = new Date("2026-11-20T12:00:00.000Z");
    const cancelled = await cancelExperimentalsForOccurrence(
      pg.db,
      sessionId,
      now,
    );

    expect(cancelled).toBe(2);
    expect(await statusOf(pendente.id)).toBe("CANCELADA_COM_DIREITO");
    expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");

    // O instante do cancelamento fica gravado
    const [row] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, aprovada.id));
    expect(row.cancelledAt?.toISOString()).toBe(now.toISOString());

    // Os status terminais ficam como estavam
    expect(await statusOf(recusada.id)).toBe("RECUSADA");
    expect(await statusOf(convertida.id)).toBe("CONVERTIDA");
    expect(await statusOf(falta.id)).toBe("FALTA");
    expect(await statusOf(duplicada.id)).toBe("DUPLICADA");
  });

  it("libera a vaga da ocorrencia com a mudanca de status", async () => {
    const { sessionId, date, slotId } = await occurrence(2);

    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
    });

    const composition = () =>
      getOccurrenceComposition(pg.db, {
        classSlotId: slotId,
        sessionId,
        date,
        capacity: 2,
      });

    const antes = await composition();
    expect(antes.experimentalCount).toBe(1);
    expect(antes.availableSpots).toBe(1);

    await cancelExperimentalsForOccurrence(pg.db, sessionId);

    // A aprovada virou cancelada com direito: e ela que ocupava a vaga
    expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");

    const depois = await composition();
    expect(depois.experimentalCount).toBe(0);
    expect(depois.availableSpots).toBe(2);
  });
});
