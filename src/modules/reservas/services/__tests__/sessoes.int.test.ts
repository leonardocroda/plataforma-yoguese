import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  classSlots,
  holidays,
  studioClosures,
} from "../../../../db/schema";
import { criarTurma, limparTabelas } from "../../../../test/fixtures";
import {
  PostgresTestInstance,
  startPostgres,
} from "../../../../test/postgres";
import { hojeEstudio, proximaOcorrencia } from "../../../turmas/domain/ocorrencias";
import { materializarSessao } from "../sessoes";

describe("sessoes", () => {
  let pg: PostgresTestInstance;
  let hoje: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await limparTabelas(pg.db);
    hoje = hojeEstudio(new Date());
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("cria na primeira consulta e reconsulta sem duplicar", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);

    const primeira = await materializarSessao(pg.db, { classSlotId: slotId, data });
    expect(primeira.ok).toBe(true);
    if (primeira.ok) {
      expect(primeira.valor.status).toBe("AGENDADA");
      expect(primeira.valor.sessionDate).toBe(data);
      expect(primeira.valor.classSlotId).toBe(slotId);
    }

    const segunda = await materializarSessao(pg.db, { classSlotId: slotId, data });
    expect(segunda.ok).toBe(true);
    if (segunda.ok && primeira.ok) {
      expect(segunda.valor.id).toBe(primeira.valor.id);
    }

    const criadas = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(criadas).toHaveLength(1);
  });

  it("feriado bloqueia a ocorrencia", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    await pg.db.insert(holidays).values({ date: data, name: "Feriado Teste" });

    const resultado = await materializarSessao(pg.db, { classSlotId: slotId, data });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.status).toBe("BLOQUEADA");
    }

    const [row] = await pg.db.select().from(classSessions);
    expect(row?.status).toBe("BLOQUEADA");
  });

  it("recesso bloqueia a ocorrencia no intervalo com extremos inclusos", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    await pg.db.insert(studioClosures).values({
      startDate: data, // extremo inicial incluso
      endDate: diasDepois(data, 8),
      reason: "Recesso Teste",
    });

    const resultado = await materializarSessao(pg.db, { classSlotId: slotId, data });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.status).toBe("BLOQUEADA");
    }
  });

  it("recusa materializar data passada", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const resultado = await materializarSessao(pg.db, {
      classSlotId: slotId,
      data: "2024-01-02", // terca no passado
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("data passada");
      expect(resultado.campo).toBe("data");
    }

    const criadas = await pg.db.select().from(classSessions);
    expect(criadas).toHaveLength(0);
  });

  it("turma inativa nao gera novas ocorrencias", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, slotId));

    const resultado = await materializarSessao(pg.db, { classSlotId: slotId, data });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("inativa");
    }
    const criadas = await pg.db.select().from(classSessions);
    expect(criadas).toHaveLength(0);
  });
});

/** Soma dias de calendario sobre uma data "YYYY-MM-DD" (meio-dia UTC). */
function diasDepois(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
