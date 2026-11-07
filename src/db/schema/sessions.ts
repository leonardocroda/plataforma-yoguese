import {
  date,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { classSlots } from "./classes";
import { students } from "./students";

export const sessionStatusEnum = pgEnum("status_sessao", [
  "AGENDADA",
  "BLOQUEADA",
  "CANCELADA",
]);

export const bookingTypeEnum = pgEnum("tipo_reserva", [
  "FIXED",
  "MAKEUP",
  "EXPERIMENTAL",
]);

export const bookingStatusEnum = pgEnum("status_reserva", [
  "ATIVA",
  "CANCELADA",
]);

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classSlotId: uuid("class_slot_id")
      .notNull()
      .references(() => classSlots.id),
    sessionDate: date("session_date").notNull(),
    status: sessionStatusEnum("status").notNull().default("AGENDADA"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("class_sessions_slot_data_unica").on(
      t.classSlotId,
      t.sessionDate,
    ),
  ],
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  classSessionId: uuid("class_session_id")
    .notNull()
    .references(() => classSessions.id),
  bookingType: bookingTypeEnum("booking_type").notNull(),
  status: bookingStatusEnum("status").notNull().default("ATIVA"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
