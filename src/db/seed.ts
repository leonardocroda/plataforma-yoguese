import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { classTypes, students } from "./schema";

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
}
