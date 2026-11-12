"use server";

import type { DbClient } from "../bookings/services/sessions";
import { requireAdminSession } from "../auth/services/session";
import {
  createPlan as createPlanService,
  listPlans as listPlansService,
  listSelectablePlans as listSelectablePlansService,
  updatePlan as updatePlanService,
  type Plan,
} from "./services/plans";

/**
 * Server actions do admin para planos (PLAN-01 a PLAN-04). Finas: cada
 * action chama um servico e devolve o resultado dele (ok/value ou
 * error/field). Toda action exige sessao de ADMIN no servidor (AUTH-01,
 * PRD 13.3).
 */

/**
 * O client so e necessario em tempo de execucao. O import dinamico mantem o
 * build (`next build`) funcionando sem DATABASE_URL configurada.
 */
async function dbClient(): Promise<DbClient> {
  const { db } = await import("../../db");
  return db;
}

/**
 * Cria o plano completo do formulario (PLAN-01). Valor <= 0 e frequencia
 * < 1 sao recusados pelo servico com erro por campo (PLAN-02).
 */
export async function createPlanAction(input: {
  name: string;
  price: string;
  weeklyFrequency: number;
  description?: string | null;
}) {
  await requireAdminSession();
  return createPlanService(await dbClient(), input);
}

/**
 * Edita o plano (PLAN-03). Inativar e uma edicao com status INATIVO.
 */
export async function updatePlanAction(input: {
  planId: string;
  name?: string;
  price?: string;
  weeklyFrequency?: number;
  description?: string | null;
  status?: "ATIVO" | "INATIVO";
}) {
  await requireAdminSession();
  return updatePlanService(await dbClient(), input);
}

/** Inativa o plano: deixa de ser oferecido no seletor de aluna (PLAN-04). */
export async function deactivatePlanAction(planId: string) {
  await requireAdminSession();
  return updatePlanService(await dbClient(), { planId, status: "INATIVO" });
}

/** Todos os planos, ordenados por nome - listagem da tela /planos. */
export async function listPlansAction(): Promise<Plan[]> {
  await requireAdminSession();
  return listPlansService(await dbClient());
}

/**
 * Planos oferecidos no seletor de aluna (PLAN-04): apenas ATIVO, mais o
 * plano atual da aluna em edicao mesmo inativo.
 */
export async function listSelectablePlansAction(
  currentPlanId?: string,
): Promise<Plan[]> {
  await requireAdminSession();
  return listSelectablePlansService(await dbClient(), currentPlanId);
}
