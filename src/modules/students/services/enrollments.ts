import { asc, eq } from "drizzle-orm";
import { classSessions, classSlots, fixedEnrollments } from "../../../db/schema";
import {
  todayInStudio,
  isDatePast,
  nextOccurrence,
} from "../../classes/domain/occurrences";
import {
  DbClient,
  materializeSession,
  Session,
} from "../../bookings/services/sessions";
import { occurrenceOccupancy } from "../../bookings/services/bookings";

export type { DbClient };

export type Enrollment = typeof fixedEnrollments.$inferSelect;

export type EnrollmentResult =
  | { ok: true; value: Enrollment }
  | { ok: false; error: string; field?: string };

export type EnrollmentInput = {
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
export async function createEnrollment(
  db: DbClient,
  input: EnrollmentInput,
  now: Date = new Date(),
): Promise<EnrollmentResult> {
  const today = todayInStudio(now);

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));
  if (!slot) return { ok: false, error: "turma nao encontrada" };
  if (slot.status === "INATIVA") {
    return {
      ok: false,
      error: "turma inativa nao recebe novos fixos",
      field: "status",
    };
  }

  const base = isDatePast(input.startDate, today) ? today : input.startDate;
  const date = nextOccurrence({ weekday: slot.weekday }, base);

  const materialized = await materializeSession(
    db,
    { classSlotId: slot.id, date },
    now,
  );
  if (!materialized.ok) {
    return {
      ok: false,
      error: materialized.error,
      field: materialized.field,
    };
  }
  const session: Session = materialized.value;

  return db.transaction(async (tx): Promise<EnrollmentResult> => {
    // Mesma serializacao da reserva: a checagem de vaga le o estado
    // comprometido apos destravar a ocorrencia
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, session.id))
      .for("update");

    const occupancy = await occurrenceOccupancy(tx, session);
    if (occupancy >= slot.capacity) {
      return { ok: false, error: "sem vaga disponivel nesta ocorrencia" };
    }

    const [created] = await tx
      .insert(fixedEnrollments)
      .values({
        studentId: input.studentId,
        classSlotId: slot.id,
        startDate: input.startDate,
        status: "ATIVA",
      })
      .returning();

    return created
      ? { ok: true, value: created }
      : { ok: false, error: "falha ao gravar enrollment" };
  });
}

/**
 * Encerra o vinculo por end_date (a partir dela deixa de contar) ou
 * tornando inativo (RES-23 AC4).
 */
export async function endEnrollment(
  db: DbClient,
  enrollmentId: string,
  input: { date?: string } = {},
  now: Date = new Date(),
): Promise<EnrollmentResult> {
  const update = input.date
    ? { endDate: input.date, updatedAt: now }
    : { status: "INATIVA" as const, updatedAt: now };

  const [updated] = await db
    .update(fixedEnrollments)
    .set(update)
    .where(eq(fixedEnrollments.id, enrollmentId))
    .returning();

  return updated
    ? { ok: true, value: updated }
    : { ok: false, error: "enrollment nao encontrado" };
}

/** Historico por aluno: ativos e encerrados, do mais antigo (RES-24). */
export async function listEnrollmentsByStudent(
  db: DbClient,
  studentId: string,
): Promise<Enrollment[]> {
  return db
    .select()
    .from(fixedEnrollments)
    .where(eq(fixedEnrollments.studentId, studentId))
    .orderBy(asc(fixedEnrollments.startDate));
}
