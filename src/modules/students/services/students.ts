// Cadastro completo da aluna (STUD-01 a STUD-05, PLAN-05) e o perfil
// agregado do detalhe (STUD-08). As regras de vaga continuam no modulo de
// bookings; aqui vive o cadastro e a leitura agregada.

import { asc, eq, or } from "drizzle-orm";
import { and, gte, isNull } from "drizzle-orm";
import {
  classSlots,
  classTypes,
  fixedEnrollments,
  plans,
  students,
} from "../../../db/schema";
import { todayInStudio } from "../../classes/domain/occurrences";
import type { DbClient } from "../../bookings/services/sessions";
import { normalizeEmail } from "../../auth/services/credentials";
import {
  listStudentCredits,
  type StudentCredit,
} from "../../credits/services/credits";
import { listStudentBookings, type StudentBooking } from "../../bookings/services/bookings";
import {
  validateStudent,
  type StudentStatus,
} from "../domain/validators";

export type { DbClient, StudentStatus };

export type Student = typeof students.$inferSelect;
export type Plan = typeof plans.$inferSelect;

export type StudentResult =
  | { ok: true; value: Student }
  | { ok: false; error: string; field?: string };

export type StudentInput = {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  enrollmentDate?: string;
  planId?: string | null;
  status: StudentStatus;
  notes?: string | null;
};

/**
 * Alunos ativos do estudio - base da selecao do admin nos formularios de
 * reserva manual e de horario fixo.
 */
export async function listActiveStudents(db: DbClient): Promise<Student[]> {
  return db
    .select()
    .from(students)
    .where(eq(students.status, "ATIVO"))
    .orderBy(asc(students.name));
}

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

function enrollmentDateOrToday(
  input: StudentInput,
  now: Date,
): string {
  return input.enrollmentDate || todayInStudio(now);
}

async function emailTaken(
  db: DbClient,
  email: string,
  exceptStudentId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.email, email));
  return rows.some((row) => row.id !== exceptStudentId);
}

/**
 * Cria a aluna com o cadastro completo do PRD 4.4 (STUD-01). Campos
 * obrigatorios e formato sao recusados pelo validador com erro por campo
 * (STUD-02); e-mail duplicado e recusado com erro proprio (STUD-04). A data
 * de matricula sem informacao entra como hoje (assuncao do spec).
 */
export async function createStudent(
  db: DbClient,
  input: StudentInput,
  now: Date = new Date(),
): Promise<StudentResult> {
  const validation = validateStudent(input);
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  // E-mail e identidade de acesso (edge case do spec): igual sem distinguir
  // maiusculas e duplicado (STUD-10), e gravado normalizado
  const email = normalizeEmail(input.email);
  if (await emailTaken(db, email)) {
    return { ok: false, error: "e-mail ja cadastrado", field: "email" };
  }

  try {
    const [created] = await db
      .insert(students)
      .values({
        name: input.name.trim(),
        phone: input.phone.trim(),
        email,
        birthDate: input.birthDate,
        enrollmentDate: enrollmentDateOrToday(input, now),
        planId: input.planId ?? null,
        status: input.status,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created
      ? { ok: true, value: created }
      : { ok: false, error: "falha ao gravar aluna" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "e-mail ja cadastrado", field: "email" };
    }
    throw error;
  }
}

/**
 * Edita a aluna (STUD-05): o formulario manda o cadastro completo; o e-mail
 * duplicado de OUTRA aluna e recusado (o proprio e-mail atual passa).
 */
export async function updateStudent(
  db: DbClient,
  input: StudentInput & { studentId: string },
  now: Date = new Date(),
): Promise<StudentResult> {
  const [current] = await db
    .select()
    .from(students)
    .where(eq(students.id, input.studentId));
  if (!current) return { ok: false, error: "aluna nao encontrada" };

  const validation = validateStudent(input);
  if (!validation.ok) {
    return {
      ok: false,
      error: validationError(validation.errors),
      field: validation.errors[0]?.field,
    };
  }

  const email = normalizeEmail(input.email);
  if (await emailTaken(db, email, input.studentId)) {
    return { ok: false, error: "e-mail ja cadastrado", field: "email" };
  }

  try {
    const [updated] = await db
      .update(students)
      .set({
        name: input.name.trim(),
        phone: input.phone.trim(),
        email,
        birthDate: input.birthDate,
        // Na edicao, matricula omitida mantem a atual (formulario manda tudo)
        enrollmentDate: input.enrollmentDate || current.enrollmentDate,
        planId: input.planId ?? null,
        status: input.status,
        notes: input.notes ?? null,
        updatedAt: now,
      })
      .where(eq(students.id, input.studentId))
      .returning();
    return updated
      ? { ok: true, value: updated }
      : { ok: false, error: "falha ao editar aluna" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "e-mail ja cadastrado", field: "email" };
    }
    throw error;
  }
}

