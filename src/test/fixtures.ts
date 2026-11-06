import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { classSlots, classTypes, students } from "../db/schema";

export type DbClient = NodePgDatabase<typeof schema>;

/** Recria o banco de teste vazio entre os testes de uma mesma suite. */
export async function limparTabelas(db: DbClient): Promise<void> {
  await db.execute(
    sql`truncate table bookings, class_sessions, fixed_enrollments, class_slots, class_types, students, holidays, studio_closures`,
  );
}

export type TurmaTeste = {
  modalidadeId: string;
  slotId: string;
};

/** Cria modalidade + slot de teste (turma). Via fixtures, nao via servico. */
export async function criarTurma(
  db: DbClient,
  entrada: { weekday: number; capacity: number; startTime?: string; endTime?: string },
): Promise<TurmaTeste> {
  const [modalidade] = await db
    .insert(classTypes)
    .values({ name: "Superioga Teste" })
    .returning();

  const [slot] = await db
    .insert(classSlots)
    .values({
      classTypeId: modalidade.id,
      weekday: entrada.weekday,
      startTime: entrada.startTime ?? "19:00:00",
      endTime: entrada.endTime ?? "20:00:00",
      capacity: entrada.capacity,
    })
    .returning();

  return { modalidadeId: modalidade.id, slotId: slot.id };
}

/** Cria alunos de teste e devolve os ids. */
export async function criarAlunos(db: DbClient, quantidade: number): Promise<string[]> {
  const sufixo = Math.random().toString(16).slice(2, 10);
  const linhas = await db
    .insert(students)
    .values(
      Array.from({ length: quantidade }, (_, i) => ({
        name: `Aluno ${sufixo} ${i + 1}`,
      })),
    )
    .returning();
  return linhas.map((a) => a.id);
}
