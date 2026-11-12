import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { plans, students, users } from "../schema";
import { clearTables } from "../../test/fixtures";
import { startPostgres, type PostgresTestInstance } from "../../test/postgres";

// Migracao da base do admin (STUD-01, STUD-03, STUD-04, PLAN-01): users e
// plans novas, students com o cadastro completo do PRD 4.4 e o enum com os
// 4 status. O nome deixa de ser unico; o e-mail vira o identificador.

/** O Drizzle embrulha o erro do Postgres: a mensagem original vem no cause. */
function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(" | ");
}

describe("students schema", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("applies users, plans and the 4 student statuses on an empty postgres", async () => {
    const tables = await pg.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public'
            and table_name in ('users', 'plans')
          order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(["plans", "users"]);

    const studentStatuses = await pg.db.execute<{ enumlabel: string }>(
      sql`select enumlabel from pg_enum
          join pg_type on pg_type.oid = pg_enum.enumtypid
          where pg_type.typname = 'status_aluno'
          order by enumsortorder`,
    );
    expect(studentStatuses.rows.map((row) => row.enumlabel)).toEqual([
      "EXPERIMENTAL",
      "AGUARDANDO_MATRICULA",
      "ATIVO",
      "INATIVO",
    ]);

    // O nome deixa de ter constraint unica (o e-mail identifica)
    const nameUnique = await pg.db.execute<{ count: number }>(
      sql`select count(*)::int as count from pg_constraint
          where conrelid = 'students'::regclass and contype = 'u'`,
    );
    expect(Number(nameUnique.rows[0].count)).toBe(1); // so o e-mail
  });

  it("stores the full student profile with plan and user links", async () => {
    const [user] = await pg.db
      .insert(users)
      .values({ name: "Ana", email: "ana@yoguese.com", passwordHash: "hash" })
      .returning();
    const [plan] = await pg.db
      .insert(plans)
      .values({
        name: "Mensal Ilimitado",
        price: "350.00",
        weeklyFrequency: 3,
      })
      .returning();
    expect(plan.status).toBe("ATIVO");
    expect(user.role).toBe("ALUNO");

    const [student] = await pg.db
      .insert(students)
      .values({
        name: "Ana Ribeiro",
        phone: "11999990000",
        email: "ana.ribeiro@yoguese.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        userId: user.id,
        notes: "Prefere manhãs",
        status: "EXPERIMENTAL",
      })
      .returning();

    expect(student.phone).toBe("11999990000");
    expect(student.email).toBe("ana.ribeiro@yoguese.com");
    expect(student.birthDate).toBe("1990-05-10");
    // A data de matricula nasce preenchida com hoje (default do PRD 4.4)
    expect(student.enrollmentDate).toBe(
      new Date().toLocaleDateString("sv-SE"),
    );
    expect(student.planId).toBe(plan.id);
    expect(student.userId).toBe(user.id);
    expect(student.notes).toBe("Prefere manhãs");
    expect(student.status).toBe("EXPERIMENTAL");
  });

  it("rejects a duplicate student email", async () => {
    const base = {
      name: "Ana Ribeiro",
      phone: "11999990000",
      birthDate: "1990-05-10",
    };
    await pg.db
      .insert(students)
      .values({ ...base, email: "ana.ribeiro@yoguese.com" });

    const error = await pg.db
      .insert(students)
      .values({ ...base, email: "ana.ribeiro@yoguese.com" })
      .then(
        () => null,
        (reason: unknown) => reason,
      );

    expect(error).toBeInstanceOf(Error);
    expect(errorChain(error)).toContain(
      "duplicate key value violates unique constraint",
    );
    expect(errorChain(error)).toContain("students_email_unique");
  });

  it("accepts two students with the same name", async () => {
    for (const email of ["ana.a@yoguese.com", "ana.b@yoguese.com"]) {
      await pg.db.insert(students).values({
        name: "Ana Ribeiro",
        phone: "11999990000",
        email,
        birthDate: "1990-05-10",
      });
    }

    const rows = await pg.db.select().from(students);
    expect(rows).toHaveLength(2);
  });
});
