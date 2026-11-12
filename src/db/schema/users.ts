import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Usuario da plataforma (PRD 12): admin agora; a area do aluno vem depois
// (AD-006, AD-034) - a tabela nasce com role para nao migrar de novo.

export const userRoleEnum = pgEnum("role_usuario", ["ADMIN", "ALUNO"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("ALUNO"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
