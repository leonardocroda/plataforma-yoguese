import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { users } from "../../../db/schema";
import { clearTables } from "../../../test/fixtures";
import {
  authTestState,
  nextHeadersMock,
  resetAuthTestState,
  TEST_AUTH_SECRET,
} from "../../../test/auth";
import {
  PostgresTestInstance,
  startPostgres,
} from "../../../test/postgres";
import { hashPassword } from "../domain/password";
import { loginAction, logoutAction, type LoginState } from "../actions";

// AUTH-02 a AUTH-04, AUTH-06: as actions de login e logout. O cookie passa
// pelo mock de next/headers; o banco e o Postgres do Testcontainers.

vi.mock("next/headers", () => nextHeadersMock());

const INITIAL: LoginState = {};

describe("auth actions", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
    // As actions usam o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    resetAuthTestState();
  });

  afterAll(async () => {
    const { db } = await import("../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
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

  /**
   * redirect() lanca o erro do Next: o caminho vem no digest. Capturar a
   * rejeicao e o jeito de provar o destino sem um browser.
   */
  async function digestOf(run: Promise<unknown>): Promise<string> {
    const error = await run.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    return (error as { digest?: string }).digest ?? "";
  }

  function formData(input: { email: string; password: string }): FormData {
    const data = new FormData();
    data.set("email", input.email);
    data.set("password", input.password);
    return data;
  }

  it("login valido inicia a sessao e redireciona a /grade (AUTH-02)", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const digest = await digestOf(
      loginAction(
        INITIAL,
        formData({ email: "admin@yoguese.com", password: "S3nha!Segura" }),
      ),
    );

    expect(digest).toContain("/grade");
    // A sessao existe: o cookie assinado foi gravado
    expect(authTestState.jar.get("yoguese_session")).toBeTruthy();
  });

  it("credencial invalida devolve exatamente a mensagem generica, sem sessao (AUTH-03)", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const wrongPassword = await loginAction(
      INITIAL,
      formData({ email: "admin@yoguese.com", password: "SenhaErrada" }),
    );
    const unknownEmail = await loginAction(
      INITIAL,
      formData({ email: "desconhecida@yoguese.com", password: "S3nha!Segura" }),
    );

    expect(wrongPassword).toEqual({ error: "E-mail ou senha inválidos" });
    expect(unknownEmail).toEqual({ error: "E-mail ou senha inválidos" });
    expect(authTestState.jar.get("yoguese_session")).toBeUndefined();
  });

  it("recusa campo vazio e e-mail invalido no servidor, sem tocar cookies (AUTH-04)", async () => {
    for (const input of [
      { email: "", password: "" },
      { email: "   ", password: "S3nha!Segura" },
      { email: "admin@yoguese.com", password: "" },
      { email: "nao-e-email", password: "S3nha!Segura" },
    ]) {
      const state = await loginAction(INITIAL, formData(input));
      expect(state.error).toBeTruthy();
    }

    // Nenhuma tentativa criou sessao
    expect(authTestState.jar.size).toBe(0);
  });

  it("Sair limpa o cookie e volta ao /login (AUTH-06)", async () => {
    authTestState.jar.set("yoguese_session", "cookie-de-teste");

    const digest = await digestOf(logoutAction());

    expect(digest).toContain("/login");
    expect(authTestState.jar.get("yoguese_session")).toBeUndefined();
  });

  it("e-mail chega normalizado ao servico (trim e lowercase)", async () => {
    await createAdmin("admin@yoguese.com", "S3nha!Segura");

    const digest = await digestOf(
      loginAction(
        INITIAL,
        formData({ email: "  ADMIN@yoguese.com ", password: "S3nha!Segura" }),
      ),
    );

    expect(digest).toContain("/grade");
    expect(authTestState.jar.get("yoguese_session")).toBeTruthy();
  });
});

// Segredo do ambiente de teste: setSessionCookie assina com ele
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
