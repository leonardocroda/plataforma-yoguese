import { describe, expect, it } from "vitest";
import {
  canCancel,
  canConvert,
  canReschedule,
  cancellationKeepsRight,
  isTerminalStatus,
  occurrenceHasEnded,
} from "../rules";
import { studioDateTimeToInstant } from "../../../classes/domain/occurrences";

// EXP-34, EXP-35, EXP-36, EXP-38, EXP-56: regra das 24 horas, status que
// admitem cancelamento, reagendamento e conversao.

describe("experimental rules", () => {
  it("24 horas exatas mantem o direito e 23h59 perde", () => {
    expect(cancellationKeepsRight(24)).toBe(true);
    expect(cancellationKeepsRight(48)).toBe(true);
    expect(cancellationKeepsRight(25.5)).toBe(true);

    // 23h59 de antecedencia
    expect(cancellationKeepsRight(23 + 59 / 60)).toBe(false);
    expect(cancellationKeepsRight(0)).toBe(false);
    expect(cancellationKeepsRight(-1)).toBe(false);
  });

  it("status terminal recusa cancelar e reagendar", () => {
    const terminal = [
      "RECUSADA",
      "CANCELADA_SEM_DIREITO",
      "FALTA",
      "CONVERTIDA",
      "DUPLICADA",
    ] as const;

    for (const status of terminal) {
      expect(isTerminalStatus(status)).toBe(true);
      expect(canCancel(status)).toBe(false);
      expect(canReschedule(status)).toBe(false);
    }

    // A cancelada com direito nao e terminal: o direito ainda se exerce
    expect(isTerminalStatus("CANCELADA_COM_DIREITO")).toBe(false);
    expect(canReschedule("CANCELADA_COM_DIREITO")).toBe(true);
    expect(canCancel("CANCELADA_COM_DIREITO")).toBe(false);

    // Enquanto a solicitacao esta viva, o admin pode cancelar
    expect(canCancel("PENDENTE")).toBe(true);
    expect(canCancel("APROVADA")).toBe(true);
    expect(canReschedule("PENDENTE")).toBe(false);
    expect(canReschedule("APROVADA")).toBe(false);
  });

  it("converter exige aprovada e ocorrencia terminada", () => {
    expect(canConvert("APROVADA")).toBe(true);
    expect(canConvert("PENDENTE")).toBe(false);
    expect(canConvert("CANCELADA_COM_DIREITO")).toBe(false);
    expect(canConvert("CANCELADA_SEM_DIREITO")).toBe(false);
    expect(canConvert("RECUSADA")).toBe(false);
    expect(canConvert("FALTA")).toBe(false);
    expect(canConvert("CONVERTIDA")).toBe(false);
    expect(canConvert("DUPLICADA")).toBe(false);

    const end = studioDateTimeToInstant("2026-11-12", "20:00:00");
    expect(occurrenceHasEnded(end, new Date(end.getTime()))).toBe(true);
    expect(
      occurrenceHasEnded(end, new Date(end.getTime() - 60_000)),
    ).toBe(false);
  });
});
