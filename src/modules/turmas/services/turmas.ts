import { and, asc, eq, isNull, lte, or, gt, count } from "drizzle-orm";
import * as schema from "../../../db/schema";
import {
  bookings,
  classSessions,
  classSlots,
  classTypes,
} from "../../../db/schema";
import {
  ErroValidacaoSlot,
  DadosSlot,
  validarSlot,
} from "../domain/validadores";
import { hojeEstudio, proximaOcorrencia } from "../../turmas/domain/ocorrencias";
import {
  Composicao,
  calcularComposicao,
} from "../../reservas/domain/composicao";
import {
  DbClient,
  materializarSessao,
  Sessao,
} from "../../reservas/services/sessoes";

export type { DbClient };

export type Modalidade = typeof classTypes.$inferSelect;
export type Slot = typeof classSlots.$inferSelect;

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string; campo?: string };

/**
 * CRUD de modalidades e turmas (RES-01 a RES-05) e o servico unico de
 * leitura de composicao por (slot, data) (RES-27), fonte para painel,
 * agendamento e leitura publica.
 */

// ---- modalidades (RES-05) ----

export async function criarModalidade(
  db: DbClient,
  entrada: { name: string },
): Promise<Resultado<Modalidade>> {
  const [criada] = await db.insert(classTypes).values(entrada).returning();
  return criada ? { ok: true, valor: criada } : { ok: false, erro: "falha ao gravar modalidade" };
}

export async function editarModalidade(
  db: DbClient,
  id: string,
  patch: { name?: string; status?: "ATIVA" | "INATIVA" },
  agora: Date = new Date(),
): Promise<Resultado<Modalidade>> {
  const [atualizada] = await db
    .update(classTypes)
    .set({ ...patch, updatedAt: agora })
    .where(eq(classTypes.id, id))
    .returning();
  return atualizada
    ? { ok: true, valor: atualizada }
    : { ok: false, erro: "modalidade nao encontrada" };
}

// ---- turmas/slots (RES-01..RES-04) ----

export async function criarSlot(
  db: DbClient,
  entrada: { classTypeId: string; weekday: number; startTime: string; endTime: string; capacity?: number },
): Promise<Resultado<Slot>> {
  const [modalidade] = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, entrada.classTypeId));
  if (!modalidade) {
    return { ok: false, erro: "modalidade nao encontrada", campo: "classTypeId" };
  }

  const dados: DadosSlot = {
    weekday: entrada.weekday,
    startTime: entrada.startTime,
    endTime: entrada.endTime,
    // RES-02: sem capacidade informada, o PRD grava 8
    capacity: entrada.capacity ?? 8,
  };
  const validacao = validarSlot(dados);
  if (!validacao.ok) {
    return { ok: false, erro: errodeValidacao(validacao.erros), campo: validacao.erros[0]?.campo };
  }

  const [criado] = await db
    .insert(classSlots)
    .values({
      classTypeId: entrada.classTypeId,
      weekday: dados.weekday,
      startTime: dados.startTime,
      endTime: dados.endTime,
      capacity: dados.capacity,
    })
    .returning();
  return criado ? { ok: true, valor: criado } : { ok: false, erro: "falha ao gravar turma" };
}

export async function editarSlot(
  db: DbClient,
  id: string,
  patch: Partial<DadosSlot> & { status?: "ATIVA" | "INATIVA" },
  agora: Date = new Date(),
): Promise<Resultado<Slot>> {
  const [atual] = await db.select().from(classSlots).where(eq(classSlots.id, id));
  if (!atual) return { ok: false, erro: "turma nao encontrada" };

  const merged: DadosSlot = {
    weekday: patch.weekday ?? atual.weekday,
    startTime: patch.startTime ?? atual.startTime,
    endTime: patch.endTime ?? atual.endTime,
    capacity: patch.capacity ?? atual.capacity,
  };
  const validacao = validarSlot(merged);
  if (!validacao.ok) {
    return { ok: false, erro: errodeValidacao(validacao.erros), campo: validacao.erros[0]?.campo };
  }

  // Edge case de capacidade: editar para valor menor que a ocupacao de uma
  // ocorrencia futura recusa, informando a ocorrencia mais afetada
  if (patch.capacity !== undefined && merged.capacity < atual.capacity) {
    const hoje = hojeEstudio(agora);
    const maisAfetada = await ocorrenciaMaisAfetada(
      db,
      atual.id,
      atual.weekday,
      hoje,
    );
    if (maisAfetada && maisAfetada.ocupacao > merged.capacity) {
      return {
        ok: false,
        erro: `capacidade ${merged.capacity} menor que ocupacao ${maisAfetada.ocupacao} na ocorrencia de ${maisAfetada.data}`,
        campo: "capacity",
      };
    }
  }

  const [editado] = await db
    .update(classSlots)
    .set({ ...merged, ...patchComStatus(patch.status), updatedAt: agora })
    .where(eq(classSlots.id, id))
    .returning();
  return editado ? { ok: true, valor: editado } : { ok: false, erro: "falha ao editar turma" };
}

export async function desativarSlot(
  db: DbClient,
  id: string,
  agora: Date = new Date(),
): Promise<Resultado<Slot>> {
  const [desativada] = await db
    .update(classSlots)
    .set({ status: "INATIVA", updatedAt: agora })
    .where(eq(classSlots.id, id))
    .returning();
  return desativada
    ? { ok: true, valor: desativada }
    : { ok: false, erro: "turma nao encontrada" };
}

// ---- leitura unica de composicao (RES-27) ----

