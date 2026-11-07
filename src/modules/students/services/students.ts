import { asc, eq } from "drizzle-orm";
import { students } from "../../../db/schema";
import { DbClient } from "../../bookings/services/sessions";

export type Student = typeof students.$inferSelect;

/**
 * Alunos ativos do estudio - base da selecao do admin nos formularios de
 * reserva manual e de horario fixo.
 */
export async function listActiveStudents(db: DbClient): Promise<Student[]> {
  return db
    .select()
    .from(students)
    .where(eq(students.status, "ATIVO"))
    .orderBy(asc(students.name));
}
