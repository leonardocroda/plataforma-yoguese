// CRUD de planos (PLAN-01 a PLAN-03) e a regra do seletor (PLAN-04, PLAN-05):
// plano inativo deixa de ser oferecido nos formularios de aluna, mas o plano
// atual de uma aluna em edicao continua listado. O preco vive no banco
// (PLAN-06): nenhuma tabela de valores no codigo.

import { asc, eq, or } from "drizzle-orm";
import { plans } from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import { validatePlan } from "../domain/validators";

export type { DbClient };

export type Plan = typeof plans.$inferSelect;

export type PlanStatus = (typeof plans.status.enumValues)[number];

export type PlanResult =
  | { ok: true; value: Plan }
  | { ok: false; error: string; field?: string };

export type PlanInput = {
  name: string;
  price: string;
  weeklyFrequency: number;
  description?: string | null;
  status?: PlanStatus;
};

function validationError(errors: { field: string; message: string }[]): string {
  return errors.map((error) => `${error.field}: ${error.message}`).join("; ");
}

/** O Drizzle embrulha o erro do Postgres: a mensagem original vem no cause. */
function isUniqueViolation(error: unknown): boolean {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages
    .join(" | ")
    .includes("duplicate key value violates unique constraint");
}

/**
 * Cria o plano completo do formulario do admin (PLAN-01). Valor e frequencia
 * invalidos sao recusados pelo validador com erro por campo (PLAN-02).
 */
export async function createPlan(
  db: DbClient,
  input: PlanInput,
  now: Date = new Date(),
): Promise<PlanResult> {
  const validation = validatePlan({
    name: input.name,
    price: input.price,
    weeklyFrequency: input.weeklyFrequency,
  });
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  try {
    const [created] = await db
      .insert(plans)
      .values({
        name: input.name.trim(),
        price: input.price,
        weeklyFrequency: input.weeklyFrequency,
        description: input.description ?? null,
        status: input.status ?? "ATIVO",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created
      ? { ok: true, value: created }
      : { ok: false, error: "falha ao gravar plano" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "ja existe plano com este nome", field: "name" };
    }
    throw error;
  }
}

/**
 * Edita o plano (PLAN-03): patch parcial mesclado com o atual, validado
 * sobre os dados finais, igual ao update de turma. Inativar e uma edicao de
 * status (PLAN-04).
 */
export async function updatePlan(
  db: DbClient,
  input: Partial<PlanInput> & { planId: string },
  now: Date = new Date(),
): Promise<PlanResult> {
  const [current] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId));
  if (!current) return { ok: false, error: "plano nao encontrado" };

  const merged = {
    name: input.name ?? current.name,
    price: input.price ?? current.price,
    weeklyFrequency: input.weeklyFrequency ?? current.weeklyFrequency,
  };
  const validation = validatePlan(merged);
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  try {
    const [updated] = await db
      .update(plans)
      .set({
        name: merged.name.trim(),
        price: merged.price,
        weeklyFrequency: merged.weeklyFrequency,
        description: input.description ?? current.description,
        status: input.status ?? current.status,
        updatedAt: now,
      })
      .where(eq(plans.id, input.planId))
      .returning();
    return updated
      ? { ok: true, value: updated }
      : { ok: false, error: "falha ao editar plano" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "ja existe plano com este nome", field: "name" };
    }
    throw error;
  }
}

/** Todos os planos, ordenados por nome - listagem da tela /planos. */
export async function listPlans(db: DbClient): Promise<Plan[]> {
  return db.select().from(plans).orderBy(asc(plans.name));
}

/**
 * Planos oferecidos no seletor de aluna (PLAN-04): apenas ATIVO, mais o plano
 * atual da aluna em edicao mesmo inativo (PLAN-05 - ela o mantem visivel).
 */
export async function listSelectablePlans(
  db: DbClient,
  currentPlanId?: string,
): Promise<Plan[]> {
  const condition = currentPlanId
    ? or(eq(plans.status, "ATIVO"), eq(plans.id, currentPlanId))
    : eq(plans.status, "ATIVO");

  return db.select().from(plans).where(condition).orderBy(asc(plans.name));
}
