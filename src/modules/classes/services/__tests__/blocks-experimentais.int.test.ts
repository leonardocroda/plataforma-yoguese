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
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { cancelOccurrenceByStudio } from "../../../credits/services/cancellations";
import { updateSlot } from "../classes";
import { createHoliday, deleteHoliday } from "../blocks";

// EXP-45, EXP-46: as tres saidas do estudio - feriado/recesso, cancelamento
// e edicao de dia e horario da turma - cancelam a experimental da ocorrencia
// com direito a reagendamento. Desbloquear nao restaura a experimental.

describe("experimental block hooks", () => {
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

  /** Turma no dia da semana informado, com a ocorrencia agendada. */
  async function occurrence(weekday: number, capacity = 8) {
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

  async function statusOf(experimentalId: string): Promise<string> {
    const [row] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimentalId));
    return row?.status ?? "";
  }

  it("bloqueio, cancelamento e edicao de turma cancelam a experimental com direito", async () => {
    // 1. Feriado: a ocorrencia bloqueada cancela a experimental com direito
    {
      const { sessionId, date } = await occurrence(3);
      const aprovada = await createExperimental(pg.db, {
        classSessionId: sessionId,
        status: "APROVADA",
        name: "Maria Bloqueio",
        phone: "(11) 98888-7777",
      });
      const pendente = await createExperimental(pg.db, {
        classSessionId: sessionId,
        status: "PENDENTE",
        name: "Joana Bloqueio",
        phone: "(11) 97777-6666",
      });

      const created = await createHoliday(pg.db, {
        date,
        name: "Feriado Teste",
      });
      expect(created.ok).toBe(true);

      expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");
      expect(await statusOf(pendente.id)).toBe("CANCELADA_COM_DIREITO");
    }

    // 2. Cancelamento pelo estudio: a mesma regra da saida do estudio
    {
      const { sessionId } = await occurrence(4);
      const aprovada = await createExperimental(pg.db, {
        classSessionId: sessionId,
        status: "APROVADA",
        name: "Maria Cancelamento",
        phone: "(11) 96666-5555",
      });

      const cancelled = await cancelOccurrenceByStudio(pg.db, {
        classSessionId: sessionId,
      });
      expect(cancelled.ok).toBe(true);

      expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");
    }

    // 3. Edicao de dia e horario da turma: as ocorrencias futuras da grade
    // antiga sao canceladas e a experimental vai junto (EXP-45)
    {
      const { slotId, sessionId } = await occurrence(5);
      const aprovada = await createExperimental(pg.db, {
        classSessionId: sessionId,
        status: "APROVADA",
        name: "Maria Edicao",
        phone: "(11) 95555-4444",
      });

      const edited = await updateSlot(pg.db, slotId, {
        weekday: 6,
        startTime: "20:00:00",
        endTime: "21:00:00",
      });
      expect(edited.ok).toBe(true);

      expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");
    }
  });

  it("desbloquear nao restaura a experimental cancelada", async () => {
    const { sessionId, date } = await occurrence(3);
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      name: "Maria Visitante",
      phone: "(11) 94444-3333",
    });

    const created = await createHoliday(pg.db, {
      date,
      name: "Feriado Teste",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");

    // O feriado sai: a ocorrencia volta a AGENDADA, mas a experimental nao
    // volta - o direito se exerce reagendando o mesmo registro (EXP-46)
    const deleted = await deleteHoliday(pg.db, { id: created.value.id });
    expect(deleted.ok).toBe(true);

    expect(await statusOf(aprovada.id)).toBe("CANCELADA_COM_DIREITO");
  });
});
