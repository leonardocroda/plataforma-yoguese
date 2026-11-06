import { count } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedEnrollments } from "../../../../db/schema";
import { criarAlunos, criarTurma, limparTabelas } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { hojeEstudio, proximaOcorrencia } from "../../../turmas/domain/ocorrencias";
import { criarReserva } from "../../../reservas/services/reservas";
import { criarEnrollment, encerrarEnrollment, listarEnrollmentsPorAluno } from "../enrollments";

describe("enrollments", () => {
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

  async function base(capacity: number) {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity });
    return { slotId, data: proximaOcorrencia({ weekday: 3 }, hoje) };
  }

  it("cria e conta do start_date", async () => {
    const { slotId, data } = await base(1);
    const [a, b] = await criarAlunos(pg.db, 2);

    const criado = await criarEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: data,
    });
    expect(criado.ok).toBe(true);
    if (criado.ok) {
      expect(criado.valor.startDate).toBe(data);
      expect(criado.valor.endDate).toBeNull();
      expect(criado.valor.status).toBe("ATIVA");
    }

    // O fixo ocupa vaga na propria data inicial: segundo fixo recusa
    const segundaTentativa = await criarEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: data,
    });
    expect(segundaTentativa.ok).toBe(false);
    if (!segundaTentativa.ok) {
      expect(segundaTentativa.erro).toContain("sem vaga");
    }
  });

  it("recusa turma cheia na proxima ocorrencia", async () => {
    const { slotId, data } = await base(1);
    const [ocupante, queroFixo] = await criarAlunos(pg.db, 2);

    const reserva = await criarReserva(pg.db, {
      studentId: ocupante,
      classSlotId: slotId,
      data,
      tipo: "MAKEUP",
    });
    expect(reserva.ok).toBe(true);

    const resultado = await criarEnrollment(pg.db, {
      studentId: queroFixo,
      classSlotId: slotId,
      startDate: data,
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(0);
  });

  it("capacidade checada antes de gravar", async () => {
    const { slotId, data } = await base(2);
    const [fixo, ocupante, terceiro] = await criarAlunos(pg.db, 3);

    const primeiro = await criarEnrollment(pg.db, {
      studentId: fixo,
      classSlotId: slotId,
      startDate: data,
    });
    expect(primeiro.ok).toBe(true);

    const reserva = await criarReserva(pg.db, {
      studentId: ocupante,
      classSlotId: slotId,
      data,
      tipo: "MAKEUP",
    });
    expect(reserva.ok).toBe(true);

    // segundo fixo estouraria a capacidade -> recusado sem estado parcial
    const excedente = await criarEnrollment(pg.db, {
      studentId: terceiro,
      classSlotId: slotId,
      startDate: data,
    });
    expect(excedente.ok).toBe(false);
    if (!excedente.ok) {
      expect(excedente.erro).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(1);
  });

  it("encerrado sai do contador da data", async () => {
    const { slotId, data } = await base(1);
    const [a, b] = await criarAlunos(pg.db, 2);

    const criado = await criarEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: data,
    });
    expect(criado.ok).toBe(true);

    const encerrado = await encerrarEnrollment(pg.db, criado.ok ? criado.valor.id : "");
    expect(encerrado.ok).toBe(true);
    if (encerrado.ok) {
      expect(encerrado.valor.status).toBe("INATIVA");
    }

    // Com o fixo encerrado, a vaga volta: o proximo aluno cria
    const novo = await criarEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: data,
    });
    expect(novo.ok).toBe(true);
  });

  it("end_date remove contagem apos o fim", async () => {
    const { slotId, data } = await base(1);
    const [a, b] = await criarAlunos(pg.db, 2);

    const criado = await criarEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: data,
    });
    expect(criado.ok).toBe(true);

    // end_date no proprio dia da proxima ocorrencia: a partir da data
    // encerrada o fixo deixa de contar (RES-23 AC4)
    const encerrado = await encerrarEnrollment(
      pg.db,
      criado.ok ? criado.valor.id : "",
      { data },
    );
    expect(encerrado.ok).toBe(true);
    if (encerrado.ok) {
      expect(encerrado.valor.endDate).toBe(data);
    }

    const novo = await criarEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: data,
    });
    expect(novo.ok).toBe(true);
  });

  it("historico do aluno", async () => {
    const turmaA = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const turmaB = await criarTurma(pg.db, { weekday: 5, capacity: 8 });
    const [a, solitario] = await criarAlunos(pg.db, 2);
    const dataA = proximaOcorrencia({ weekday: 3 }, hoje);
    const dataB = proximaOcorrencia({ weekday: 5 }, hoje);

    const fixoA = await criarEnrollment(pg.db, {
      studentId: a,
      classSlotId: turmaA.slotId,
      startDate: dataA,
    });
    expect(fixoA.ok).toBe(true);
    const fixoB = await criarEnrollment(pg.db, {
      studentId: a,
      classSlotId: turmaB.slotId,
      startDate: dataB,
    });
    expect(fixoB.ok).toBe(true);
    if (fixoB.ok) {
      // Ativo e encerrado vazam no historico (RES-24)
      await encerrarEnrollment(pg.db, fixoB.valor.id);
    }

    const historico = await listarEnrollmentsPorAluno(pg.db, a);
    expect(historico).toHaveLength(2);
    expect(historico[0].classSlotId).toBe(turmaA.slotId);
    expect(historico[0].startDate).toBe(dataA);
    expect(historico[0].status).toBe("ATIVA");
    expect(historico[0].endDate).toBeNull();
    expect(historico[1].classSlotId).toBe(turmaB.slotId);
    expect(historico[1].startDate).toBe(dataB);
    expect(historico[1].status).toBe("INATIVA");

    const vazio = await listarEnrollmentsPorAluno(pg.db, solitario);
    expect(vazio).toHaveLength(0);
  });
});
