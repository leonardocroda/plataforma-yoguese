// Autenticacao por e-mail e senha (AUTH-02, AUTH-03): a falha e generica -
// e-mail desconhecido e senha errada devolvem exatamente o mesmo resultado,
// sem dizer qual dos dois errou.

import { and, eq } from "drizzle-orm";
import { users } from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import { verifyPassword } from "../domain/password";

export type SessionUserRow = typeof users.$inferSelect;

export type CredentialsResult =
  | { ok: true; user: SessionUserRow }
  | { ok: false };

/** E-mail e identidade de acesso: espaos e maiusculas nao distinguem. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function verifyCredentials(
  db: DbClient,
  input: { email: string; password: string },
): Promise<CredentialsResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, normalizeEmail(input.email)),
        // O painel e de admin: credenciais de ALUNO nao iniciam sessao aqui
        // (AUTH-09) - a recusa e a mesma generica, sem pista do papel
        eq(users.role, "ADMIN"),
      ),
    );

  if (!user) return { ok: false };
  if (!verifyPassword(input.password, user.passwordHash)) return { ok: false };
  return { ok: true, user };
}
