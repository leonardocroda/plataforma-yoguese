import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { experimentalReschedules, experimentals } from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import {
  createExperimentalRequest,
  rescheduleExperimental,
} from "../experimentals";

// EXP-39, EXP-40, EXP-47: o direito ao reagendamento sai da cancelada com
// direito, volta a aprovada em outra ocorrencia com vaga e so se exerce no
// mesmo registro.

describe("experimental reschedule", () => {
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

  /** Turma com a modalidade e a ocorrencia do dia da semana informado. */
  async function occurrence(weekday: number, capacity = 2) {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday,
      capacity,
    });
    const date = nextOccurrence({ weekday }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { classTypeId, slotId, date, sessionId: materialized.value.id };
  }

  it("reagenda cancelada com direito com vaga e grava a ocorrencia anterior", async () => {
    const origem = await occurrence(3);
    const destino = await occurrence(4);

    const cancelada = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "CANCELADA_COM_DIREITO",
      phone: "(11) 98888-7777",
    });
    const now = new Date();

    const result = await rescheduleExperimental(
      pg.db,
      {
        experimentalId: cancelada.id,
        classSlotId: destino.slotId,
        date: destino.date,
      },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("APROVADA");
    expect(result.value.classSessionId).toBe(destino.sessionId);
    expect(result.value.approvedAt?.toISOString()).toBe(now.toISOString());

    // A ocorrencia anterior fica no historico de reagendamentos
    const history = await pg.db.select().from(experimentalReschedules);
    expect(history).toHaveLength(1);
    expect(history[0].experimentalId).toBe(cancelada.id);
    expect(history[0].fromSessionId).toBe(origem.sessionId);
    expect(history[0].toSessionId).toBe(destino.sessionId);
    expect(history[0].rescheduledAt.toISOString()).toBe(now.toISOString());

    // A vaga saiu da ocorrencia antiga e entrou na nova
    const composicaoOrigem = await getOccurrenceComposition(pg.db, {
      classSlotId: origem.slotId,
      sessionId: origem.sessionId,
      date: origem.date,
      capacity: 2,
    });
    expect(composicaoOrigem.experimentalCount).toBe(0);
    expect(composicaoOrigem.availableSpots).toBe(2);

    const composicaoDestino = await getOccurrenceComposition(pg.db, {
      classSlotId: destino.slotId,
      sessionId: destino.sessionId,
      date: destino.date,
      capacity: 2,
    });
    expect(composicaoDestino.experimentalCount).toBe(1);
    expect(composicaoDestino.availableSpots).toBe(1);
  });

  it("reagendamento sem vaga recusa e mantem o direito", async () => {
    const origem = await occurrence(3);
    const lotada = await occurrence(5, 1);

    // A unica vaga da outra ocorrencia esta ocupada por uma aprovada
    await createExperimental(pg.db, {
      classSessionId: lotada.sessionId,
      status: "APROVADA",
      phone: "(11) 96666-5555",
    });

    const cancelada = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "CANCELADA_COM_DIREITO",
      phone: "(11) 98888-7777",
    });

    const result = await rescheduleExperimental(pg.db, {
      experimentalId: cancelada.id,
      classSlotId: lotada.slotId,
      date: lotada.date,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sem vaga");
    }

    // O status e o direito continuam como estavam
    const rows = await pg.db.select().from(experimentalReschedules);
    expect(rows).toHaveLength(0);

    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, cancelada.id));
    expect(registro.status).toBe("CANCELADA_COM_DIREITO");
    expect(registro.classSessionId).toBe(origem.sessionId);
    expect(registro.approvedAt).toBeNull();
  });

  it("reagendar status terminal e recusado", async () => {
    const origem = await occurrence(3);
    const destino = await occurrence(4);

    // A canonica a que a tentativa duplicada se liga
    const canonica = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "PENDENTE",
      phone: "(11) 91111-1111",
    });

    const statusTerminal = [
      "RECUSADA",
      "CANCELADA_SEM_DIREITO",
      "FALTA",
      "CONVERTIDA",
      "DUPLICADA",
      "PENDENTE",
      "APROVADA",
    ] as const;

    let index = 0;
    for (const status of statusTerminal) {
      index += 1;
      const experimental = await createExperimental(pg.db, {
        classSessionId: origem.sessionId,
        status,
        phone: `(11) 90000-000${index}`,
        duplicateOfId: status === "DUPLICADA" ? canonica.id : null,
      });

      const result = await rescheduleExperimental(pg.db, {
        experimentalId: experimental.id,
        classSlotId: destino.slotId,
        date: destino.date,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // A tentativa duplicada e somente leitura; os demais status nao
        // tem direito ao reagendamento
        expect(result.error).toContain(
          status === "DUPLICADA" ? "somente leitura" : "reagendada",
        );
      }
    }

    // Nenhuma troca foi gravada
    const rows = await pg.db.select().from(experimentalReschedules);
    expect(rows).toHaveLength(0);
  });

  it("o direito so se exerce no mesmo registro", async () => {
    const origem = await occurrence(3);
    const destino = await occurrence(4);

    const cancelada = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "CANCELADA_COM_DIREITO",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
    });

    // Com o direito em aberto o telefone continua bloqueado
    const bloqueada = await createExperimentalRequest(pg.db, {
      name: "Maria de novo",
      phone: "11988887777",
      classTypeId: destino.classTypeId,
      classSlotId: destino.slotId,
      date: destino.date,
      declarationAccepted: true,
    });
    expect(bloqueada.ok).toBe(false);
    if (!bloqueada.ok) {
      expect(bloqueada.error).toContain("ja existe uma aula experimental");
    }

    // O direito se exerce reagendando o mesmo registro
    const result = await rescheduleExperimental(pg.db, {
      experimentalId: cancelada.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(cancelada.id);
    expect(result.value.status).toBe("APROVADA");

    // Aprovada de novo, o telefone segue bloqueado
    const bloqueadaDepois = await createExperimentalRequest(pg.db, {
      name: "Maria de novo",
      phone: "11988887777",
      classTypeId: destino.classTypeId,
      classSlotId: destino.slotId,
      date: destino.date,
      declarationAccepted: true,
    });
    expect(bloqueadaDepois.ok).toBe(false);
  });
});
