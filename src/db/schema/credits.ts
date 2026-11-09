import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bookings, classSessions } from "./sessions";
import { students } from "./students";

// Credito de reposicao: origem, validade, status e historico de alteracoes
// (CRD-11, CRD-12). Origem e status seguem o vocabulario do PRD 6.2.

export const creditSourceEnum = pgEnum("origem_credito", [
  "CANCELAMENTO_AULA_FIXA",
  "CANCELAMENTO_ESTUDIO",
  "CONCESSAO_MANUAL",
]);

export const creditStatusEnum = pgEnum("status_credito", [
  "DISPONIVEL",
  "RESERVADO",
  "UTILIZADO",
  "VENCIDO",
  "CANCELADO",
]);

export const credits = pgTable(
  "credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    source: creditSourceEnum("source").notNull(),
    sourceBookingId: uuid("source_booking_id").references(() => bookings.id),
    sourceSessionId: uuid("source_session_id").references(() => classSessions.id),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: creditStatusEnum("status").notNull().default("DISPONIVEL"),
    usedBookingId: uuid("used_booking_id").references(() => bookings.id),
    // Auth ainda nao existe: o responsavel fica por rotulo (AD-016)
    adminUserId: uuid("admin_user_id"),
    adminLabel: text("admin_label"),
  },
  (t) => [
    // No maximo 1 credito por origem (CRD-14)
    uniqueIndex("credits_origem_reserva_unica")
      .on(t.studentId, t.source, t.sourceBookingId)
      .where(sql`${t.sourceBookingId} is not null`),
    uniqueIndex("credits_origem_sessao_unica")
      .on(t.studentId, t.source, t.sourceSessionId)
      .where(sql`${t.sourceSessionId} is not null`),
    index("credits_aluno_status").on(t.studentId, t.status),
  ],
);

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditId: uuid("credit_id")
    .notNull()
    .references(() => credits.id),
  action: text("action").notNull(),
  previousStatus: creditStatusEnum("previous_status"),
  newStatus: creditStatusEnum("new_status").notNull(),
  reason: text("reason").notNull(),
  adminUserId: uuid("admin_user_id"),
  adminLabel: text("admin_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
