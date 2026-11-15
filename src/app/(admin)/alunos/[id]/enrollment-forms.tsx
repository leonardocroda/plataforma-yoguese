"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { endEnrollmentAction } from "../../../../modules/students/actions";
import { Button, Toast } from "../../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

/** O vinculo do perfil: dia, horarios, modalidade e o inicio. */
export type EnrollmentItem = {
  id: string;
  classTypeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  startDate: string;
};

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function formatTime(value: string): string {
  return value.slice(0, 5);
}

/** Sucesso na pilula preta do guia; falha em texto puro no token de erro. */
function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  if (state.ok) {
    return (
      <div className="mt-3">
        <Toast>{state.message}</Toast>
      </div>
    );
  }
  return (
    <p
      role="alert"
      className="mt-2 text-[14px] font-medium text-[color:var(--erro)]"
    >
      {state.message}
    </p>
  );
}

const DATE_CLASS =
  "min-h-[50px] rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pena)] px-3";

/**
 * Horarios fixos ativos com o encerramento inline (FIX-01, FIX-04): um
 * formulario por vinculo com a data de encerramento pre-preenchida com
 * hoje do estudio. O feedback fica no host unico fora da lista (a linha
 * encerrada sai da lista no refresh) e o refresh depende do estado inteiro
 * (L-034), nao de um booleano dele.
 */
export function EnrollmentsSection({
  enrollments,
  today,
}: {
  enrollments: EnrollmentItem[];
  today: string;
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const date = String(formData.get("date") ?? "").trim();
      const result = await endEnrollmentAction({
        enrollmentId: String(formData.get("enrollmentId") ?? ""),
        date: date || undefined,
      });
      return result.ok
        ? {
            ok: true,
            message: `Horário fixo encerrado a partir de ${result.value.endDate}.`,
          }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (enrollments.length === 0) {
    return <p className="text-[15px] text-[color:var(--cinza)]">Nenhum horário fixo ativo.</p>;
  }

  return (
    <div>
      <ul className="m-0 list-none p-0 text-[15px]">
        {enrollments.map((enrollment) => (
          <li
            key={enrollment.id}
            className="border-t border-t-[var(--linha)] py-2 first:border-t-0"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="m-0">
                {WEEKDAY_LABELS[enrollment.weekday - 1]} das{" "}
                {formatTime(enrollment.startTime)} às{" "}
                {formatTime(enrollment.endTime)} - {enrollment.classTypeName}{" "}
                (desde {new Date(enrollment.startDate).toLocaleDateString("pt-BR")})
              </p>
              <form action={formAction} className="flex items-end gap-2">
                <input type="hidden" name="enrollmentId" value={enrollment.id} />
                <label className="text-[13px] text-[color:var(--cinza)]">
                  Encerrar em
                  <input
                    type="date"
                    name="date"
                    defaultValue={today}
                    required
                    className={`mt-1 block ${DATE_CLASS}`}
                    aria-label={`Encerrar em data o horário fixo de ${WEEKDAY_LABELS[enrollment.weekday - 1]}`}
                  />
                </label>
                <Button type="submit" variant="sec" small disabled={pending}>
                  {pending ? "Encerrando…" : "Encerrar"}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <Feedback state={state} />
    </div>
  );
}
