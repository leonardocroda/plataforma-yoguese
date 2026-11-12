import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "../phone";

// EXP-07, EXP-08, EXP-10: o telefone e a identidade da experimental. A
// mascara digitada e o codigo do pais nao criam uma pessoa nova.

describe("phone identity", () => {
  it("mascara e codigo do pais nao mudam a identidade do telefone", () => {
    const masked = normalizePhone("(11) 98888-7777");

    expect(masked).toBe("11988887777");
    expect(normalizePhone("11 98888 7777")).toBe(masked);
    expect(normalizePhone("11988887777")).toBe(masked);
    expect(normalizePhone("+55 (11) 98888-7777")).toBe(masked);
    expect(normalizePhone("55 11 98888-7777")).toBe(masked);

    // O fixo com DDD segue a mesma regra
    expect(normalizePhone("(11) 3333-4444")).toBe("1133334444");
    expect(normalizePhone("+55 (11) 3333-4444")).toBe("1133334444");
  });

  it("aceita 10 e 11 digitos e recusa outros tamanhos", () => {
    expect(isValidPhone("1133334444")).toBe(true);
    expect(isValidPhone("11988887777")).toBe(true);

    expect(isValidPhone("119888877")).toBe(false);
    expect(isValidPhone("119888877777")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("1198888777a")).toBe(false);
  });
});
