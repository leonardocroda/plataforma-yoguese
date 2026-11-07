"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createBookingAction,
  createEnrollmentAction,
} from "../../../modules/classes/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

export type StudentOption = {
  id: string;
  name: string;
};

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

/**
 * Formularios minimos do admin para uma ocorrencia: reserva manual e
 * horario fixo. As acoes do servidor devolvem o erro do servico (por
 * exemplo, "sem vaga disponivel") e a mensagem aparece no formulario.
 */
export function OccurrenceForms({
  students,
  classSlotId,
  date,
}: {
  students: StudentOption[];
  classSlotId: string;
  date: string;
}) {
  const router = useRouter();

  const [booking, bookingAction, bookingPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await createBookingAction({
      studentId: String(formData.get("studentId")),
      classSlotId,
      date,
      type: String(formData.get("type")) as
        | "FIXED"
        | "MAKEUP"
        | "EXPERIMENTAL",
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

  useEffect(() => {
    if (booking.ok || enrollment.ok) router.refresh();
  }, [booking.ok, enrollment.ok, router]);

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
          <select name="studentId" required className={inputClass} defaultValue="">
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
          <select name="type" className={inputClass} defaultValue="MAKEUP">
            <option value="FIXED">Aula fixa</option>
            <option value="MAKEUP">Reposição</option>
            <option value="EXPERIMENTAL">Experimental</option>
          </select>
        </label>
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
    </div>
  );
}
