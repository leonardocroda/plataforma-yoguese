import { and, asc, eq, gt } from "drizzle-orm";
import {
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
import { DbClient } from "../../bookings/services/sessions";
import { getOccurrenceComposition } from "../../bookings/services/composition";

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
      current.capacity,
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
 * agenda publica. Turma inativa e modalidade inativa nao aparecem em nenhuma
 * das duas (RES-05, AD-014).
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
    .where(
      and(
        eq(classSlots.status, "ATIVA"),
        eq(classTypes.status, "ATIVA"),
      ),
    )
    .orderBy(asc(classSlots.startTime));
}

// ---- internos ----

function validationError(errors: SlotValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}

function withStatus(status?: "ATIVA" | "INATIVA") {
  return status ? { status } : {};
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
  capacity: number,
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
    const occupancy = await occupancyOnDate(db, classSlotId, date, capacity);
    if (!mostAffected || occupancy > mostAffected.occupancy) {
      mostAffected = { date, occupancy };
    }
  }
  return mostAffected;
}

/** Ocupacao de uma data: reservas ativas da ocorrencia (se materializada) + fixos. */
async function occupancyOnDate(
  db: DbClient,
  classSlotId: string,
  date: string,
  capacity: number,
): Promise<number> {
  const [session] = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(eq(classSessions.classSlotId, classSlotId), eq(classSessions.sessionDate, date)),
    );

  // Mesma fonte unica do agendamento (RES-27)
  const composition = await getOccurrenceComposition(db, {
    classSlotId,
    sessionId: session?.id ?? null,
    date,
    capacity,
  });

  return composition.total;
}
