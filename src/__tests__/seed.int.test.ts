import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, students } from "../db/schema";
import { seed } from "../db/seed";
import { startPostgres, type PostgresTestInstance } from "../test/postgres";

describe("seed", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("migration applies on the empty container", async () => {
    const migrated = await pg.db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(migrated.rows[0].count).toBeGreaterThan(0);
  });

  it("the two PRD class types", async () => {
    await seed(pg.db);

    const classTypesRows = await pg.db.select().from(classTypes);
    const names = classTypesRows.map((m) => m.name).sort();

    expect(names).toEqual(["Superioga Clássico", "Superioga Intenso"]);
    for (const classType of classTypesRows) {
      expect(classType.status).toBe("ATIVA");
    }
  });

  it("test students are loaded", async () => {
    await seed(pg.db);

    const studentsRows = await pg.db.select().from(students);
    const names = studentsRows.map((a) => a.name);

    for (let i = 1; i <= 4; i++) {
      expect(names).toContain(`Aluno Teste ${i}`);
    }
    for (const student of studentsRows) {
      expect(student.status).toBe("ATIVO");
    }
  });
});
