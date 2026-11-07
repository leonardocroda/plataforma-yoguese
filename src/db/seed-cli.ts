import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadEnvFiles } from "./env";
import { classTypes, students } from "./schema";
import * as schema from "./schema";
import { seed } from "./seed";

async function main() {
  loadEnvFiles();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  await seed(db);

  const typeRows = await db.select().from(classTypes);
  const studentRows = await db.select().from(students);
  console.log(`seed aplicado: ${typeRows.length} modalidades e ${studentRows.length} alunos`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
