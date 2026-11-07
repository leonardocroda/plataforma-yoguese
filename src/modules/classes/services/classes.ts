import { and, asc, eq, isNull, lte, or, gt, count } from "drizzle-orm";
import * as schema from "../../../db/schema";
import {
  bookings,
  classSessions,
  classSlots,
  classTypes,
} from "../../../db/schema";
import {
  SlotValidationError,
  SlotData,
  validateSlot,
} from "../domain/validators";
import { todayInStudio, nextOccurrence } from "../domain/occurrences";
import {
  Composition,
  calculateComposition,
} from "../../bookings/domain/composition";
import {
  DbClient,
  materializeSession,
  Session,
} from "../../bookings/services/sessions";

export type { DbClient };

export type ClassType = typeof classTypes.$inferSelect;
export type Slot = typeof classSlots.$inferSelect;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

/**
 * CRUD de modalidades e turmas (RES-01 a RES-05) e o servico unico de
 * leitura de composicao por (slot, data) (RES-27), fonte para painel,
 * agendamento e leitura publica.
 */

// ---- modalidades (RES-05) ----

export async function createClassType(
  db: DbClient,
  input: { name: string },
): Promise<Result<ClassType>> {
  const [created] = await db.insert(classTypes).values(input).returning();
  return created
    ? { ok: true, value: created }
    : { ok: false, error: "falha ao gravar modalidade" };
}

export async function updateClassType(
  db: DbClient,
  id: string,
  patch: { name?: string; status?: "ATIVA" | "INATIVA" },
  now: Date = new Date(),
): Promise<Result<ClassType>> {
  const [updated] = await db
    .update(classTypes)
    .set({ ...patch, updatedAt: now })
    .where(eq(classTypes.id, id))
    .returning();
  return updated
    ? { ok: true, value: updated }
    : { ok: false, error: "modalidade nao encontrada" };
}

// ---- turmas/slots (RES-01..RES-04) ----

export async function createSlot(
  db: DbClient,
  input: {
    classTypeId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    capacity?: number;
  },
): Promise<Result<Slot>> {
  const [classType] = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, input.classTypeId));
  if (!classType) {
    return {
      ok: false,
      error: "modalidade nao encontrada",
      field: "classTypeId",
    };
  }

  const data: SlotData = {
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    // RES-02: sem capacidade informada, o PRD grava 8
    capacity: input.capacity ?? 8,
  };
  const validation = validateSlot(data);
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  const [created] = await db
    .insert(classSlots)
    .values({
      classTypeId: input.classTypeId,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      capacity: data.capacity,
    })
    .returning();
  return created
    ? { ok: true, value: created }
    : { ok: false, error: "falha ao gravar turma" };
}

export async function updateSlot(
  db: DbClient,
  id: string,
  patch: Partial<SlotData> & { status?: "ATIVA" | "INATIVA" },
  now: Date = new Date(),
): Promise<Result<Slot>> {
  const [current] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, id));
  if (!current) return { ok: false, error: "turma nao encontrada" };

  const merged: SlotData = {
    weekday: patch.weekday ?? current.weekday,
    startTime: patch.startTime ?? current.startTime,
    endTime: patch.endTime ?? current.endTime,
    capacity: patch.capacity ?? current.capacity,
  };
  const validation = validateSlot(merged);
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  // Edge case de capacidade: editar para valor menor que a ocupacao de uma
  // ocorrencia futura recusa, informando a ocorrencia mais afetada
  if (patch.capacity !== undefined && merged.capacity < current.capacity) {
    const today = todayInStudio(now);
    const mostAffected = await mostAffectedOccurrence(
      db,
      current.id,
      current.weekday,
      today,
    );
    if (mostAffected && mostAffected.occupancy > merged.capacity) {
      return {
        ok: false,
        error: `capacidade ${merged.capacity} menor que ocupacao ${mostAffected.occupancy} na ocorrencia de ${mostAffected.date}`,
        field: "capacity",
      };
    }
  }

  const [edited] = await db
    .update(classSlots)
    .set({ ...merged, ...withStatus(patch.status), updatedAt: now })
    .where(eq(classSlots.id, id))
    .returning();
  return edited
    ? { ok: true, value: edited }
    : { ok: false, error: "falha ao editar turma" };
}

export async function deactivateSlot(
  db: DbClient,
  id: string,
  now: Date = new Date(),
): Promise<Result<Slot>> {
  const [deactivated] = await db
    .update(classSlots)
    .set({ status: "INATIVA", updatedAt: now })
    .where(eq(classSlots.id, id))
    .returning();
  return deactivated
    ? { ok: true, value: deactivated }
    : { ok: false, error: "turma nao encontrada" };
}

// ---- leitura unica de composicao (RES-27) ----

export type SlotWithType = {
  id: string;
  classTypeId: string;
  classTypeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
};

/**
 * Turmas ativas com o nome da modalidade - base da grade do painel e da
 * agenda publica. Turma inativa nao aparece em nenhuma das duas.
 */
export async function listActiveSlots(db: DbClient): Promise<SlotWithType[]> {
  return db
    .select({
      id: classSlots.id,
      classTypeId: classSlots.classTypeId,
      classTypeName: classTypes.name,
      weekday: classSlots.weekday,
      startTime: classSlots.startTime,
      endTime: classSlots.endTime,
      capacity: classSlots.capacity,
    })
    .from(classSlots)
    .innerJoin(classTypes, eq(classSlots.classTypeId, classTypes.id))
    .where(eq(classSlots.status, "ATIVA"))
    .orderBy(asc(classSlots.startTime));
}

