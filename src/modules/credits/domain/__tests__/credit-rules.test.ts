import { describe, expect, it } from "vitest";
import {
  creditExpiresAt,
  hoursUntilOccurrence,
  isEligibleForCredit,
} from "../credit-rules";

// Regras de antecedencia e validade do credito (CRD-02 a CRD-06). A
// antecedencia e medida no fuso America/Sao_Paulo (UTC-3).
describe("credit rules", () => {
  it("measures the hours until the class start in the studio timezone", () => {
    // 2026-11-09 19:00 no fuso do estudio = 2026-11-09T22:00:00Z
    const now = new Date("2026-11-09T22:00:00Z");

    // Uma leitura ingênua de UTC diria 21h: a aula começa as 19:00 locais
    expect(hoursUntilOccurrence("2026-11-10", "19:00:00", now)).toBe(24);
    expect(
      hoursUntilOccurrence("2026-11-10", "19:00:00", new Date("2026-11-09T22:30:00Z")),
    ).toBe(23.5);
    // 2026-11-09T02:00:00Z = 2026-11-08 23:00 no fuso do estudio
    expect(
      hoursUntilOccurrence("2026-11-10", "19:00:00", new Date("2026-11-09T02:00:00Z")),
    ).toBe(44);
  });

  it("treats exactly 24 hours as eligible", () => {
    expect(isEligibleForCredit(24)).toBe(true);
    expect(isEligibleForCredit(24.5)).toBe(true);
  });

  it("treats 23 hours 59 minutes as not eligible", () => {
    expect(isEligibleForCredit(23 + 59 / 60)).toBe(false);
    expect(isEligibleForCredit(23.999)).toBe(false);
  });

  it("sets the credit expiry 30 days after the generation", () => {
    expect(creditExpiresAt(new Date("2026-11-09T12:00:00Z")).toISOString()).toBe(
      "2026-12-09T12:00:00.000Z",
    );
    // Vira o mes no meio do caminho
    expect(creditExpiresAt(new Date("2026-11-30T12:00:00Z")).toISOString()).toBe(
      "2026-12-30T12:00:00.000Z",
    );
  });
});
