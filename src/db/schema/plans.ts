import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Plano do PRD 4.5: a tabela de precos e do admin, nao do codigo (PLAN-06).

export const planStatusEnum = pgEnum("status_plano", ["ATIVO", "INATIVO"]);

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // Dinheiro nao vai em float: numeric(10,2) e string no drizzle
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  weeklyFrequency: integer("weekly_frequency").notNull(),
  description: text("description"),
  status: planStatusEnum("status").notNull().default("ATIVO"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
