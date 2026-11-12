// Helper de teste para auth: o mock de next/headers (cookies()) e o
// AUTH_SECRET de teste. Os testes de action/service importam a factory e
// registram o mock no arquivo de teste:
//
//   vi.mock("next/headers", () => nextHeadersMock());
//
// O jar e compartilhado: setSessionCookie grava nele e getSession le dele.

/** Segredo de teste: qualquer valor estavel serve (o dominio so assina/verifica). */
export const TEST_AUTH_SECRET =
  "segredo-de-teste-da-suite-yoguese-32-bytes";

/** Estado vivo entre o mock e os testes: o jar de cookies (plain: a factory
 * do mock so roda depois, quando o codigo em teste importa next/headers). */
export const authTestState = {
  jar: new Map<string, string>(),
};

/** Limpa o ambiente entre os testes. */
export function resetAuthTestState(): void {
  authTestState.jar.clear();
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
}

/** Factory do modulo mockado de next/headers (Next 15: cookies() e async). */
export function nextHeadersMock(): {
  cookies: () => Promise<{
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => Array<{ name: string; value: string }>;
    set: (name: string, value: string) => void;
    delete: (name: string) => void;
  }>;
} {
  return {
    cookies: async () => ({
      get: (name) => {
        const value = authTestState.jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      getAll: () =>
        [...authTestState.jar].map(([name, value]) => ({ name, value })),
      set: (name, value) => {
        authTestState.jar.set(name, value);
      },
      delete: (name) => {
        authTestState.jar.delete(name);
      },
    }),
  };
}
