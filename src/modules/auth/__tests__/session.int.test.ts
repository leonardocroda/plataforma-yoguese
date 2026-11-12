import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authTestState,
  nextHeadersMock,
  resetAuthTestState,
  TEST_AUTH_SECRET,
} from "../../../test/auth";
import {
  SESSION_TTL_MS,
  signSessionToken,
} from "../domain/session-token";
import {
  clearSessionCookie,
  getSession,
  requireAdminSession,
  setSessionCookie,
} from "../services/session";

// A leitura/escrita do cookie passa pelo mock de next/headers (Next 15:
// cookies() e async e so existe em contexto de request).

vi.mock("next/headers", () => nextHeadersMock());

function cookieValue(name: string): string | undefined {
  return authTestState.jar.get(name);
}

describe("session", () => {
  beforeEach(() => {
    resetAuthTestState();
  });

  it("sessao de admin: set grava o cookie, getSession devolve o usuario", async () => {
    await setSessionCookie({ id: "user-1", role: "ADMIN" });

    expect(cookieValue("yoguese_session")).toBeTruthy();
    const session = await getSession();

    expect(session).toEqual({ userId: "user-1", role: "ADMIN" });
  });

  it("sem cookie, sem sessao", async () => {
    expect(await getSession()).toBeNull();
  });

  /** redirect() lanca o erro do Next: o caminho vem no digest. */
  async function expectRedirectToLogin(
    run: Promise<unknown>,
  ): Promise<void> {
    const error = await run.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    const digest = (error as { digest?: string }).digest ?? "";
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/login");
  }

  it("requireAdminSession sem sessao redireciona ao /login (AUTH-01)", async () => {
    await expectRedirectToLogin(requireAdminSession());
  });

  it("requireAdminSession com sessao ADMIN devolve o usuario", async () => {
    await setSessionCookie({ id: "user-1", role: "ADMIN" });

    const session = await requireAdminSession();

    expect(session).toEqual({ userId: "user-1", role: "ADMIN" });
  });

  it("sessao de ALUNO nao passa no guard do admin", async () => {
    await setSessionCookie({ id: "user-2", role: "ALUNO" });

    await expectRedirectToLogin(requireAdminSession());
  });

  it("cookie expirado ou adulterado e tratado como sem sessao", async () => {
    const expired = signSessionToken(
      { userId: "user-1", role: "ADMIN", exp: Date.now() - 1000 },
      TEST_AUTH_SECRET,
      Date.now() - SESSION_TTL_MS,
    );
    authTestState.jar.set("yoguese_session", expired);
    expect(await getSession()).toBeNull();

    const tampered = signSessionToken(
      { userId: "user-1", role: "ADMIN", exp: Date.now() + 60_000 },
      "segredo-diferente-do-teste",
      Date.now(),
    );
    authTestState.jar.set("yoguese_session", tampered);
    expect(await getSession()).toBeNull();
  });

  it("Sair limpa o cookie (AUTH-06)", async () => {
    await setSessionCookie({ id: "user-1", role: "ADMIN" });
    expect(cookieValue("yoguese_session")).toBeTruthy();

    await clearSessionCookie();

    expect(cookieValue("yoguese_session")).toBeUndefined();
    expect(await getSession()).toBeNull();
  });
});
