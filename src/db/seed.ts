import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { classTypes, students, users } from "./schema";
import { hashPassword } from "../modules/auth/domain/password";

export type SeedDatabase = NodePgDatabase<typeof schema>;

// Assumption do spec ("Alunos e modalidades iniciais"): seed com as duas
// modalidades do PRD e alunos de teste para exercitar contagens/vagas.
const CLASS_TYPES = ["Superioga Clássico", "Superioga Intenso"];

const TEST_STUDENTS = [
  { name: "Aluno Teste 1", email: "aluno.teste.1@yoguese.com" },
  { name: "Aluno Teste 2", email: "aluno.teste.2@yoguese.com" },
  { name: "Aluno Teste 3", email: "aluno.teste.3@yoguese.com" },
  { name: "Aluno Teste 4", email: "aluno.teste.4@yoguese.com" },
];

const ADMIN_NAME = "Admin Yogue-se";

/**
 * Primeiro administrador (AUTH-08): nasce do ambiente, nunca no codigo.
 * Idempotente por e-mail - rodar de novo atualiza a senha do env, sem
 * duplicar a conta.
 */
async function seedAdmin(db: SeedDatabase): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL e ADMIN_PASSWORD nao configuradas: defina as duas no .env.local",
    );
  }

  await db
    .insert(users)
    .values({
      name: ADMIN_NAME,
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      role: "ADMIN",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: ADMIN_NAME,
        passwordHash: hashPassword(password),
        role: "ADMIN",
        updatedAt: new Date(),
      },
    });
}

export async function seed(db: SeedDatabase): Promise<void> {
  await db
    .insert(classTypes)
    .values(CLASS_TYPES.map((name) => ({ name })))
    .onConflictDoNothing({ target: classTypes.name });

  // O e-mail identifica a aluna (nome deixa de ser unico): o conflito
  // idempotente agora e por e-mail.
  await db
    .insert(students)
    .values(
      TEST_STUDENTS.map((student) => ({
        name: student.name,
        phone: "11999990000",
        email: student.email,
        birthDate: "1990-01-01",
      })),
    )
    .onConflictDoNothing({ target: students.email });

  await seedAdmin(db);
}
