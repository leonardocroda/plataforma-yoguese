// Token de sessao stateless (AUTH-02): JSON base64url assinado com
// HMAC-SHA256. Sem tabela de sessoes - o cookie carrega quem e quando expira.

import { createHmac, timingSafeEqual } from "node:crypto";

// 7 dias (spec: cookie httpOnly com expiracao de 7 dias)
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionRole = "ADMIN" | "ALUNO";

export type SessionPayload = {
  userId: string;
  role: SessionRole;
  /** Expiracao absoluta em ms de epoch. */
  exp: number;
};

export type SessionTokenResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; reason: "tampered" | "expired" };

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** O `nowMs` carimba o momento da emissao no corpo assinado. */
export function signSessionToken(
  payload: SessionPayload,
  secret: string,
  nowMs: number,
): string {
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iat: nowMs }),
  );
  return `${body}.${signature(body, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowMs: number,
): SessionTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "tampered" };

  const [body, given] = parts;
  const expected = signature(body, secret);
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  if (
    givenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(givenBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "tampered" };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as SessionPayload;
  } catch {
    return { ok: false, reason: "tampered" };
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.exp !== "number" ||
    nowMs >= payload.exp
  ) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
