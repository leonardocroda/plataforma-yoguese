import type { bookings, fixedEnrollments } from "../../../db/schema";

export type OccurrenceParticipant = {
  id: string;
  name: string;
  kind: "fixo" | "reposição" | "experimental";
  /** Aluno com cadastro; a experimental aprovada ainda nao tem um. */
  studentId: string | null;
};

export type OccurrenceNotice = {
  id: string;
  studentId: string;
  name: string;
  status: "CANCELADA" | "FALTA";
};

export type FixedParticipant = {
  id: string;
  name: string;
};

type Enrollment = Pick<
  typeof fixedEnrollments.$inferSelect,
  "studentId" | "classSlotId" | "startDate" | "endDate"
>;

type Booking = Pick<
  typeof bookings.$inferSelect,
  "id" | "studentId" | "bookingType" | "status"
>;

type ApprovedExperimentalParticipant = {
  id: string;
  name: string;
};

/** O vinculo fixo cobre a data da ocorrencia (RES-23). */
export function coversDate(enrollment: Enrollment, date: string): boolean {
  if (enrollment.startDate > date) return false;
  if (enrollment.endDate && enrollment.endDate <= date) return false;
  return true;
}

/**
 * Participantes da ocorrencia: os fixos do vinculo, as reservas ativas e as
 * experimentais aprovadas. O aluno que avisou falta ou cancelamento nao conta
 * como participante: o registro dele aparece no resultado da acao (CRD-09,
 * AD-022).
 */
export function occurrenceParticipants(input: {
  slotId: string;
  date: string;
  enrollments: Enrollment[];
  bookings: Booking[];
  nameById: Map<string, string>;
  approvedExperimentals: ApprovedExperimentalParticipant[];
}): {
  participants: OccurrenceParticipant[];
  fixed: FixedParticipant[];
  notices: OccurrenceNotice[];
} {
  const nameOf = (studentId: string): string =>
    input.nameById.get(studentId) ?? "Aluno";

  const notices = input.bookings
    .filter(
      (booking) =>
        booking.bookingType === "FIXED" &&
        (booking.status === "CANCELADA" || booking.status === "FALTA"),
    )
    .map((booking) => ({
      id: booking.id,
      studentId: booking.studentId,
      name: nameOf(booking.studentId),
      status: booking.status as "CANCELADA" | "FALTA",
    }));
  const notified = new Set(notices.map((notice) => notice.studentId));

  const participants: OccurrenceParticipant[] = [];
  const listed = new Set<string>();
  const fixed: FixedParticipant[] = [];

  for (const enrollment of input.enrollments) {
    if (enrollment.classSlotId !== input.slotId) continue;
    if (!coversDate(enrollment, input.date)) continue;
    if (listed.has(enrollment.studentId)) continue;
    listed.add(enrollment.studentId);
    const name = nameOf(enrollment.studentId);
    if (!notified.has(enrollment.studentId)) {
      participants.push({
        id: enrollment.studentId,
        name,
        kind: "fixo",
        studentId: enrollment.studentId,
      });
      fixed.push({ id: enrollment.studentId, name });
    }
  }

  for (const booking of input.bookings) {
    if (booking.status !== "ATIVA") continue;
    if (listed.has(booking.studentId)) continue;
    listed.add(booking.studentId);
    const name = nameOf(booking.studentId);
    if (booking.bookingType === "MAKEUP") {
      participants.push({
        id: booking.studentId,
        name,
        kind: "reposição",
        studentId: booking.studentId,
      });
    } else if (booking.bookingType === "EXPERIMENTAL") {
      participants.push({
        id: booking.studentId,
        name,
        kind: "experimental",
        studentId: booking.studentId,
      });
    } else {
      participants.push({
        id: booking.studentId,
        name,
        kind: "fixo",
        studentId: booking.studentId,
      });
    }
  }

  // As experimentais aprovadas da ocorrencia entram como participantes com
  // o vinculo "experimental" (EXP-43): a pessoa que veio pela aula
  // experimental ocupa a vaga da ocorrencia
  for (const experimental of input.approvedExperimentals) {
    participants.push({
      id: experimental.id,
      name: experimental.name,
      kind: "experimental",
      studentId: null,
    });
  }

  return { participants, fixed, notices };
}
