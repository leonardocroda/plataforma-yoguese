import { asc, eq } from "drizzle-orm";
import { classSessions, classSlots, fixedEnrollments } from "../../../db/schema";
import {
  hojeEstudio,
  isDataPassada,
  proximaOcorrencia,
} from "../../turmas/domain/ocorrencias";
import {
  DbClient,
  materializarSessao,
  Sessao,
} from "../../reservas/services/sessoes";
import { ocupacaoDaOcorrencia } from "../../reservas/services/reservas";

export type { DbClient };

export type Enrollment = typeof fixedEnrollments.$inferSelect;

export type ResultadoEnrollment =
  | { ok: true; valor: Enrollment }
  | { ok: false; erro: string; campo?: string };

export type EntradaEnrollment = {
  studentId: string;
  classSlotId: string;
  startDate: string;
};

/**
 * Vinculo fixo do aluno a uma turma (RES-20 a RES-24). A criacao checa vagas
 * na proxima ocorrencia da turma a partir da data inicial (RES-21) e recusa
 * antes de persistir quando a composicao atinge a capacidade (RES-22,
 * transacao). Fixo deriva dela mesma a contagem (AD-008) e para de contar a
 * partir da data encerrada (RES-23).
 */
export async function criarEnrollment(
  db: DbClient,
  entrada: EntradaEnrollment,
  agora: Date = new Date(),
): Promise<ResultadoEnrollment> {
  const hoje = hojeEstudio(agora);

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, entrada.classSlotId));
  if (!slot) return { ok: false, erro: "turma nao encontrada" };
  if (slot.status === "INATIVA") {
    return {
      ok: false,
      erro: "turma inativa nao recebe novos fixos",
      campo: "status",
    };
  }

  const base = isDataPassada(entrada.startDate, hoje) ? hoje : entrada.startDate;
  const data = proximaOcorrencia({ weekday: slot.weekday }, base);

  const materializada = await materializarSessao(
    db,
    { classSlotId: slot.id, data },
    agora,
  );
  if (!materializada.ok) {
    return { ok: false, erro: materializada.erro, campo: materializada.campo };
  }
  const sessao: Sessao = materializada.valor;

  return db.transaction(async (tx): Promise<ResultadoEnrollment> => {
    // Mesma serializacao da reserva: a checagem de vaga le o estado
    // comprometido apos destravar a ocorrencia
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, sessao.id))
      .for("update");

    const ocupacao = await ocupacaoDaOcorrencia(tx, sessao);
    if (ocupacao >= slot.capacity) {
      return { ok: false, erro: "sem vaga disponivel nesta ocorrencia" };
    }

    const [criado] = await tx
      .insert(fixedEnrollments)
      .values({
        studentId: entrada.studentId,
        classSlotId: slot.id,
        startDate: entrada.startDate,
        status: "ATIVA",
      })
      .returning();

    return criado
      ? { ok: true, valor: criado }
      : { ok: false, erro: "falha ao gravar enrollment" };
  });
}

/**
 * Encerra o vinculo por end_date (a partir dela deixa de contar) ou
 * tornando inativo (RES-23 AC4).
 */
export async function encerrarEnrollment(
  db: DbClient,
  enrollmentId: string,
  entrada: { data?: string } = {},
  agora: Date = new Date(),
): Promise<ResultadoEnrollment> {
  const atualizacao = entrada.data
    ? { endDate: entrada.data, updatedAt: agora }
    : { status: "INATIVA" as const, updatedAt: agora };

  const [atualizado] = await db
    .update(fixedEnrollments)
    .set(atualizacao)
    .where(eq(fixedEnrollments.id, enrollmentId))
    .returning();

  return atualizado
    ? { ok: true, valor: atualizado }
    : { ok: false, erro: "enrollment nao encontrado" };
}

/** Historico por aluno: ativos e encerrados, do mais antigo (RES-24). */
export async function listarEnrollmentsPorAluno(
  db: DbClient,
  studentId: string,
): Promise<Enrollment[]> {
  return db
    .select()
    .from(fixedEnrollments)
    .where(eq(fixedEnrollments.studentId, studentId))
    .orderBy(asc(fixedEnrollments.startDate));
}
