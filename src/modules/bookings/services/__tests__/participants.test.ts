import { describe, expect, it } from "vitest";

import { occurrenceParticipants } from "../participants";

const SLOT_ID = "slot-a";
const DATE = "2026-11-17";

function enrollment(
  studentId: string,
  overrides: Partial<{
    classSlotId: string;
    startDate: string;
    endDate: string | null;
  }> = {},
) {
  return {
    studentId,
    classSlotId: SLOT_ID,
    startDate: "2026-01-01",
    endDate: null,
    ...overrides,
  };
}

function booking(
  id: string,
  studentId: string,
  bookingType: "FIXED" | "MAKEUP" | "EXPERIMENTAL",
  status: "ATIVA" | "CANCELADA" | "FALTA" = "ATIVA",
) {
  return { id, studentId, bookingType, status };
}

function names(entries: Array<[string, string]>) {
  return new Map(entries);
}

describe("participants", () => {
  it("lists a fixed student whose enrollment covers the occurrence date", () => {
    const result = occurrenceParticipants({
      slotId: SLOT_ID,
      date: DATE,
      enrollments: [
        enrollment("fixed-student", { startDate: "2026-11-01" }),
        enrollment("other-slot-student", { classSlotId: "slot-b" }),
        enrollment("not-started-student", { startDate: "2026-11-18" }),
        enrollment("ended-student", {
          startDate: "2026-01-01",
          endDate: "2026-11-17",
        }),
      ],
      bookings: [],
      nameById: names([
        ["fixed-student", "Ana Fixa"],
        ["other-slot-student", "Outra Turma"],
        ["not-started-student", "AindaNao"],
        ["ended-student", "JaEncerrou"],
      ]),
      approvedExperimentals: [],
    });

    expect(result.participants).toEqual([
      { id: "fixed-student", name: "Ana Fixa", kind: "fixo" },
    ]);
    expect(result.fixed).toEqual([{ id: "fixed-student", name: "Ana Fixa" }]);
  });

  it("keeps a notified fixed student out of the participant list and records the notice", () => {
    const result = occurrenceParticipants({
      slotId: SLOT_ID,
      date: DATE,
      enrollments: [enrollment("notified-student")],
      bookings: [booking("notice-1", "notified-student", "FIXED", "FALTA")],
      nameById: names([["notified-student", "Ana Avisou"]]),
      approvedExperimentals: [],
    });

    expect(result.participants).toEqual([]);
    expect(result.fixed).toEqual([]);
    expect(result.notices).toEqual([
      {
        id: "notice-1",
        studentId: "notified-student",
        name: "Ana Avisou",
        status: "FALTA",
      },
    ]);
  });

  it("classifies active bookings as makeup, experimental or fixed", () => {
    const result = occurrenceParticipants({
      slotId: SLOT_ID,
      date: DATE,
      enrollments: [],
      bookings: [
        booking("booking-makeup", "makeup-student", "MAKEUP"),
        booking("booking-experimental", "experimental-student", "EXPERIMENTAL"),
        booking("booking-fixed", "booking-fixed-student", "FIXED"),
        booking("booking-cancelled", "cancelled-student", "MAKEUP", "CANCELADA"),
      ],
      nameById: names([
        ["makeup-student", "Ana Reposicao"],
        ["experimental-student", "Ana Experimental"],
        ["booking-fixed-student", "Ana Reserva Fixa"],
        ["cancelled-student", "Ana Cancelada"],
      ]),
      approvedExperimentals: [],
    });

    expect(result.participants).toEqual([
      { id: "makeup-student", name: "Ana Reposicao", kind: "reposição" },
      {
        id: "experimental-student",
        name: "Ana Experimental",
        kind: "experimental",
      },
      { id: "booking-fixed-student", name: "Ana Reserva Fixa", kind: "fixo" },
    ]);
  });

  it("lists an approved experimental as an experimental participant", () => {
    const result = occurrenceParticipants({
      slotId: SLOT_ID,
      date: DATE,
      enrollments: [],
      bookings: [],
      nameById: names(),
      approvedExperimentals: [
        { id: "experimental-1", name: "Ana Convidada" },
      ],
    });

    expect(result.participants).toEqual([
      { id: "experimental-1", name: "Ana Convidada", kind: "experimental" },
    ]);
  });
});
