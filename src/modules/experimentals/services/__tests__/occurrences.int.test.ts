import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classSessions, classSlots, classTypes } from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  occurrenceDates,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import { listExperimentalOccurrences } from "../experimentals";

// EXP-04, EXP-05, EXP-13, EXP-15, EXP-44: a agenda publica do formulario
// oferece so ocorrencia futura, ativa, agendada e com vaga - sem nenhum
// dado de outra pessoa.

describe("experimental occurrences", () => {
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

  it("lista apenas ocorrencias futuras ativas com vaga", async () => {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 4,
    });
    const date = nextOccurrence({ weekday: 3 }, today);

    // Uma turma inativa nao gera opcao
    const { slotId: inativaSlot } = await createTestClass(pg.db, {
      weekday: 4,
      capacity: 4,
    });
    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, inativaSlot));

    // Uma modalidade inativa nao gera opcao
    const { classTypeId: inativaType } = await createTestClass(pg.db, {
      weekday: 5,
      capacity: 4,
    });
    await pg.db
      .update(classTypes)
      .set({ status: "INATIVA" })
      .where(eq(classTypes.id, inativaType));

    const options = await listExperimentalOccurrences(pg.db);

    // So a turma ativa aparece, e todas as opcoes sao dela
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.classSlotId === slotId)).toBe(true);
    expect(options.every((option) => option.classTypeId === classTypeId)).toBe(
      true,
    );
    // Todas as opcoes sao futuras e dentro da janela de 30 dias
    expect(options.every((option) => option.date >= today)).toBe(true);
    expect(
      options.every((option) => option.date <= addDays(today, 30)),
    ).toBe(true);

    const option = options.find((item) => item.date === date);
    expect(option).toBeDefined();
    expect(option?.startTime).toBe("19:00:00");
    expect(option?.endTime).toBe("20:00:00");
    expect(option?.availableSpots).toBe(4);
    expect(option?.classTypeName).toContain("Superioga Teste");

    // A filtragem por modalidade mantem a lista da modalidade escolhida
    const daModalidade = await listExperimentalOccurrences(pg.db, {
      classTypeId,
    });
    expect(daModalidade).toHaveLength(options.length);
    const deOutra = await listExperimentalOccurrences(pg.db, {
      classTypeId: inativaType,
    });
    expect(deOutra).toHaveLength(0);
  });

  it("omite ocorrencia bloqueada e cancelada", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 4 });
    const date = nextOccurrence({ weekday: 3 }, today);

    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);

    // Bloqueada: a data some da agenda, as outras seguem
    await pg.db
      .update(classSessions)
      .set({ status: "BLOQUEADA" })
      .where(eq(classSessions.id, materialized.value.id));
    const comBloqueada = await listExperimentalOccurrences(pg.db);
    expect(
      comBloqueada.find((option) => option.date === date),
    ).toBeUndefined();

    // Cancelada
    await pg.db
      .update(classSessions)
      .set({ status: "CANCELADA" })
      .where(eq(classSessions.id, materialized.value.id));
    const comCancelada = await listExperimentalOccurrences(pg.db);
    expect(
      comCancelada.find((option) => option.date === date),
    ).toBeUndefined();
  });

  it("a aprovada reduz a vaga ofertada", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 2 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);

    await createExperimental(pg.db, {
      classSessionId: materialized.value.id,
      status: "APROVADA",
    });

    const options = await listExperimentalOccurrences(pg.db);
    const option = options.find((item) => item.date === date);
    expect(option).toBeDefined();
    expect(option?.availableSpots).toBe(1);
  });

  it("devolve lista vazia quando nenhuma ocorrencia tem vaga", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 1 });
    const to = addDays(today, 30);

    // Todas as ocorrencias da janela ficam lotadas
    for (const date of occurrenceDates({ weekday: 3 }, today, to)) {
      const materialized = await materializeSession(pg.db, {
        classSlotId: slotId,
        date,
      });
      if (!materialized.ok) throw new Error(materialized.error);
      await createExperimental(pg.db, {
        classSessionId: materialized.value.id,
        status: "APROVADA",
      });
    }

    const options = await listExperimentalOccurrences(pg.db);
    expect(options).toHaveLength(0);
  });

  it("opcao publica nao carrega nome nem telefone de ninguem", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 2 });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);

    await createExperimental(pg.db, {
      classSessionId: materialized.value.id,
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      status: "APROVADA",
    });

    const options = await listExperimentalOccurrences(pg.db);
    expect(options.length).toBeGreaterThan(0);

    const option = options.find((item) => item.date === date);
    expect(option).toBeDefined();
    expect(option).not.toHaveProperty("name");
    expect(option).not.toHaveProperty("phone");
    expect(option).not.toHaveProperty("phoneNormalized");
    expect(JSON.stringify(options)).not.toContain("Maria Visitante");
    expect(JSON.stringify(options)).not.toContain("98888-7777");
  });
});