export type OccurrenceComposition = Composition & {
  classSlotId: string;
  date: string;
  sessionId: string;
  sessionStatus: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
};

/**
 * Composicao/vagas de uma ocorrencia por (slot, data) - toda leitura de
 * painel, agendamento e site passa por aqui (RES-27). Data no futuro/today
 * materializa (get-or-create, RES-06); data no passado e somente leitura
 * (RES-10).
 */
export async function getComposition(
  db: DbClient,
  input: { classSlotId: string; date: string },
  now: Date = new Date(),
): Promise<Result<OccurrenceComposition>> {
  const today = todayInStudio(now);

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));
  if (!slot) return { ok: false, error: "turma nao encontrada" };

  const isPast = input.date < today;

  let session: Session | undefined;
  if (isPast) {
    // Leitura apenas: nada de materializacao no passado (RES-10 AC5)
    [session] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.classSlotId, input.classSlotId),
          eq(classSessions.sessionDate, input.date),
        ),
      );
    if (!session) {
      return { ok: false, error: "ocorrencia passada nao existe para leitura" };
    }
  } else {
    const materialized = await materializeSession(db, input, now);
    if (!materialized.ok) {
      return {
        ok: false,
        error: materialized.error,
        field: materialized.field,
      };
    }
    session = materialized.value;
  }

  const counts = await occurrenceCounts(db, session, input.classSlotId);
  const composition = calculateComposition({
    capacity: slot.capacity,
    ...counts,
  });

  return {
    ok: true,
    value: {
      ...composition,
      classSlotId: input.classSlotId,
      date: input.date,
      sessionId: session.id,
      sessionStatus: session.status,
    },
  };
}

// ---- internos ----

function validationError(errors: SlotValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}

function withStatus(status?: "ATIVA" | "INATIVA") {
  return status ? { status } : {};
}

type Counts = { fixedCount: number; makeupCount: number; experimentalCount: number };

/** Fixos derivados (AD-008): enrollments ativos na data + FIXED bookings. */
async function occurrenceCounts(
  db: DbClient,
  session: Pick<Session, "id" | "classSlotId" | "sessionDate">,
  classSlotId: string,
): Promise<Counts> {
  const [{ total: fixedEnrollmentsCount }] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        lte(schema.fixedEnrollments.startDate, session.sessionDate),
        or(
          isNull(schema.fixedEnrollments.endDate),
          gt(schema.fixedEnrollments.endDate, session.sessionDate),
        ),
      ),
    );

  const bookingsByType = await db
    .select({ type: bookings.bookingType, total: count() })
    .from(bookings)
    .where(
      and(eq(bookings.classSessionId, session.id), eq(bookings.status, "ATIVA")),
    )
    .groupBy(bookings.bookingType);

  const byType = new Map(bookingsByType.map((b) => [b.type, Number(b.total)]));

  return {
    fixedCount: Number(fixedEnrollmentsCount) + (byType.get("FIXED") ?? 0),
    makeupCount: byType.get("MAKEUP") ?? 0,
    experimentalCount: byType.get("EXPERIMENTAL") ?? 0,
  };
}

type AffectedOccurrence = { date: string; occupancy: number };

/**
 * Ocorrencia futura mais afetada por uma reducao de capacidade: sessions
 * materializadas futuras + a proxima ocorrencia ainda sem materializacao
 * (ocupacao por enrollments). Precisao do spec: "ocorrencias em aberto" nao
 * tem horizonte definido; escolhemos materializadas futuras + proxima data.
 */
async function mostAffectedOccurrence(
  db: DbClient,
  classSlotId: string,
  weekday: number,
  today: string,
): Promise<AffectedOccurrence | null> {
  const materialized = await db
    .select({ id: classSessions.id, date: classSessions.sessionDate })
    .from(classSessions)
    .where(
      and(eq(classSessions.classSlotId, classSlotId), gt(classSessions.sessionDate, today)),
    )
    .orderBy(asc(classSessions.sessionDate));

  const candidates = [...materialized.map((s) => s.date)];
  const next = nextOccurrence({ weekday }, today);
  if (!candidates.includes(next)) candidates.push(next);

  let mostAffected: AffectedOccurrence | null = null;
  for (const date of candidates) {
    const occupancy = await occupancyOnDate(db, classSlotId, date);
    if (!mostAffected || occupancy > mostAffected.occupancy) {
      mostAffected = { date, occupancy };
    }
  }
  return mostAffected;
}

/** Ocupacao de uma data: bookings ativos da ocorrencia (se materializada) + fixos. */
async function occupancyOnDate(
  db: DbClient,
  classSlotId: string,
  date: string,
): Promise<number> {
  const [session] = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(eq(classSessions.classSlotId, classSlotId), eq(classSessions.sessionDate, date)),
    );

  let activeBookings = 0;
  if (session) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(bookings)
      .where(
        and(eq(bookings.classSessionId, session.id), eq(bookings.status, "ATIVA")),
      );
    activeBookings = Number(total);
  }

  const [{ total: fixed }] = await db
    .select({ total: count() })
    .from(schema.fixedEnrollments)
    .where(
      and(
        eq(schema.fixedEnrollments.classSlotId, classSlotId),
        eq(schema.fixedEnrollments.status, "ATIVA"),
        lte(schema.fixedEnrollments.startDate, date),
        or(
          isNull(schema.fixedEnrollments.endDate),
          gt(schema.fixedEnrollments.endDate, date),
        ),
      ),
    );

  return activeBookings + Number(fixed);
}
