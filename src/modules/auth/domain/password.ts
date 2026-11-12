// Hash de senha com scrypt e salt aleatorio (AUTH-05, PRD 13.4): sem
// dependencia nova - o formato no banco e `scrypt:<salt>:<hash>`, hex.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/** Senha so vive como `scrypt:<salt>:<hash>`; o salt e aleatorio por hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Comparacao em tempo constante; hash malformado e recusa, nao excecao. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [ , saltHex, hashHex ] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
