// Autenticacao por e-mail e senha (AUTH-02, AUTH-03): a falha e generica -
// e-mail desconhecido e senha errada devolvem exatamente o mesmo resultado,
// sem dizer qual dos dois errou.

import { eq } from "drizzle-orm";
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
    .where(eq(users.email, normalizeEmail(input.email)));

  if (!user) return { ok: false };
  if (!verifyPassword(input.password, user.passwordHash)) return { ok: false };
  return { ok: true, user };
}
