import {
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { classSlots } from "./turmas";

export const statusAlunoEnum = pgEnum("status_aluno", ["ATIVO", "INATIVO"]);

export const statusEnrollmentEnum = pgEnum("status_enrollment", [
  "ATIVA",
  "INATIVA",
]);

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  status: statusAlunoEnum("status").notNull().default("ATIVO"),
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
