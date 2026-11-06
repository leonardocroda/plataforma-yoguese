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

  it("migration aplica sobre o container vazio", async () => {
    const migradas = await pg.db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(migradas.rows[0].count).toBeGreaterThan(0);
  });

  it("duas modalidades do PRD", async () => {
    await seed(pg.db);

    const modalidades = await pg.db.select().from(classTypes);
    const nomes = modalidades.map((m) => m.name).sort();

    expect(nomes).toEqual(["Superioga Clássico", "Superioga Intenso"]);
    for (const modalidade of modalidades) {
      expect(modalidade.status).toBe("ATIVA");
    }
  });

  it("alunos de teste carregados", async () => {
    await seed(pg.db);

    const alunos = await pg.db.select().from(students);
    const nomes = alunos.map((a) => a.name);

    for (let i = 1; i <= 4; i++) {
      expect(nomes).toContain(`Aluno Teste ${i}`);
    }
    for (const aluno of alunos) {
      expect(aluno.status).toBe("ATIVO");
    }
  });
});
