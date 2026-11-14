"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  deactivateSlotAction,
  updateSlotAction,
} from "../../../modules/classes/actions";
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

// O dia da semana no banco vai de 1 (domingo) a 7 (sabado), como o
// validador de turma (RES-03).
const WEEKDAYS = [
  { value: 1, label: "Domingo" },
  { value: 2, label: "Segunda" },
  { value: 3, label: "Terça" },
  { value: 4, label: "Quarta" },
  { value: 5, label: "Quinta" },
  { value: 6, label: "Sexta" },
  { value: 7, label: "Sábado" },
];

const NUMBER_CLASS =
  "w-full min-h-[50px] rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pena)] px-4";

function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

function Feedback({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  if (ok) {
    return (
      <div className="mt-3">
        <Toast>{message}</Toast>
      </div>
    );
  }
  return (
    <p
      role="alert"
      className="mt-2 text-[14px] font-medium text-[color:var(--erro)]"
    >
      {message}
    </p>
  );
}

/**
 * Edicao, desativacao e reativacao de uma turma (TURM-13 a TURM-18). Quando
 * o dia ou o horario muda, o servidor cancela as ocorrencias futuras da grade
 * antiga (AD-013) e devolve o resumo: quantas ocorrencias foram canceladas e
 * quantos creditos de estudio foram gerados (TURM-16).
 */
export function ClassCardForms({
  slotId,
  weekday,
  startTime,
  endTime,
  capacity,
  status,
}: {
  slotId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  status: "ATIVA" | "INATIVA";
}) {
  const router = useRouter();

  const [edited, editAction, editPending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await updateSlotAction(slotId, {
        weekday: Number(formData.get("weekday") ?? 0),
        startTime: String(formData.get("startTime") ?? ""),
        endTime: String(formData.get("endTime") ?? ""),
        capacity: Number(formData.get("capacity") ?? 0),
      });
      if (!result.ok) return { ok: false, message: result.error };
      const summary = result.value.scheduleEdit;
      if (!summary) return { ok: true, message: "Turma atualizada." };
      return {
        ok: true,
        message: `Turma atualizada. ${plural(summary.cancelledOccurrences, "ocorrência cancelada", "ocorrências canceladas")} na grade antiga e ${plural(summary.grantedCredits, "crédito gerado", "créditos gerados")}.`,
      };
    },
    INITIAL_STATE,
  );

  const [deactivated, deactivateAction, deactivatePending] = useActionState<
    ActionState,
    FormData
  >(async () => {
    const result = await deactivateSlotAction(slotId);
    return result.ok
      ? { ok: true, message: "Turma desativada. O histórico foi preservado." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  const [reactivated, reactivateAction, reactivatePending] = useActionState<
    ActionState,
    FormData
  >(async () => {
    const result = await updateSlotAction(slotId, { status: "ATIVA" });
    return result.ok
      ? { ok: true, message: "Turma reativada." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  // O refresh depende do estado inteiro: com so `edited.ok` no array, a
  // segunda operacao bem-sucedida nao atualizava a listagem.
  useEffect(() => {
    if (edited.ok || deactivated.ok || reactivated.ok) router.refresh();
  }, [edited, deactivated, reactivated, router]);

  return (
    <div className="mt-3 space-y-4">
      <form action={editAction}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Dia da semana" id={`turma-dia-${slotId}`}>
            <select
              id={`turma-dia-${slotId}`}
              name="weekday"
              defaultValue={weekday}
              required
            >
              {WEEKDAYS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Capacidade" id={`turma-capacidade-${slotId}`}>
            <input
              id={`turma-capacidade-${slotId}`}
              name="capacity"
              type="number"
              min={1}
              defaultValue={capacity}
              required
              className={NUMBER_CLASS}
            />
          </Field>

          <Field label="Horário de início" id={`turma-inicio-${slotId}`}>
            <input
              id={`turma-inicio-${slotId}`}
              name="startTime"
              type="time"
              defaultValue={startTime}
              required
            />
          </Field>

          <Field label="Horário de término" id={`turma-fim-${slotId}`}>
            <input
              id={`turma-fim-${slotId}`}
              name="endTime"
              type="time"
              defaultValue={endTime}
              required
            />
          </Field>
        </div>
        <Button type="submit" variant="sec" small disabled={editPending}>
          {editPending ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Feedback ok={edited.ok} message={edited.message} />
      </form>

      {status === "ATIVA" ? (
        <form action={deactivateAction}>
          <Button
            type="submit"
            variant="sec"
            small
            disabled={deactivatePending}
          >
            {deactivatePending ? "Desativando…" : "Desativar turma"}
          </Button>
          <Feedback ok={deactivated.ok} message={deactivated.message} />
        </form>
      ) : (
        <form action={reactivateAction}>
          <Button
            type="submit"
            variant="sec"
            small
            disabled={reactivatePending}
          >
            {reactivatePending ? "Reativando…" : "Reativar turma"}
          </Button>
          <Feedback ok={reactivated.ok} message={reactivated.message} />
        </form>
      )}
    </div>
  );
}
