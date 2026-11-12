import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "../session-token";

// Sessao stateless em cookie assinado (AUTH-02/03): HMAC-SHA256, base64url.
// Token alterado ou expirado nao vale nada.

const SECRET = "segredo-de-teste-de-32-bytes-ok!";
const NOW = 1_700_000_000_000;

const PAYLOAD: SessionPayload = {
  userId: "11111111-1111-1111-1111-111111111111",
  role: "ADMIN",
  exp: NOW + SESSION_TTL_MS,
};

describe("session-token", () => {
  it("round trip: token assinado volta o payload original", () => {
    const token = signSessionToken(PAYLOAD, SECRET, NOW);
    const verified = verifySessionToken(token, SECRET, NOW);

    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload).toEqual({ ...PAYLOAD, iat: NOW });
    }
  });

  it("token alterado devolve ok: false com reason tampered", () => {
    const token = signSessionToken(PAYLOAD, SECRET, NOW);
    const [body, signature] = token.split(".");

    expect(verifySessionToken(`${body}.${signature}`, SECRET, NOW).ok).toBe(true);

    // Um caractere do corpo muda: a assinatura nao bate
    const tamperedBody = body.slice(0, -1) + "A";
    const tampered = verifySessionToken(
      `${tamperedBody}.${signature}`,
      SECRET,
      NOW,
    );
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.reason).toBe("tampered");

    // A assinatura muda: tampered tambem
    const tamperedSignature = verifySessionToken(
      `${body}.${signature.slice(0, -1)}A`,
      SECRET,
      NOW,
    );
    expect(tamperedSignature.ok).toBe(false);
    if (!tamperedSignature.ok) expect(tamperedSignature.reason).toBe("tampered");
  });

  it("segredo diferente devolve tampered", () => {
    const token = signSessionToken(PAYLOAD, SECRET, NOW);
    const verified = verifySessionToken(token, "outro-segredo-de-teste", NOW);

    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("tampered");
  });

  it("token expirado devolve ok: false com reason expired", () => {
    const token = signSessionToken(PAYLOAD, SECRET, NOW);
    const afterExpiry = PAYLOAD.exp + 1;
    const verified = verifySessionToken(token, SECRET, afterExpiry);

    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("expired");
  });

  it("token valido ate a fronteira do exp (now < exp)", () => {
    const token = signSessionToken(PAYLOAD, SECRET, NOW);
    const verified = verifySessionToken(token, SECRET, PAYLOAD.exp - 1);

    expect(verified.ok).toBe(true);
  });

  it("token malformado devolve tampered, sem lancar", () => {
    for (const token of ["", "sem-ponto", "a.b", "###.###", `${"x".repeat(50)}.${"y"}`]) {
      const verified = verifySessionToken(token, SECRET, NOW);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe("tampered");
    }
  });
});
