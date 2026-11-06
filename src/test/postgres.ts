import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../db/schema";

export type PostgresTestInstance = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: NodePgDatabase<typeof schema> & { $client: Pool };
};

/**
 * Sobe um Postgres descartavel (Testcontainers), aplica as migrations
 * da pasta ./drizzle e devolve o client. Reutilizado por todos os
 * `*.int.test.ts` do core.
 */
export async function startPostgres(): Promise<PostgresTestInstance> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  await migrate(db, { migrationsFolder: "./drizzle" });

  return { container, pool, db };
}
