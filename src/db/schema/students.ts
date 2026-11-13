import { sql } from "drizzle-orm";
import {
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { classSlots } from "./classes";
import { plans } from "./plans";
import { users } from "./users";

// Os 4 status do PRD 4.4 (STUD-03): o ciclo de vida da aluna preserva o
// historico por status, sem exclusao fisica (PRD 13.10).
export const studentStatusEnum = pgEnum("status_aluno", [
  "EXPERIMENTAL",
  "AGUARDANDO_MATRICULA",
  "ATIVO",
  "INATIVO",
]);

export const statusEnrollmentEnum = pgEnum("status_enrollment", [
  "ATIVA",
  "INATIVA",
]);

// Cadastro completo do PRD 4.4 (STUD-01): e-mail identifica a aluna (unico);
// o nome deixa de ser UNIQUE - duas alunas podem ter o mesmo nome.
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().unique(),
  birthDate: date("birth_date").notNull(),
  // Data de matricula: o default segue o calendario do estudio
  // (America/Sao_Paulo, RES-06/RES-10) - CURRENT_DATE puro seria avaliado
  // no fuso do Postgres e divergiria do calendario do estudio. O app grava
  // a data explicitamente com todayInStudio().
  enrollmentDate: date("enrollment_date")
    .notNull()
    .default(sql`(now() AT TIME ZONE 'America/Sao_Paulo')::date`),
  planId: uuid("plan_id").references(() => plans.id),
  status: studentStatusEnum("status").notNull().default("ATIVO"),
  notes: text("notes"),
  // Prepara a area do aluno (PRD 12) sem nova migracao futura
  userId: uuid("user_id").references(() => users.id),
  // Declaracao de saude copiada da experimental na conversao (EXP-50):
  // os cadastros feitos em /alunos deixam as duas colunas nulas
  healthDeclaration: text("health_declaration"),
  healthDeclarationAcceptedAt: timestamp("health_declaration_accepted_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fixedEnrollments = pgTable("fixed_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  classSlotId: uuid("class_slot_id")
    .notNull()
    .references(() => classSlots.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: statusEnrollmentEnum("status").notNull().default("ATIVA"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