/**
 * Ciclo de vida por status (STUD-03, STUD-06, STUD-07): inativar e reativar
 * nao reescrevem matrículas - a ocupacao deriva do status na leitura.
 */
export async function setStudentStatus(
  db: DbClient,
  input: { studentId: string; status: StudentStatus },
  now: Date = new Date(),
): Promise<StudentResult> {
  const [current] = await db
    .select({ planId: students.planId })
    .from(students)
    .where(eq(students.id, input.studentId));
  if (!current) return { ok: false, error: "aluna nao encontrada" };

  // O invariante do cadastro vale no ciclo de vida tambem (STUD-09):
  // reativar uma aluna sem plano contornaria "plano obrigatorio quando Ativo"
  if (input.status === "ATIVO" && !current.planId) {
    return {
      ok: false,
      error: "planId: plano obrigatorio para aluna ativa",
      field: "planId",
    };
  }

  const [updated] = await db
    .update(students)
    .set({ status: input.status, updatedAt: now })
    .where(eq(students.id, input.studentId))
    .returning();
  return updated
    ? { ok: true, value: updated }
    : { ok: false, error: "aluna nao encontrada" };
}

export type StudentWithPlan = Student & {
  planName: string | null;
  planStatus: Plan["status"] | null;
};

/** Todas as alunas com o nome do plano - listagem da tela /alunos. */
export async function listStudents(
  db: DbClient,
): Promise<StudentWithPlan[]> {
  const rows = await db
    .select({
      student: students,
      planName: plans.name,
      planStatus: plans.status,
    })
    .from(students)
    .leftJoin(plans, eq(students.planId, plans.id))
    .orderBy(asc(students.name));

  return rows.map((row) => ({
    ...row.student,
    planName: row.planName,
    planStatus: row.planStatus,
  }));
}

export type StudentFixedEnrollment = {
  id: string;
  classSlotId: string;
  classTypeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
};

export type StudentProfile = {
  student: Student;
  plan: Plan | null;
  fixedEnrollments: StudentFixedEnrollment[];
  credits: StudentCredit[];
  bookings: StudentBooking[];
};

export type StudentProfileResult =
  | { ok: true; value: StudentProfile }
  | { ok: false; error: string };

/**
 * Perfil agregado do detalhe da aluna (STUD-08): cadastro + plano (mesmo
 * inativo, PLAN-05), horarios fixos ativos, creditos DISPONIVEIS com
 * vencimento e historico de reservas.
 */
export async function getStudentProfile(
  db: DbClient,
  studentId: string,
  now: Date = new Date(),
): Promise<StudentProfileResult> {
  const [studentRow] = await db
    .select({ student: students, plan: plans })
    .from(students)
    .leftJoin(plans, eq(students.planId, plans.id))
    .where(eq(students.id, studentId));
  if (!studentRow) {
    return { ok: false, error: "aluna nao encontrada" };
  }

  const today = todayInStudio(now);
  const fixedRows = await db
    .select({
      id: fixedEnrollments.id,
      classSlotId: fixedEnrollments.classSlotId,
      classTypeName: classTypes.name,
      weekday: classSlots.weekday,
      startTime: classSlots.startTime,
      endTime: classSlots.endTime,
      startDate: fixedEnrollments.startDate,
      endDate: fixedEnrollments.endDate,
    })
    .from(fixedEnrollments)
    .innerJoin(classSlots, eq(fixedEnrollments.classSlotId, classSlots.id))
    .innerJoin(classTypes, eq(classSlots.classTypeId, classTypes.id))
    .where(
      and(
        eq(fixedEnrollments.studentId, studentId),
        eq(fixedEnrollments.status, "ATIVA"),
        // Fixo encerrado por data deixa de ser ativo (RES-23)
        or(
          isNull(fixedEnrollments.endDate),
          gte(fixedEnrollments.endDate, today),
        ),
      ),
    )
    .orderBy(asc(classSlots.startTime));

  const allCredits = await listStudentCredits(db, studentId, now);
  const credits = allCredits.filter(
    (credit) => credit.status === "DISPONIVEL",
  );

  return {
    ok: true,
    value: {
      student: studentRow.student,
      plan: studentRow.plan,
      fixedEnrollments: fixedRows,
      credits,
      bookings: await listStudentBookings(db, studentId),
    },
  };
}
