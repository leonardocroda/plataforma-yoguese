import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import {
  classSlots,
  classTypes,
  experimentals,
  plans,
  students,
} from "../db/schema";
import { grantCredit } from "../modules/credits/services/credits";

export type DbClient = NodePgDatabase<typeof schema>;

/** Recria o banco de teste vazio entre os testes de uma mesma suite. */
export async function clearTables(db: DbClient): Promise<void> {
  await db.execute(
    sql`truncate table experimental_reschedules, experimentals, credit_transactions, credits, bookings, class_sessions, class_date_blocks, fixed_enrollments, class_slots, class_types, students, plans, users, holidays, studio_closures`,
  );
}

export type TestExperimentalStatus = NonNullable<
  (typeof experimentals.$inferInsert)["status"]
>;

export type TestExperimentalPaymentStatus = NonNullable<
  (typeof experimentals.$inferInsert)["paymentStatus"]
>;

export type TestExperimental = {
  id: string;
};

/**
 * Cria uma experimental de teste ligada a uma ocorrencia ja materializada.
 * O telefone normalizado deriva do telefone quando nao informado; os testes
 * que provam a identidade do telefone passam o valor normalizado.
 */
export async function createExperimental(
  db: DbClient,
  input: {
    classSessionId: string;
    name?: string;
    phone?: string;
    phoneNormalized?: string;
    status?: TestExperimentalStatus;
    paymentStatus?: TestExperimentalPaymentStatus;
    healthDeclaration?: string;
    duplicateOfId?: string | null;
    requestedAt?: Date;
    approvedAt?: Date | null;
    cancelledAt?: Date | null;
    noShowAt?: Date | null;
    attendedAt?: Date | null;
    whatsappContactedAt?: Date | null;
    convertedStudentId?: string | null;
  },
): Promise<TestExperimental> {
  const suffix = Math.random().toString(16).slice(2, 10);
  const phone =
    input.phone ?? `11${Math.floor(Math.random() * 1e9)
      .toString()
      .padStart(9, "0")}`;
  const [created] = await db
    .insert(experimentals)
    .values({
      classSessionId: input.classSessionId,
      name: input.name ?? `Visitante ${suffix}`,
      phone,
      phoneNormalized: input.phoneNormalized ?? phone.replace(/\D/g, ""),
      status: input.status ?? "PENDENTE",
      paymentStatus: input.paymentStatus ?? "PENDENTE",
      healthDeclaration: input.healthDeclaration ?? "declaracao de teste",
      duplicateOfId: input.duplicateOfId ?? null,
      requestedAt: input.requestedAt ?? new Date(),
      approvedAt: input.approvedAt ?? null,
      cancelledAt: input.cancelledAt ?? null,
      noShowAt: input.noShowAt ?? null,
      attendedAt: input.attendedAt ?? null,
      whatsappContactedAt: input.whatsappContactedAt ?? null,
      convertedStudentId: input.convertedStudentId ?? null,
    })
    .returning();
  if (!created) throw new Error("falha ao criar experimental de teste");
  return { id: created.id };
}

export type TestClass = {
  classTypeId: string;
  slotId: string;
};

/** Cria modalidade + slot de teste (turma). Via fixtures, nao via servico. */
export async function createTestClass(
  db: DbClient,
  input: {
    weekday: number;
    capacity: number;
    startTime?: string;
    endTime?: string;
  },
): Promise<TestClass> {
  // Nome com sufixo aleatorio: class_types.name e unica e uma suite pode
  // criar varias turmas
  const suffix = Math.random().toString(16).slice(2, 10);
  const [classType] = await db
    .insert(classTypes)
    .values({ name: `Superioga Teste ${suffix}` })
    .returning();

  const [slot] = await db
    .insert(classSlots)
    .values({
      classTypeId: classType.id,
      weekday: input.weekday,
      startTime: input.startTime ?? "19:00:00",
      endTime: input.endTime ?? "20:00:00",
      capacity: input.capacity,
    })
    .returning();

  return { classTypeId: classType.id, slotId: slot.id };
}

/** Cria alunos de teste e devolve os ids. */
export async function createStudents(
  db: DbClient,
  count: number,
  options: {
    /**
     * PLIM-03: a regra nova exige plano para o vinculo fixo. O default
     * vincula um plano de teste com frequencia 7 (os testes existentes
     * continuam valendo); `plan: false` cria sem plano e `plan: { ... }`
     * escolhe a frequencia do limite.
     */
    plan?: false | { weeklyFrequency?: number };
  } = {},
): Promise<string[]> {
  const suffix = Math.random().toString(16).slice(2, 10);
  let planId: string | null = null;
  if (options.plan !== false) {
    const weeklyFrequency =
      typeof options.plan === "object" && options.plan
        ? (options.plan.weeklyFrequency ?? 7)
        : 7;
    const [plan] = await db
      .insert(plans)
      .values({
        name: `Plano teste ${suffix}`,
        price: "0.00",
        weeklyFrequency,
        status: "ATIVO",
      })
      .returning();
    planId = plan.id;
  }
  const rows = await db
    .insert(students)
    .values(
      Array.from({ length: count }, (_, i) => ({
        name: `Aluno ${suffix} ${i + 1}`,
        // E-mail unico com sufixo: uma suite pode criar varios alunos
        phone: `1199999${String(1000 + i)}`,
        email: `aluno-${suffix}-${i + 1}@teste.com`,
        birthDate: "1990-01-01",
        planId,
      })),
    )
    .returning();
  return rows.map((a) => a.id);
}

/**
 * Concede um credito manual para o teste. A reposicao exige 1 credito
 * DISPONIVEL do aluno (CRD-18): o setup dos testes que criam reserva
 * MAKEUP concede o credito antes.
 */
export async function grantTestCredit(
  db: DbClient,
  studentId: string,
): Promise<string> {
  const granted = await grantCredit(db, {
    studentId,
    source: "CONCESSAO_MANUAL",
    reason: "Credito de teste",
    adminLabel: "testes",
  });
  if (!granted.ok) throw new Error(granted.error);
  return granted.value.credit.id;
}
