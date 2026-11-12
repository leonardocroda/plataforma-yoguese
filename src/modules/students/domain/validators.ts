// Validadores puros do cadastro de aluna (STUD-02, PRD 4.4): cada campo
// obrigatorio e recusado no servidor com erro especifico. O plano so e
// obrigatorio quando o status e ATIVO (assuncao do spec: Experimental e
// Aguardando matricula podem nascer sem plano).

import { studentStatusEnum } from "../../../db/schema/students";

export type StudentValidationError = { field: string; message: string };

export type StudentValidationResult =
  | { ok: true }
  | { ok: false; errors: StudentValidationError[] };

export type StudentStatus = (typeof studentStatusEnum.enumValues)[number];

const STATUSES: readonly string[] = studentStatusEnum.enumValues;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type StudentData = {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  enrollmentDate?: string;
  planId?: string | null;
  status: StudentStatus;
};

/** Data "YYYY-MM-DD" de calendario real (rejeita 2024-02-31 e afins). */
export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function validateStudent(data: StudentData): StudentValidationResult {
  const errors: StudentValidationError[] = [];

  if (data.name.trim() === "") {
    errors.push({ field: "name", message: "nome obrigatorio" });
  }

  if (data.phone.trim() === "") {
    errors.push({ field: "phone", message: "telefone obrigatorio" });
  }

  if (data.email.trim() === "" || !EMAIL_PATTERN.test(data.email.trim())) {
    errors.push({ field: "email", message: "e-mail invalido" });
  }

  if (!isValidDate(data.birthDate)) {
    errors.push({
      field: "birthDate",
      message: "data de nascimento invalida",
    });
  }

  if (
    data.enrollmentDate !== undefined &&
    data.enrollmentDate !== "" &&
    !isValidDate(data.enrollmentDate)
  ) {
    errors.push({
      field: "enrollmentDate",
      message: "data de matricula invalida",
    });
  }

  if (!STATUSES.includes(data.status)) {
    errors.push({ field: "status", message: "status invalido" });
  }

  if (data.status === "ATIVO" && !data.planId) {
    errors.push({
      field: "planId",
      message: "plano obrigatorio para aluna ativa",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
