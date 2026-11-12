// Textos fixos e validacao da experimental (PRD 8.1, 8.4, 8.6, EXP-02,
// EXP-03, EXP-06, EXP-07, EXP-27, EXP-32, EXP-33, EXP-51, EXP-52). A
// declaracao e o preco sao constantes do dominio: o texto gravado vem do
// servidor, nao do cliente.

import {
  experimentalPaymentStatusEnum,
  experimentalStatusEnum,
} from "../../../db/schema/experimentals";
import {
  validateStudent,
  type StudentValidationError,
} from "../../students/domain/validators";
import { isValidPhone, normalizePhone } from "./phone";

export type ExperimentalStatus = (typeof experimentalStatusEnum.enumValues)[number];

export type ExperimentalPaymentStatus =
  (typeof experimentalPaymentStatusEnum.enumValues)[number];

export type ExperimentalValidationError = StudentValidationError;

export type ExperimentalValidationResult =
  | { ok: true }
  | { ok: false; errors: ExperimentalValidationError[] };

/** Declaracao de saude do PRD 8.1, acceptada como obrigatoria no envio. */
export const HEALTH_DECLARATION =
  "Declaro estar em condições de saúde aptas à prática de yoga e me comprometo a informar à professora qualquer condição ou limitação relevante para a realização das atividades.";

/** Valor da aula experimental do PRD 8.4: R$ 45,00. */
export const EXPERIMENTAL_PRICE_CENTS = 4500;

/** Termos exatos dos status do ciclo de vida da experimental (EXP-32). */
export const EXPERIMENTAL_STATUS_LABELS: Record<ExperimentalStatus, string> = {
  PENDENTE: "Pendente de aprovação",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  CANCELADA_COM_DIREITO: "Cancelada com direito a reagendamento",
  CANCELADA_SEM_DIREITO: "Cancelada sem direito a reagendamento",
  FALTA: "Falta",
  CONVERTIDA: "Convertida em aluna",
  DUPLICADA: "Tentativa duplicada",
};

/** Termos exatos dos status de pagamento do PRD 8.4 (EXP-33). */
export const PAYMENT_STATUS_LABELS: Record<ExperimentalPaymentStatus, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ISENTO: "Isento",
  REEMBOLSADO: "Reembolsado",
};

export type ExperimentalRequestInput = {
  name: string;
  phone: string;
  classTypeId: string;
  classSlotId: string;
  date: string;
  declarationAccepted: boolean;
};

/**
 * Solicricao publica (EXP-06, EXP-07): nome, telefone e declaracao sao
 * obrigatorios, e a ocorrencia escolhida tambem. Cada recusa aponta o
 * campo, para o formulario mostrar o erro no lugar certo.
 */
export function validateExperimentalRequest(
  input: ExperimentalRequestInput,
): ExperimentalValidationResult {
  const errors: ExperimentalValidationError[] = [];

  if (input.name.trim() === "") {
    errors.push({ field: "name", message: "nome obrigatorio" });
  }

  if (!isValidPhone(normalizePhone(input.phone))) {
    errors.push({ field: "phone", message: "telefone invalido" });
  }

  if (!input.declarationAccepted) {
    errors.push({
      field: "healthDeclaration",
      message: "a declaracao de saude e obrigatoria",
    });
  }

  if (input.classTypeId.trim() === "") {
    errors.push({ field: "classTypeId", message: "modalidade obrigatoria" });
  }

  if (input.classSlotId.trim() === "") {
    errors.push({ field: "classSlotId", message: "turma obrigatoria" });
  }

  if (input.date.trim() === "") {
    errors.push({ field: "date", message: "data obrigatoria" });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

export type ConversionInput = {
  /** Nome e telefone vem da solicitacao da experimental. */
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  planId: string;
  /** Horarios fixos escolhidos na conversao (EXP-51). */
  classSlotIds: string[];
};

/**
 * Conversao em aluna (EXP-51, EXP-52): o cadastro criado pela conversao
 * passa pelo mesmo validador de aluna do modulo de alunas, e a conversao
 * exige ainda ao menos um horario fixo.
 */
export function validateConversion(
  input: ConversionInput,
): ExperimentalValidationResult {
  const student = validateStudent({
    name: input.name,
    phone: input.phone,
    email: input.email,
    birthDate: input.birthDate,
    status: "ATIVO",
    planId: input.planId,
  });

  const errors: ExperimentalValidationError[] = student.ok
    ? []
    : [...student.errors];

  if (input.classSlotIds.length === 0) {
    errors.push({
      field: "classSlotIds",
      message: "escolha ao menos um horario fixo",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