export type ComposicaoOcorrencia = Composicao & {
  classSlotId: string;
  data: string;
  sessaoId: string;
  statusSessao: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
};

/**
 * Composicao/vagas de uma ocorrencia por (slot, data) - toda leitura de
 * painel, agendamento e site passa por aqui (RES-27). Data no futuro/today
 * materializa (get-or-create, RES-06); data no passado e somente leitura
 * (RES-10).
 */
export async function obterComposicao(
  db: DbClient,
  entrada: { classSlotId: string; data: string },
  agora: Date = new Date(),
): Promise<Resultado<ComposicaoOcorrencia>> {
  const hoje = hojeEstudio(agora);

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, entrada.classSlotId));
  if (!slot) return { ok: false, erro: "turma nao encontrada" };

  const passada = entrada.data < hoje;

  let sessao: Sessao | undefined;
  if (passada) {
    // Leitura apenas: nada de materializacao no passado (RES-10 AC5)
    [sessao] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.classSlotId, entrada.classSlotId),
          eq(classSessions.sessionDate, entrada.data),
        ),
      );
    if (!sessao) {
      return { ok: false, erro: "ocorrencia passada nao existe para leitura" };
    }
  } else {
    const materializada = await materializarSessao(db, entrada, agora);
    if (!materializada.ok) {
      return { ok: false, erro: materializada.erro, campo: materializada.campo };
    }
    sessao = materializada.valor;
  }

  const contagens = await contagensDaOcorrencia(db, sessao, entrada.classSlotId);
  const composicao = calcularComposicao({
    capacity: slot.capacity,
    ...contagens,
  });

  return {
    ok: true,
    valor: {
      ...composicao,
      classSlotId: entrada.classSlotId,
      data: entrada.data,
      sessaoId: sessao.id,
      statusSessao: sessao.status,
    },
  };
}

// ---- internos ----

function errodeValidacao(erros: ErroValidacaoSlot[]): string {
  return erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ");
}

function patchComStatus(status?: "ATIVA" | "INATIVA") {
  return status ? { status } : {};
}

type Contagens = { fixos: number; reposicoes: number; experimentais: number };

/** Fixos derivados (AD-008): enrollments ativos na data + FIXED bookings. */
async function contagensDaOcorrencia(
  db: DbClient,
  sessao: Pick<Sessao, "id" | "classSlotId" | "sessionDate">,
  classSlotId: string,
): Promise<Contagens> {
  const [{ total: fixosEnrollments }] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        lte(schema.fixedEnrollments.startDate, sessao.sessionDate),
        or(
          isNull(schema.fixedEnrollments.endDate),
          gt(schema.fixedEnrollments.endDate, sessao.sessionDate),
        ),
      ),
    );

  const reservasPorTipo = await db
    .select({ tipo: bookings.bookingType, total: count() })
    .from(bookings)
    .where(and(eq(bookings.classSessionId, sessao.id), eq(bookings.status, "ATIVA")))
    .groupBy(bookings.bookingType);

  const porTipo = new Map(reservasPorTipo.map((r) => [r.tipo, Number(r.total)]));

  return {
    fixos: Number(fixosEnrollments) + (porTipo.get("FIXED") ?? 0),
    reposicoes: porTipo.get("MAKEUP") ?? 0,
    experimentais: porTipo.get("EXPERIMENTAL") ?? 0,
  };
}

type OcorrenciaAfetada = { data: string; ocupacao: number };

/**
 * Ocorrencia futura mais afetada por uma reducao de capacidade: sessions
 * materializadas futuras + a proxima ocorrencia ainda sem materializacao
 * (ocupacao por enrollments). Precisao do spec: "ocorrencias em aberto" nao
 * tem horizonte definido; escolhemos materializadas futuras + proxima data.
 */
async function ocorrenciaMaisAfetada(
  db: DbClient,
  classSlotId: string,
  weekday: number,
  hoje: string,
): Promise<OcorrenciaAfetada | null> {
  const materializadas = await db
    .select({ id: classSessions.id, data: classSessions.sessionDate })
    .from(classSessions)
    .where(and(eq(classSessions.classSlotId, classSlotId), gt(classSessions.sessionDate, hoje)))
    .orderBy(asc(classSessions.sessionDate));

  const candidatos = [...materializadas.map((s) => s.data)];
  const proxima = proximaOcorrencia({ weekday }, hoje);
  if (!candidatos.includes(proxima)) candidatos.push(proxima);

  let maisAfetada: OcorrenciaAfetada | null = null;
  for (const data of candidatos) {
    const ocupacao = await ocupacaoNaData(db, classSlotId, data);
    if (!maisAfetada || ocupacao > maisAfetada.ocupacao) {
      maisAfetada = { data, ocupacao };
    }
  }
  return maisAfetada;
}

/** Ocupacao de uma data: bookings ativos da ocorrencia (se materializada) + fixos. */
async function ocupacaoNaData(
  db: DbClient,
  classSlotId: string,
  data: string,
): Promise<number> {
  const [sessao] = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(and(eq(classSessions.classSlotId, classSlotId), eq(classSessions.sessionDate, data)));

  let reservasAtivas = 0;
  if (sessao) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(bookings)
      .where(and(eq(bookings.classSessionId, sessao.id), eq(bookings.status, "ATIVA")));
    reservasAtivas = Number(total);
  }

  const [{ total: fixos }] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        lte(schema.fixedEnrollments.startDate, data),
        or(isNull(schema.fixedEnrollments.endDate), gt(schema.fixedEnrollments.endDate, data)),
      ),
    );

  return reservasAtivas + Number(fixos);
}
