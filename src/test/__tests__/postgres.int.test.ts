import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type PostgresTestInstance } from "../postgres";

// Fuminha do helper: sobe container, aplica migrations (no-op ate T9 gerar
// a migration inicial) e consulta Postgres. Toda suite *.int.test.ts reusa.
describe("testcontainer postgres", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("starts the container and queries postgres", async () => {
    const result = await pg.db.execute<{ one: number }>(sql`select 1 as one`);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].one).toBe(1);
  });
});
