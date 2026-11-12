import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "../password";

// AUTH-05: a senha vive so como hash com salt, nunca em texto puro.

describe("password", () => {
  it("hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash", () => {
    const stored = hashPassword("S3nha!Segura");

    expect(stored).not.toContain("S3nha!Segura");
    const parts = stored.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    // salt e hash em hex
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it("duas hashes da mesma senha diferem (salt aleatorio)", () => {
    const first = hashPassword("S3nha!Segura");
    const second = hashPassword("S3nha!Segura");

    expect(first).not.toBe(second);
    expect(first.split(":")[1]).not.toBe(second.split(":")[1]);
  });

  it("verify aceita a senha certa", () => {
    const stored = hashPassword("S3nha!Segura");

    expect(verifyPassword("S3nha!Segura", stored)).toBe(true);
  });

  it("verify falha com senha errada", () => {
    const stored = hashPassword("S3nha!Segura");

    expect(verifyPassword("SenhaErrada", stored)).toBe(false);
  });

  it("verify falha com hash malformado", () => {
    expect(verifyPassword("S3nha!Segura", "scrypt:zzzz:2222")).toBe(false);
    expect(verifyPassword("S3nha!Segura", "texto-solto")).toBe(false);
  });
});
