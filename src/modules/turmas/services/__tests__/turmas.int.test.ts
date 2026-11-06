import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classSessions, classSlots, classTypes } from "../../../../db/schema";
import { criarAlunos, criarTurma, limparTabelas } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { hojeEstudio, proximaOcorrencia } from "../../domain/ocorrencias";
import { criarEnrollment } from "../../../alunos/services/enrollments";
import { criarReserva } from "../../../reservas/services/reservas";
import {
  criarModalidade,
  criarSlot,
  desativarSlot,
  editarModalidade,
  editarSlot,
  obterComposicao,
} from "../turmas";

describe("turmas", () => {
  let pg: PostgresTestInstance;
  let hoje: string;
  let dia: string; // proxima data de terca do slot 19h (futura)
  let diaSeguinte: string; // terca da semana seguinte

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await limparTabelas(pg.db);
    hoje = hojeEstudio(new Date());
    dia = proximaOcorrencia({ weekday: 3 }, hoje);
    diaSeguinte = proximaOcorrencia({ weekday: 3 }, proximo(dia));
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  function proximo(data: string): string {
    return proximaOcorrencia({ weekday: 3 }, adicionarDias(data, 1));
  }

  it("capacidade default e oito", async () => {
    const { modalidadeId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const semCapacidade = await criarSlot(pg.db, {
      classTypeId: modalidadeId,
      weekday: 5,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(semCapacidade.ok).toBe(true);
    if (semCapacidade.ok) {
      expect(semCapacidade.valor.capacity).toBe(8);
      expect(semCapacidade.valor.status).toBe("ATIVA");
      expect(semCapacidade.valor.classTypeId).toBe(modalidadeId);
    }

    // Capacidade informada e respeitada e pode ser alterada depois (RES-02)
    const comCapacidade = await criarSlot(pg.db, {
      classTypeId: modalidadeId,
      weekday: 6,
      startTime: "09:00:00",
      endTime: "10:00:00",
      capacity: 5,
    });
    expect(comCapacidade.ok).toBe(true);
    if (comCapacidade.ok) {
      expect(comCapacidade.valor.capacity).toBe(5);
      const alterada = await editarSlot(pg.db, comCapacidade.valor.id, { capacity: 12 });
      expect(alterada.ok).toBe(true);
      if (alterada.ok) expect(alterada.valor.capacity).toBe(12);
    }
  });

  it("recusa slot invalido no servidor", async () => {
    const { modalidadeId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const fimIgual = await criarSlot(pg.db, {
      classTypeId: modalidadeId,
      weekday: 3,
      startTime: "19:00:00",
      endTime: "19:00:00",
    });
    expect(fimIgual.ok).toBe(false);
    if (!fimIgual.ok) {
      expect(fimIgual.campo).toBe("endTime");
      expect(fimIgual.erro).toContain("endTime");
    }

    const fimMenor = await criarSlot(pg.db, {
      classTypeId: modalidadeId,
      weekday: 3,
      startTime: "20:00:00",
      endTime: "19:00:00",
    });
    expect(fimMenor.ok).toBe(false);

    const weekdayFora = await criarSlot(pg.db, {
      classTypeId: modalidadeId,
      weekday: 8,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(weekdayFora.ok).toBe(false);
    if (!weekdayFora.ok) expect(weekdayFora.campo).toBe("weekday");

    // Nenhuma das recusas gravou: segue existindo apenas a turma do fixture
    const turmas = await pg.db.select().from(classSlots);
    expect(turmas).toHaveLength(1);
    expect(turmas[0].weekday).toBe(3);
  });

  it("cadastra edita e desativa modalidade", async () => {
    const criada = await criarModalidade(pg.db, { name: "Superioga Fluide" });
    expect(criada.ok).toBe(true);
    if (!criada.ok) return;
    expect(criada.valor.status).toBe("ATIVA");

    const editada = await editarModalidade(pg.db, criada.valor.id, { name: "Superioga Fluide 2" });
    expect(editada.ok).toBe(true);
    if (editada.ok) expect(editada.valor.name).toBe("Superioga Fluide 2");

    const desativada = await editarModalidade(pg.db, criada.valor.id, { status: "INATIVA" });
    expect(desativada.ok).toBe(true);
    if (desativada.ok) expect(desativada.valor.status).toBe("INATIVA");

    const [row] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, criada.valor.id));
    expect(row.name).toBe("Superioga Fluide 2");
    expect(row.status).toBe("INATIVA");
  });

  it("desativar turma altera ocorrencias futuras", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    // Ocorrencia futura existente continua com composicao legivel
    const antes = await obterComposicao(pg.db, { classSlotId: slotId, data: dia });
    expect(antes.ok).toBe(true);
    if (!antes.ok) return;
    expect(antes.valor.statusSessao).toBe("AGENDADA");

    const desativada = await desativarSlot(pg.db, slotId);
    expect(desativada.ok).toBe(true);

    // A partir da alteracao, novas ocorrencias futuras nao sao geradas
    const depois = await obterComposicao(pg.db, { classSlotId: slotId, data: diaSeguinte });
    expect(depois.ok).toBe(false);
    if (!depois.ok) {
      expect(depois.erro).toContain("inativa");
    }
  });

  it("recusa capacidade abaixo da ocupacao de ocorrencia futura", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const alunos = await criarAlunos(pg.db, 5);
    for (const aluno of alunos) {
      const fixo = await criarEnrollment(pg.db, {
        studentId: aluno,
        classSlotId: slotId,
        startDate: dia,
      });
      expect(fixo.ok).toBe(true);
    }

    const recusada = await editarSlot(pg.db, slotId, { capacity: 4 });
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) {
      expect(recusada.campo).toBe("capacity");
      expect(recusada.erro).toContain("ocupacao 5");
      expect(recusada.erro).toContain(dia); // informa a ocorrencia mais afetada
    }

    // Aumento e permitido
    const ampliada = await editarSlot(pg.db, slotId, { capacity: 10 });
    expect(ampliada.ok).toBe(true);
  });

  it("aceita edita dados obrigatorios validos da turma", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const editada = await editarSlot(pg.db, slotId, {
      weekday: 5,
      startTime: "18:00:00",
      endTime: "19:00:00",
    });
    expect(editada.ok).toBe(true);
    if (editada.ok) {
      expect(editada.valor.weekday).toBe(5);
      expect(editada.valor.startTime).toBe("18:00:00");
      expect(editada.valor.endTime).toBe("19:00:00");
    }
  });
});

function adicionarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe("composicao", () => {
  let pg: PostgresTestInstance;
  let hoje: string;
  let dia: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await limparTabelas(pg.db);
    hoje = hojeEstudio(new Date());
    dia = proximaOcorrencia({ weekday: 3 }, hoje);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("exemplo do PRD 5+2+1 cap 8 vagas zero", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const fixos = await criarAlunos(pg.db, 5);
    for (const aluno of fixos) {
      const fixo = await criarEnrollment(pg.db, {
        studentId: aluno,
        classSlotId: slotId,
        startDate: dia,
      });
      expect(fixo.ok).toBe(true);
    }

    // 2 posicoes de reposicao e 1 de experimentais criadas como bookings
    const avulsos = await criarAlunos(pg.db, 3);
    for (let i = 0; i < 2; i++) {
      const reserva = await criarReserva(pg.db, {
        studentId: avulsos[i],
        classSlotId: slotId,
        data: dia,
        tipo: "MAKEUP",
      });
      expect(reserva.ok).toBe(true);
    }
    const experimental = await criarReserva(pg.db, {
      studentId: avulsos[2],
      classSlotId: slotId,
      data: dia,
      tipo: "EXPERIMENTAL",
    });
    expect(experimental.ok).toBe(true);

    const leitura = await obterComposicao(pg.db, { classSlotId: slotId, data: dia });
    expect(leitura.ok).toBe(true);
    if (leitura.ok) {
      expect(leitura.valor.fixos).toBe(5);
      expect(leitura.valor.reposicoes).toBe(2);
      expect(leitura.valor.experimentais).toBe(1);
      expect(leitura.valor.total).toBe(8);
      expect(leitura.valor.vagas).toBe(0);
      expect(leitura.valor.classSlotId).toBe(slotId);
      expect(leitura.valor.data).toBe(dia);
      expect(leitura.valor.sessaoId).toBeTruthy();
      expect(leitura.valor.statusSessao).toBe("AGENDADA");
    }
  });

  it("ocorrencia sem dados devolve total zero e todas as vagas", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    const leitura = await obterComposicao(pg.db, { classSlotId: slotId, data: dia });
    expect(leitura.ok).toBe(true);
    if (leitura.ok) {
      expect(leitura.valor.fixos).toBe(0);
      expect(leitura.valor.reposicoes).toBe(0);
      expect(leitura.valor.experimentais).toBe(0);
      expect(leitura.valor.total).toBe(0);
      expect(leitura.valor.vagas).toBe(8);
    }
  });

  it("leitura de data no passado nao materializa", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });

    // Materializa a futura primeiro
    const futura = await obterComposicao(pg.db, { classSlotId: slotId, data: dia });
    expect(futura.ok).toBe(true);

    const passada = await obterComposicao(pg.db, {
      classSlotId: slotId,
      data: "2024-01-02", // terca ja passada
    });
    expect(passada.ok).toBe(false);
    if (!passada.ok) {
      expect(passada.erro).toContain("passada");
    }

    // Nada foi materializado alem da ocorrencia futura
    const linhas = await pg.db.select().from(classSessions);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].sessionDate).toBe(dia);
  });
});
