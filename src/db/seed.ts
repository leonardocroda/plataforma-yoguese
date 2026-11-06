import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { classTypes, students } from "./schema";

export type SeedDatabase = NodePgDatabase<typeof schema>;

// Assumption do spec ("Alunos e modalidades iniciais"): seed com as duas
// modalidades do PRD e alunos de teste para exercitar contagens/vagas.
const MODALIDADES = ["Superioga Clássico", "Superioga Intenso"];

const ALUNOS_TESTE = [
  "Aluno Teste 1",
  "Aluno Teste 2",
  "Aluno Teste 3",
  "Aluno Teste 4",
];

export async function seed(db: SeedDatabase): Promise<void> {
  await db
    .insert(classTypes)
    .values(MODALIDADES.map((name) => ({ name })))
    .onConflictDoNothing({ target: classTypes.name });

  await db
    .insert(students)
    .values(ALUNOS_TESTE.map((name) => ({ name })))
    .onConflictDoNothing({ target: students.name });
}
