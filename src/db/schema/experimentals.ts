import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { classSessions } from "./sessions";
import { students } from "./students";

// Os 8 status da experimental (PRD 8.3 a 8.6, EXP-32): o ciclo de vida e
// preservado por status, sem exclusao fisica. DUPLICADA e a tentativa
// bloqueada pelo telefone, ligada a solicitacao existente (EXP-09).
export const experimentalStatusEnum = pgEnum("status_experimental", [
  "PENDENTE",
  "APROVADA",
  "RECUSADA",
  "CANCELADA_COM_DIREITO",
  "CANCELADA_SEM_DIREITO",
  "FALTA",
  "CONVERTIDA",
  "DUPLICADA",
]);

// Pagamento manual do PRD 8.4 (EXP-33).
export const experimentalPaymentStatusEnum = pgEnum(
  "status_pagamento_experimental",
  ["PENDENTE", "PAGO", "ISENTO", "REEMBOLSADO"],
);

export const experimentals = pgTable(
  "experimentals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Como digitado; phoneNormalized e a identidade de duplicidade (EXP-10)
    phone: text("phone").notNull(),
    phoneNormalized: text("phone_normalized").notNull(),
    classSessionId: uuid("class_session_id")
      .notNull()
      .references(() => classSessions.id),
    status: experimentalStatusEnum("status").notNull().default("PENDENTE"),
    paymentStatus: experimentalPaymentStatusEnum("payment_status")
      .notNull()
      .default("PENDENTE"),
    // Texto aceito no instante da solicitacao: gravado pelo servidor, nao
    // pelo cliente (EXP-16)
    healthDeclaration: text("health_declaration").notNull(),
    // Preenchido apenas nas tentativas bloqueadas (EXP-09)
    duplicateOfId: uuid("duplicate_of_id").references(
      (): AnyPgColumn => experimentals.id,
    ),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
    attendedAt: timestamp("attended_at", { withTimezone: true }),
    whatsappContactedAt: timestamp("whatsapp_contacted_at", {
      withTimezone: true,
    }),
    convertedStudentId: uuid("converted_student_id").references(
      () => students.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Uma solicitacao canonica por telefone, inclusive em corrida (AD-038).
    // Tentativas DUPLICADA e a recusada ficam fora do indice: nao sao
    // solicitacoes e nao bloqueiam uma nova (EXP-48).
    uniqueIndex("experimentals_telefone_unico")
      .on(t.phoneNormalized)
      .where(sql`${t.status} <> 'RECUSADA' and ${t.duplicateOfId} is null`),
  ],
);

// Historico de reagendamento (PRD 8.5): cada troca guarda a ocorrencia
// anterior, porque um unico previous_session_id perderia a segunda troca.
export const experimentalReschedules = pgTable("experimental_reschedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentalId: uuid("experimental_id")
    .notNull()
    .references(() => experimentals.id),
  fromSessionId: uuid("from_session_id")
    .notNull()
    .references(() => classSessions.id),
  toSessionId: uuid("to_session_id")
    .notNull()
    .references(() => classSessions.id),
  reason: text("reason").notNull(),
  rescheduledAt: timestamp("rescheduled_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
