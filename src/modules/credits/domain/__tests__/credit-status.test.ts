import { describe, expect, it } from "vitest";
import { effectiveCreditStatus } from "../credit-status";

// Status efetivo do credito na leitura (CRD-13, CRD-44): expiracao e uso
// sao calculados na hora, o status persistido e cache (AD-007).
describe("credit status", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const future = new Date("2026-12-09T12:00:00Z");
  const past = new Date("2026-11-08T12:00:00Z");

  it("reports an expired credit as VENCIDO", () => {
    expect(
      effectiveCreditStatus({ status: "DISPONIVEL", expiresAt: past }, now),
    ).toBe("VENCIDO");
  });

  it("reports a reserved credit whose class ended as UTILIZADO", () => {
    expect(
      effectiveCreditStatus(
        { status: "RESERVADO", expiresAt: future },
        now,
        true,
      ),
    ).toBe("UTILIZADO");
  });

  it("keeps a cancelled credit as CANCELADO", () => {
    // CANCELADO e terminal: vence ate o vencimento e a occorrencia encerrada
    expect(
      effectiveCreditStatus({ status: "CANCELADO", expiresAt: past }, now, true),
    ).toBe("CANCELADO");
  });

  it("keeps a used credit as UTILIZADO", () => {
    expect(
      effectiveCreditStatus({ status: "UTILIZADO", expiresAt: future }, now),
    ).toBe("UTILIZADO");
  });

  it("keeps a valid credit as DISPONIVEL", () => {
    expect(
      effectiveCreditStatus({ status: "DISPONIVEL", expiresAt: future }, now),
    ).toBe("DISPONIVEL");
  });

  it("keeps a reserved credit whose class did not end as RESERVADO", () => {
    expect(
      effectiveCreditStatus({ status: "RESERVADO", expiresAt: future }, now),
    ).toBe("RESERVADO");
  });

  it("settles a reserved credit whose expiry came before the class as UTILIZADO", () => {
    // Edge case do spec: o credito vence antes da aula ja reservada, mas a
    // reserva permanece valida e o credito e liquidado no fim da aula
    expect(
      effectiveCreditStatus({ status: "RESERVADO", expiresAt: past }, now, true),
    ).toBe("UTILIZADO");
  });
});
