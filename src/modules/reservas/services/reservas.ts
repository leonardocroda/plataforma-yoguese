import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { bookings, classSessions, classSlots } from "../../../db/schema";
import { hojeEstudio, isDataPassada } from "../../turmas/domain/ocorrencias";
import {
  DbClient,
  materializarSessao,
  Sessao,
} from "./sessoes";

export type { DbClient };

export type TipoReserva = (typeof bookings.bookingType.enumValues)[number];

export type Booking = typeof bookings.$inferSelect;

export type ResultadoReserva =
  | { ok: true; valor: Booking }
  | { ok: false; erro: string; campo?: string };

export type EntradaReserva = {
  studentId: string;
  classSlotId: string;
  data: string;
  tipo: TipoReserva;
};

/**
 * Cria reserva individual transacional (RES-14 a RES-19). Nesta slice a
 * marcacao e admin-only, sem auth (AD-010): FIXED na ocorrencia especifica,
 * MAKEUP ou EXPERIMENTAL. Mesmo aluno em SEGUNDA turma no mesmo dia e
 * permitido (AD-011); duplicado e so bloqueado na MESMA ocorrencia (RES-17).
 * Capacidade e garantida no servidor com SELECT FOR UPDATE na ocorrencia:
 * N reservas concorrentes na ultima vaga geram exatamente 1 confirmada
 * (RES-16). Enrollment ativo conta como fixo ate a data encerrada (RES-23).
 */
export async function criarReserva(
  db: DbClient,
  entrada: EntradaReserva,
  agora: Date = new Date(),
): Promise<ResultadoReserva> {
  if (isDataPassada(entrada.data, hojeEstudio(agora))) {
    return {
      ok: false,
      erro: "reserva em data passada nao e permitida",
      campo: "data",
    };
  }

  const materializada = await materializarSessao(
    db,
    { classSlotId: entrada.classSlotId, data: entrada.data },
    agora,
  );
  if (!materializada.ok) {
    return { ok: false, erro: materializada.erro, campo: materializada.campo };
  }

  const sessao = materializada.valor;
  if (sessao.status === "BLOQUEADA") {
    return { ok: false, erro: "ocorrencia bloqueada por feriado/recesso" };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, entrada.classSlotId));
  if (!slot) return { ok: false, erro: "turma nao encontrada" };

  return db.transaction(async (tx): Promise<ResultadoReserva> => {
    // Serializa reservas na mesma ocorrencia: quem chega depois ve a
    // ocupacao confirmada por quem chegou antes (READ COMMITTED re-le o
    // commit mais recente quando o statement roda apos destravar a linha).
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, sessao.id))
      .for("update");

    const [duplicada] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.classSessionId, sessao.id),
          eq(bookings.studentId, entrada.studentId),
          eq(bookings.status, "ATIVA"),
        ),
      );
    if (duplicada) {
      return {
        ok: false,
        erro: "aluno ja possui reserva ativa nesta ocorrencia",
        campo: "studentId",
      };
    }

    const ocupacao = await ocupacaoDaOcorrencia(tx, sessao);
    if (ocupacao >= slot.capacity) {
      return { ok: false, erro: "sem vaga disponivel nesta ocorrencia" };
    }

    const [criada] = await tx
      .insert(bookings)
      .values({
        studentId: entrada.studentId,
        classSessionId: sessao.id,
        bookingType: entrada.tipo,
        status: "ATIVA",
      })
      .returning();

    return criada
      ? { ok: true, valor: criada }
      : { ok: false, erro: "falha ao gravar reserva" };
  });
}

/**
 * Ocupacao de uma ocorrencia: bookings ativos (qualquer tipo) + enrollments
 * ativos cobrindo a data (fixos derivados, AD-008).
 */
export async function ocupacaoDaOcorrencia(
  db: DbClient,
  sessao: Pick<Sessao, "id" | "classSlotId" | "sessionDate">,
): Promise<number> {
  const [bookingsAtivos] = await db
    .select({ total: count() })
    .from(bookings)
    .where(and(eq(bookings.classSessionId, sessao.id), eq(bookings.status, "ATIVA")));

  const [fixos] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, sessao.classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        // Cobre a data: startDate <= data < endDate encerrado (RES-23 AC4)
        lte(schema.fixedEnrollments.startDate, sessao.sessionDate),
        or(
          isNull(schema.fixedEnrollments.endDate),
          gt(schema.fixedEnrollments.endDate, sessao.sessionDate),
        ),
      ),
    );

  return Number(bookingsAtivos?.total ?? 0) + Number(fixos?.total ?? 0);
}
