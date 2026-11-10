"use server";

import type { DbClient } from "../bookings/services/sessions";
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
 * error/field). Nenhuma regra e repetida aqui - o motivo obrigatorio
 * (CRD-16) e a escolha do credito da reposicao (CRD-43) sao decididos pelos
 * servicos. Sem auth nesta slice: o responsavel fica por rotulo (AD-016).
 */

/**
 * O client so e necessario em tempo de execucao. O import dinamico mantem o
 * build (`next build`) funcionando sem DATABASE_URL configurada.
 */
async function dbClient(): Promise<DbClient> {
  const { db } = await import("../../db");
  return db;
}

/** Rotulo do responsavel enquanto nao ha auth (AD-016, AD-023). */
const DEFAULT_ADMIN_LABEL = "admin";

// ---- creditos (CRD-34 a CRD-36, CRD-40) ----

/**
 * Concede um credito manual ao aluno (CRD-34): o credito nasce DISPONIVEL
 * com vencimento 30 dias depois e a transacao da concessao e devolvida.
 */
export async function grantCreditAction(input: {
  studentId: string;
  reason: string;
  adminLabel?: string;
}) {
  return grantCreditService(await dbClient(), {
    studentId: input.studentId,
    // Concessao do admin e sempre da origem CONCESSAO_MANUAL (CRD-34)
    source: "CONCESSAO_MANUAL",
    reason: input.reason,
    adminLabel: input.adminLabel ?? DEFAULT_ADMIN_LABEL,
  });
}

/**
 * Devolve o credito a DISPONIVEL mantendo o vencimento original (CRD-35,
 * AD-021). Sem motivo a operacao e recusada pelo servico (CRD-16).
 */
export async function returnCreditAction(input: {
  creditId: string;
  reason: string;
  adminLabel?: string;
}) {
  return returnCreditService(await dbClient(), {
    creditId: input.creditId,
    reason: input.reason,
    adminLabel: input.adminLabel ?? DEFAULT_ADMIN_LABEL,
  });
}

/**
 * Cancela o credito definitivamente (CRD-36). Sem motivo a operacao e
 * recusada pelo servico (CRD-16).
 */
export async function cancelCreditAction(input: {
  creditId: string;
  reason: string;
  adminLabel?: string;
}) {
  return cancelCreditService(await dbClient(), {
    creditId: input.creditId,
    reason: input.reason,
    adminLabel: input.adminLabel ?? DEFAULT_ADMIN_LABEL,
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
  adminLabel?: string;
}) {
  return registerNonAttendanceService(await dbClient(), {
    studentId: input.studentId,
    classSessionId: input.classSessionId,
    adminLabel: input.adminLabel ?? DEFAULT_ADMIN_LABEL,
  });
}

/**
 * Cancela a aula pelo estudio (CRD-42): devolve as reservas canceladas, os
 * creditos devolvidos e a quantidade de creditos gerados.
 */
export async function cancelOccurrenceByStudioAction(input: {
  classSessionId: string;
  adminLabel?: string;
}) {
  return cancelOccurrenceByStudioService(await dbClient(), {
    classSessionId: input.classSessionId,
    adminLabel: input.adminLabel ?? DEFAULT_ADMIN_LABEL,
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
  return bookMakeupByAdminService(await dbClient(), {
    studentId: input.studentId,
    classSlotId: input.classSlotId,
    date: input.date,
    // Sem escolha de credito o servico recusa a reposicao (CRD-43)
    creditId: input.creditId ?? "",
  });
}

/** Creditos do aluno com geracao, vencimento, status, origem e transacoes. */
export async function listStudentCreditsAction(studentId: string) {
  return listStudentCreditsService(await dbClient(), studentId);
}
