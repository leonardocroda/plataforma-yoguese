import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../../../db/schema";
import { clearTables } from "../../../test/fixtures";
import { startPostgres, type PostgresTestInstance } from "../../../test/postgres";
import { hashPassword } from "../domain/password";
import { normalizeEmail, verifyCredentials } from "../services/credentials";

// AUTH-02, AUTH-03: credenciais autenticam o admin do banco; e-mail
// desconhecido e senha errada falham com o mesmo erro generico.

describe("credentials", () => {
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

  async function createAdmin(email: string, password: string): Promise<void> {
    await pg.db.insert(users).values({
      name: "Admin do Estudio",
      email,
      passwordHash: hashPassword(password),
      role: "ADMIN",
    });
  }

  it("autentica a admin com e-mail e senha corretos", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const result = await verifyCredentials(pg.db, {
      email: "admin@yoguese.com",
      password: "S3nha!Segura",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe("ADMIN");
      expect(result.user.passwordHash).not.toContain("S3nha!Segura");
    }
  });

  it("normaliza o e-mail: espacos e maiusculas nao distinguem", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const result = await verifyCredentials(pg.db, {
      email: "  ADMIN@yoguese.com ",
      password: "S3nha!Segura",
    });

    expect(result.ok).toBe(true);
  });

  it("e-mail desconhecido e senha errada falham com o mesmo erro generico", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const unknownEmail = await verifyCredentials(pg.db, {
      email: "desconhecida@yoguese.com",
      password: "S3nha!Segura",
    });
    const wrongPassword = await verifyCredentials(pg.db, {
      email: "admin@yoguese.com",
      password: "SenhaErrada",
    });

    // O mesmo resultado: nenhuma pista sobre qual campo errou
    expect(unknownEmail).toEqual({ ok: false });
    expect(wrongPassword).toEqual({ ok: false });
  });

  it("hash sem o formato scrypt nunca autentica", async () => {
    await pg.db.insert(users).values({
      name: "Rota quebrada",
      email: "texto-puro@yoguese.com",
      passwordHash: "texto-puro-no-banco",
      role: "ADMIN",
    });

    const result = await verifyCredentials(pg.db, {
      email: "texto-puro@yoguese.com",
      password: "texto-puro-no-banco",
    });

    expect(result).toEqual({ ok: false });
  });

  it("normalizeEmail devolve trim e lowercase", () => {
    expect(normalizeEmail("  Ana@YogueSe.com ")).toBe("ana@yoguese.com");
  });
});
