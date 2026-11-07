import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const classStatusEnum = pgEnum("status_turma", [
  "ATIVA",
  "INATIVA",
]);

export const classTypes = pgTable("class_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  status: classStatusEnum("status").notNull().default("ATIVA"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const classSlots = pgTable(
  "class_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classTypeId: uuid("class_type_id")
      .notNull()
      .references(() => classTypes.id),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    capacity: integer("capacity").notNull().default(8),
    status: classStatusEnum("status").notNull().default("ATIVA"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("class_slots_weekday_range", sql`${t.weekday} between 1 and 7`),
    check("class_slots_capacity_positive", sql`${t.capacity} >= 1`),
  ],
);
