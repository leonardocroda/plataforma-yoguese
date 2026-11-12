"use server";

import type { DbClient } from "../bookings/services/sessions";
import { requireAdminSession } from "../auth/services/session";
import {
  createStudent as createStudentService,
  getStudentProfile as getStudentProfileService,
  listStudents as listStudentsService,
  setStudentStatus as setStudentStatusService,
  updateStudent as updateStudentService,
  type StudentProfileResult,
  type StudentWithPlan,
} from "./services/students";

/**
 * Server actions do admin para alunas (STUD-01 a STUD-05). Finas: cada
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

/** Cria a aluna com o cadastro completo do PRD 4.4 (STUD-01, STUD-02). */
export async function createStudentAction(input: {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  enrollmentDate?: string;
  planId?: string | null;
  status: "EXPERIMENTAL" | "AGUARDANDO_MATRICULA" | "ATIVO" | "INATIVO";
  notes?: string | null;
}) {
  await requireAdminSession();
  return createStudentService(await dbClient(), input);
}

/** Edita a aluna (STUD-05): o formulario manda o cadastro completo. */
export async function updateStudentAction(input: {
  studentId: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  enrollmentDate?: string;
  planId?: string | null;
  status: "EXPERIMENTAL" | "AGUARDANDO_MATRICULA" | "ATIVO" | "INATIVO";
  notes?: string | null;
}) {
  await requireAdminSession();
  const { studentId, ...data } = input;
  return updateStudentService(await dbClient(), { studentId, ...data });
}

/** Ciclo de vida por status (STUD-03): inativar e reativar. */
export async function setStudentStatusAction(input: {
  studentId: string;
  status: "EXPERIMENTAL" | "AGUARDANDO_MATRICULA" | "ATIVO" | "INATIVO";
}) {
  await requireAdminSession();
  return setStudentStatusService(await dbClient(), input);
}

/** Listagem completa com o plano - tela /alunos. */
export async function listStudentsAction(): Promise<StudentWithPlan[]> {
  await requireAdminSession();
  return listStudentsService(await dbClient());
}

/** Perfil agregado do detalhe (STUD-08). */
export async function getStudentProfileAction(
  studentId: string,
): Promise<StudentProfileResult> {
  await requireAdminSession();
  return getStudentProfileService(await dbClient(), studentId);
}
