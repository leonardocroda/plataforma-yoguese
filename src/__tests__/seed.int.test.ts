import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, students, users } from "../db/schema";
import { seed } from "../db/seed";
import { startPostgres, type PostgresTestInstance } from "../test/postgres";
import { verifyPassword } from "../modules/auth/domain/password";

// Credenciais do admin nos testes: o seed le do ambiente (AUTH-08).
process.env.ADMIN_EMAIL = "admin@yoguese.com";
process.env.ADMIN_PASSWORD = "S3nha!DoAdmin";

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

  it("admin idempotente com hash verificavel (AUTH-08)", async () => {
    await seed(pg.db);
    await seed(pg.db);

    const admins = await pg.db
      .select()
      .from(users)
      .where(eq(users.role, "ADMIN"));

    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe("admin@yoguese.com");
    // A senha vive so como hash; o env autentica
    expect(admins[0].passwordHash).not.toContain("S3nha!DoAdmin");
    expect(verifyPassword("S3nha!DoAdmin", admins[0].passwordHash)).toBe(true);
  });

  it("seed de novo atualiza a senha do admin pelo env (upsert)", async () => {
    await seed(pg.db);
    process.env.ADMIN_PASSWORD = "Senha!NovaDoAdmin";
    await seed(pg.db);

    const [admin] = await pg.db
      .select()
      .from(users)
      .where(eq(users.email, "admin@yoguese.com"));

    expect(verifyPassword("Senha!NovaDoAdmin", admin.passwordHash)).toBe(true);
    expect(verifyPassword("S3nha!DoAdmin", admin.passwordHash)).toBe(false);
    // Nao duplicou
    const admins = await pg.db
      .select()
      .from(users)
      .where(eq(users.role, "ADMIN"));
    expect(admins).toHaveLength(1);

    process.env.ADMIN_PASSWORD = "S3nha!DoAdmin";
  });

  it("sem ADMIN_EMAIL/ADMIN_PASSWORD o seed recusa com erro claro", async () => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    try {
      await expect(seed(pg.db)).rejects.toThrow(/ADMIN_EMAIL/);
    } finally {
      process.env.ADMIN_EMAIL = email;
      process.env.ADMIN_PASSWORD = password;
    }
  });
});
