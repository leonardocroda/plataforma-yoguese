"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBookingAction,
  createEnrollmentAction,
} from "../../../modules/classes/actions";
import {
  bookMakeupByAdminAction,
  cancelOccurrenceByStudioAction,
  registerNonAttendanceAction,
} from "../../../modules/credits/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

export type StudentOption = {
  id: string;
  name: string;
};

/** Credito DISPONIVEL do aluno, como aparece no select. */
export type CreditOption = {
  id: string;
  label: string;
};

type BookingType = "FIXED" | "MAKEUP" | "EXPERIMENTAL";

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

/**
 * Formularios minimos do admin para uma ocorrencia: reserva manual (com a
 * reposicao manual, que exige um credito DISPONIVEL do aluno), horario fixo,
 * aviso de nao comparecimento e cancelamento da aula pelo estudio. As acoes
 * do servidor devolvem o erro do servico (por exemplo, "sem vaga disponivel")
 * e a mensagem aparece no formulario.
 */
export function OccurrenceForms({
  students,
  classSlotId,
  date,
  classSessionId,
  fixedStudents = [],
  creditsByStudent = {},
}: {
  students: StudentOption[];
  classSlotId: string;
  date: string;
  /** Ocorrencia materializada: exigida pelos forms de credito. */
  classSessionId?: string;
  /** Alunos fixos da ocorrencia: os candidatos ao aviso de nao comparecimento. */
  fixedStudents?: StudentOption[];
  /** Creditos DISPONIVEL por aluno, para a reposicao manual. */
  creditsByStudent?: Record<string, CreditOption[]>;
}) {
  const router = useRouter();

  // A reserva manual e a reposicao manual compartilham o form: quando o tipo
  // e MAKEUP o admin escolhe o credito do aluno (CRD-43).
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<BookingType>("MAKEUP");
  const [creditId, setCreditId] = useState("");
  const credits = studentId ? (creditsByStudent[studentId] ?? []) : [];

  const [booking, bookingAction, bookingPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const selectedStudent = String(formData.get("studentId"));
    const selectedType = String(formData.get("type")) as BookingType;
    const selectedCredit = String(formData.get("creditId") ?? "");

    if (selectedType === "MAKEUP") {
      // A reposicao manual so confirma com um credito escolhido (CRD-43)
      if (!selectedCredit) {
        return {
          ok: false,
          message: "Escolha o credito do aluno para a reposicao.",
        };
      }
      const result = await bookMakeupByAdminAction({
        studentId: selectedStudent,
        classSlotId,
        date,
        creditId: selectedCredit,
      });
      return result.ok
        ? { ok: true, message: "Reposicao manual confirmada." }
        : { ok: false, message: result.error };
    }

    const result = await createBookingAction({
      studentId: selectedStudent,
      classSlotId,
      date,
      type: selectedType,
    });
    return result.ok
      ? { ok: true, message: "Reserva confirmada." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  const [enrollment, enrollmentAction, enrollmentPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await createEnrollmentAction({
      studentId: String(formData.get("studentId")),
      classSlotId,
      startDate: date,
    });
    return result.ok
      ? { ok: true, message: "Horario fixo vinculado." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  const [absence, absenceAction, absencePending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await registerNonAttendanceAction({
      studentId: String(formData.get("studentId")),
      classSessionId: classSessionId ?? "",
    });
    if (!result.ok) return { ok: false, message: result.error };
    const { status, credit, noticeHours } = result.value;
    const hours = Math.floor(noticeHours);
    const outcome = status === "CANCELADA" ? "Cancelamento" : "Falta";
    // Com 24h ou mais o aluno recebe o credito; com menos, e falta sem credito
    return credit
      ? {
          ok: true,
          message: `${outcome} registrado (${hours}h de antecedencia): credito gerado, vence em ${formatDate(credit.expiresAt)}.`,
        }
      : {
          ok: true,
          message: `${outcome} registrado (${hours}h de antecedencia): sem credito.`,
        };
  }, INITIAL_STATE);

  const [cancellation, cancellationAction, cancellationPending] =
    useActionState<ActionState, FormData>(async () => {
      const result = await cancelOccurrenceByStudioAction({
        classSessionId: classSessionId ?? "",
      });
      if (!result.ok) return { ok: false, message: result.error };
      const { cancelledBookings, grantedCredits, returnedCredits } =
        result.value;
      return {
        ok: true,
        message: `Aula cancelada: ${cancelledBookings} reservas canceladas, ${grantedCredits} creditos gerados, ${returnedCredits} creditos devolvidos.`,
      };
    }, INITIAL_STATE);

  useEffect(() => {
    if (
      booking.ok ||
      enrollment.ok ||
      absence.ok ||
      cancellation.ok
    ) {
      router.refresh();
    }
  }, [
    booking.ok,
    enrollment.ok,
    absence.ok,
    cancellation.ok,
    router,
  ]);

  if (students.length === 0) {
    return (
      <p className="mt-3 text-xs opacity-70">
        Nenhum aluno ativo cadastrado.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <form action={bookingAction} className="space-y-2">
        <label className="block text-xs font-medium">
          Reserva manual
          <select
            name="studentId"
            required
            className={inputClass}
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              setCreditId("");
            }}
          >
            <option value="">Selecione o aluno</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium">
          Tipo
          <select
            name="type"
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value as BookingType)}
          >
            <option value="FIXED">Aula fixa</option>
            <option value="MAKEUP">Reposição</option>
            <option value="EXPERIMENTAL">Experimental</option>
          </select>
        </label>
        {type === "MAKEUP" ? (
          <label className="block text-xs font-medium">
            Crédito da reposição
            <select
              name="creditId"
              className={inputClass}
              value={creditId}
              onChange={(event) => setCreditId(event.target.value)}
            >
              <option value="">Selecione o crédito</option>
              {credits.map((credit) => (
                <option key={credit.id} value={credit.id}>
                  {credit.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {type === "MAKEUP" ? (
          <p className="text-xs opacity-70">
            Reposição manual: exige um crédito DISPONIVEL do aluno.
          </p>
        ) : null}
        <button type="submit" disabled={bookingPending} className={buttonClass}>
          {bookingPending ? "Reservando..." : "Reservar"}
        </button>
        {booking.message ? (
          <p
            className={
              booking.ok
                ? "text-xs text-[var(--yoguese-cinza)]"
                : "text-xs text-red-700"
            }
          >
            {booking.message}
          </p>
        ) : null}
      </form>

      <form action={enrollmentAction} className="space-y-2">
        <label className="block text-xs font-medium">
          Horário fixo
          <select name="studentId" required className={inputClass} defaultValue="">
            <option value="">Selecione o aluno</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={enrollmentPending}
          className={buttonClass}
        >
          {enrollmentPending ? "Vinculando..." : "Vincular fixo"}
        </button>
        {enrollment.message ? (
          <p
            className={
              enrollment.ok
                ? "text-xs text-[var(--yoguese-cinza)]"
                : "text-xs text-red-700"
            }
          >
            {enrollment.message}
          </p>
        ) : null}
      </form>

      {classSessionId ? (
        <form action={absenceAction} className="space-y-2">
          <label className="block text-xs font-medium">
            Aviso de não comparecimento
            <select
              name="studentId"
              required
              className={inputClass}
              defaultValue=""
            >
              <option value="">Selecione o aluno fixo</option>
              {fixedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={absencePending}
            className={buttonClass}
          >
            {absencePending ? "Registrando..." : "Registrar aviso"}
          </button>
          {absence.message ? (
            <p
              className={
                absence.ok
                  ? "text-xs text-[var(--yoguese-cinza)]"
                  : "text-xs text-red-700"
              }
            >
              {absence.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {classSessionId ? (
        <form action={cancellationAction} className="space-y-2">
          <button
            type="submit"
            disabled={cancellationPending}
            className={buttonClass}
          >
            {cancellationPending ? "Cancelando..." : "Cancelar aula"}
          </button>
          {cancellation.message ? (
            <p
              className={
                cancellation.ok
                  ? "text-xs text-[var(--yoguese-cinza)]"
                  : "text-xs text-red-700"
              }
            >
              {cancellation.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
