// Sessao em cookie assinado (AUTH-01, AUTH-02, AUTH-06): stateless, 7 dias,
// httpOnly, secure apenas em producao. O guard do admin redireciona ao login.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_TTL_MS,
  SessionRole,
  signSessionToken,
  verifySessionToken,
} from "../domain/session-token";

const COOKIE_NAME = "yoguese_session";
const COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export type SessionUser = {
  userId: string;
  role: SessionRole;
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET nao configurada");
  }
  return secret;
}

/** Sessao valida do cookie, ou null (sem cookie, adulterado ou expirado). */
export async function getSession(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie) return null;

  const verified = verifySessionToken(cookie.value, authSecret(), Date.now());
  if (!verified.ok) return null;

  return { userId: verified.payload.userId, role: verified.payload.role };
}

/** Guard do (admin): sem sessao de ADMIN, a rota nao responde (AUTH-01). */
export async function requireAdminSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }
  return session;
}

/** Grava o cookie da sessao (server action de login, AUTH-02). */
export async function setSessionCookie(user: {
  id: string;
  role: SessionRole;
}): Promise<void> {
  const now = Date.now();
  const token = signSessionToken(
    { userId: user.id, role: user.role, exp: now + SESSION_TTL_MS },
    authSecret(),
    now,
  );

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Limpa o cookie (server action de logout, AUTH-06). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
