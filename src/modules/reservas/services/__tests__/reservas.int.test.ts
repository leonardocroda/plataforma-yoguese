import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, holidays } from "../../../../db/schema";
import { criarAlunos, criarTurma, limparTabelas } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { hojeEstudio, proximaOcorrencia } from "../../../turmas/domain/ocorrencias";
import { criarReserva, EntradaReserva } from "../reservas";

describe("reservas", () => {
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

  async function entrar(
    extra: Partial<EntradaReserva> = {},
  ): Promise<{ slotId: string; data: string; alunos: string[] }> {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje); // terca futura
    const alunos = await criarAlunos(pg.db, 1);
    return { slotId, data, alunos, ...extra };
  }

  async function reservar(
    entrada: { slotId: string; data: string; alunos: string[] },
    alunoIdx = 0,
    tipo: EntradaReserva["tipo"] = "MAKEUP",
  ) {
    return criarReserva(pg.db, {
      studentId: entrada.alunos[alunoIdx],
      classSlotId: entrada.slotId,
      data: entrada.data,
      tipo,
    });
  }

  it("confirma com vaga disponivel", async () => {
    const entrada = await entrar();

    const resultado = await reservar(entrada);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.studentId).toBe(entrada.alunos[0]);
      expect(resultado.valor.classSessionId).toBeTruthy();
      expect(resultado.valor.bookingType).toBe("MAKEUP");
      expect(resultado.valor.status).toBe("ATIVA");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(and(eq(bookings.status, "ATIVA")));
    expect(Number(total?.total)).toBe(1);
  });

  it("recusa sem vaga com mensagem clara e sem estado parcial", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 1 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    const alunos = await criarAlunos(pg.db, 2);

    const primeira = await criarReserva(pg.db, {
      studentId: alunos[0],
      classSlotId: slotId,
      data,
      tipo: "MAKEUP",
    });
    expect(primeira.ok).toBe(true);

    const segunda = await criarReserva(pg.db, {
      studentId: alunos[1],
      classSlotId: slotId,
      data,
      tipo: "MAKEUP",
    });
    expect(segunda.ok).toBe(false);
    if (!segunda.ok) {
      expect(segunda.erro).toContain("sem vaga");
    }

    // Nenhum estado parcial: a recusa nao gravou nada
    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(1);
  });

  it("concorrencia na ultima vaga confirma uma", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 1 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    const alunos = await criarAlunos(pg.db, 8);

    const tentativas = await Promise.allSettled(
      alunos.map((studentId) =>
        criarReserva(pg.db, { studentId, classSlotId: slotId, data, tipo: "MAKEUP" }),
      ),
    );

    // Nenhuma falha de infraestrutura: todas terminam com resultado de negocio
    expect(tentativas.every((t) => t.status === "fulfilled")).toBe(true);
    const resultados = tentativas.map(
      (t) => t.status === "fulfilled" ? t.value : { ok: false, erro: String(t.reason) },
    );
    const confirmadas = resultados.filter((r) => r.ok);
    const recusadas = resultados.filter((r) => !r.ok);

    // Teste do PRD secao 15: N concorrentes na ultima vaga -> exatamente 1
    expect(confirmadas).toHaveLength(1);
    expect(recusadas).toHaveLength(7);
    for (const recusada of recusadas) {
      expect(recusada.erro).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(bookings)
      .where(eq(bookings.status, "ATIVA"));
    expect(Number(total?.total)).toBe(1);
  });

  it("recusa duplicada na mesma sessao", async () => {
    const entrada = await entrar();

    const primeira = await reservar(entrada);
    expect(primeira.ok).toBe(true);

    const segunda = await reservar(entrada);
    expect(segunda.ok).toBe(false);
    if (!segunda.ok) {
      expect(segunda.erro).toContain("reserva ativa");
    }

    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(1);
  });

  it("segunda aula no mesmo dia com admin", async () => {
    // AD-011: o admin pode marcar o mesmo aluno em outra turma no mesmo dia
    const primeira = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const alunos = await criarAlunos(pg.db, 1);
    const segunda = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);

    const a = await criarReserva(pg.db, {
      studentId: alunos[0],
      classSlotId: primeira.slotId,
      data,
      tipo: "FIXED",
    });
    expect(a.ok).toBe(true);

    const b = await criarReserva(pg.db, {
      studentId: alunos[0],
      classSlotId: segunda.slotId,
      data,
      tipo: "FIXED",
    });
    expect(b.ok).toBe(true);

    const [total] = await pg.db.select({ total: count() }).from(bookings);
    expect(Number(total?.total)).toBe(2);
  });

  it("recusa data passada", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const alunos = await criarAlunos(pg.db, 1);

    const resultado = await criarReserva(pg.db, {
      studentId: alunos[0],
      classSlotId: slotId,
      data: "2024-01-02", // terca passada
      tipo: "FIXED",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("data passada");
      expect(resultado.campo).toBe("data");
    }
    const criadas = await pg.db.select().from(bookings);
    expect(criadas).toHaveLength(0);
  });

  it("recusa reserva em ocorrencia bloqueada", async () => {
    const { slotId } = await criarTurma(pg.db, { weekday: 3, capacity: 8 });
    const data = proximaOcorrencia({ weekday: 3 }, hoje);
    const alunos = await criarAlunos(pg.db, 1);
    await pg.db.insert(holidays).values({ date: data, name: "Feriado Teste" });

    const resultado = await criarReserva(pg.db, {
      studentId: alunos[0],
      classSlotId: slotId,
      data,
      tipo: "MAKEUP",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("bloqueada");
    }
    const criadas = await pg.db.select().from(bookings);
    expect(criadas).toHaveLength(0);
  });

  it("registra dados de auditoria", async () => {
    const entrada = await entrar();

    const resultado = await reservar(entrada, 0, "EXPERIMENTAL");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const registro = resultado.valor;
      expect(registro.id).toBeTruthy();
      expect(registro.studentId).toBe(entrada.alunos[0]);
      expect(registro.classSessionId).toBeTruthy();
      expect(registro.bookingType).toBe("EXPERIMENTAL");
      expect(registro.status).toBe("ATIVA");
      expect(registro.createdAt).toBeInstanceOf(Date);
      expect(registro.updatedAt).toBeInstanceOf(Date);
    }
  });
});
