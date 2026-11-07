import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { classSlots, classTypes, students } from "../db/schema";

export type DbClient = NodePgDatabase<typeof schema>;

/** Recria o banco de teste vazio entre os testes de uma mesma suite. */
export async function clearTables(db: DbClient): Promise<void> {
  await db.execute(
    sql`truncate table bookings, class_sessions, fixed_enrollments, class_slots, class_types, students, holidays, studio_closures`,
  );
}

export type TestClass = {
  classTypeId: string;
  slotId: string;
};

/** Cria modalidade + slot de teste (turma). Via fixtures, nao via servico. */
export async function createTestClass(
  db: DbClient,
  input: {
    weekday: number;
    capacity: number;
    startTime?: string;
    endTime?: string;
  },
): Promise<TestClass> {
  // Nome com sufixo aleatorio: class_types.name e unica e uma suite pode
  // criar varias turmas
  const suffix = Math.random().toString(16).slice(2, 10);
  const [classType] = await db
    .insert(classTypes)
    .values({ name: `Superioga Teste ${suffix}` })
    .returning();

  const [slot] = await db
    .insert(classSlots)
    .values({
      classTypeId: classType.id,
      weekday: input.weekday,
      startTime: input.startTime ?? "19:00:00",
      endTime: input.endTime ?? "20:00:00",
      capacity: input.capacity,
    })
    .returning();

  return { classTypeId: classType.id, slotId: slot.id };
}

/** Cria alunos de teste e devolve os ids. */
export async function createStudents(
  db: DbClient,
  count: number,
): Promise<string[]> {
  const suffix = Math.random().toString(16).slice(2, 10);
  const rows = await db
    .insert(students)
    .values(
      Array.from({ length: count }, (_, i) => ({
        name: `Aluno ${suffix} ${i + 1}`,
      })),
    )
    .returning();
  return rows.map((a) => a.id);
}
