"use server";

import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import type { DbClient } from "../bookings/services/sessions";
import { requireAdminSession } from "../auth/services/session";
import {
  cancelCredit as cancelCreditService,
  grantCredit as grantCreditService,
  listStudentCredits as listStudentCreditsService,
  returnCredit as returnCreditService,
} from "./services/credits";
import {
  cancelOccurrenceByStudio as cancelOccurrenceByStudioService,
  registerNonAttendance as registerNonAttendanceService,
} from "./services/cancellations";
import { bookMakeupByAdmin as bookMakeupByAdminService } from "./services/makeups";

/**
 * Server actions do admin para creditos (CRD-34 a CRD-36, CRD-40 a CRD-43).
 * Finas: cada action chama um servico e devolve o resultado dele (ok/value ou
 * error/field). Nenhuma regra e repetida aqui. Toda action exige sessao de
 * ADMIN no servidor (AUTH-01, PRD 13.3) e o rotulo de auditoria sai da
 * administradora logada (AD-016).
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
 * Sessao + rotulo da admin logada: o nome gravado nas transacoes vem da
 * sessao (AD-016). O guard roda antes de qualquer leitura no banco.
 */
async function adminContext(): Promise<{ db: DbClient; adminLabel: string }> {
  const session = await requireAdminSession();
  const db = await dbClient();
  const [admin] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId));
  return { db, adminLabel: admin?.name ?? "admin" };
}

// ---- creditos (CRD-34 a CRD-36, CRD-40) ----

/**
 * Concede um credito manual ao aluno (CRD-34): o credito nasce DISPONIVEL
 * com vencimento 30 dias depois e a transacao da concessao e devolvida.
 */
export async function grantCreditAction(input: {
  studentId: string;
  reason: string;
}) {
  const { db, adminLabel } = await adminContext();
  return grantCreditService(db, {
    studentId: input.studentId,
    // Concessao do admin e sempre da origem CONCESSAO_MANUAL (CRD-34)
    source: "CONCESSAO_MANUAL",
    reason: input.reason,
    adminLabel,
  });
}

/**
 * Devolve o credito a DISPONIVEL mantendo o vencimento original (CRD-35,
 * AD-021). Sem motivo a operacao e recusada pelo servico (CRD-16).
 */
export async function returnCreditAction(input: {
  creditId: string;
  reason: string;
}) {
  const { db, adminLabel } = await adminContext();
  return returnCreditService(db, {
    creditId: input.creditId,
    reason: input.reason,
    adminLabel,
  });
}

/**
 * Cancela o credito definitivamente (CRD-36). Sem motivo a operacao e
 * recusada pelo servico (CRD-16).
 */
export async function cancelCreditAction(input: {
  creditId: string;
  reason: string;
}) {
  const { db, adminLabel } = await adminContext();
  return cancelCreditService(db, {
    creditId: input.creditId,
    reason: input.reason,
    adminLabel,
  });
}

// ---- cancelamentos e reposicao (CRD-41 a CRD-43) ----

/**
 * Registra, em nome do aluno, o aviso de nao comparecimento na ocorrencia
 * (AD-023): devolve o cancelamento com credito gerado ou a falta sem
 * credito, conforme a antecedencia de 24h (CRD-41).
 */
export async function registerNonAttendanceAction(input: {
  studentId: string;
  classSessionId: string;
}) {
  const { db, adminLabel } = await adminContext();
  return registerNonAttendanceService(db, {
    studentId: input.studentId,
    classSessionId: input.classSessionId,
    adminLabel,
  });
}

/**
 * Cancela a aula pelo estudio (CRD-42): devolve as reservas canceladas, os
 * creditos devolvidos e a quantidade de creditos gerados.
 */
export async function cancelOccurrenceByStudioAction(input: {
  classSessionId: string;
}) {
  const { db, adminLabel } = await adminContext();
  return cancelOccurrenceByStudioService(db, {
    classSessionId: input.classSessionId,
    adminLabel,
  });
}

/**
 * Agenda a reposicao manual do admin (CRD-43): exige a escolha de um credito
 * DISPONIVEL do aluno e ignora o limite semanal (AD-019). Sem credito
 * escolhido o servico recusa e nenhuma reserva e criada.
 */
export async function bookMakeupByAdminAction(input: {
  studentId: string;
  classSlotId: string;
  date: string;
  creditId?: string | null;
}) {
  const { db } = await adminContext();
  return bookMakeupByAdminService(db, {
    studentId: input.studentId,
    classSlotId: input.classSlotId,
    date: input.date,
    // Sem escolha de credito o servico recusa a reposicao (CRD-43)
    creditId: input.creditId ?? "",
  });
}

/** Creditos do aluno com geracao, vencimento, status, origem e transacoes. */
export async function listStudentCreditsAction(studentId: string) {
  const { db } = await adminContext();
  return listStudentCreditsService(db, studentId);
}
