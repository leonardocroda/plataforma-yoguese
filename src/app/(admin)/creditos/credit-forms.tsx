"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelCreditAction,
  grantCreditAction,
  returnCreditAction,
} from "../../../modules/credits/actions";
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

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

/**
 * Formularios de credito do aluno (CRD-40): conceder, devolver e cancelar.
 * O motivo e obrigatorio no formulario e o servico recusa a alteracao sem
 * motivo (CRD-16). Depois da acao a pilula preta nomeia o novo status e a
 * lista de transacoes mostra o registro.
 */
export function GrantCreditForm({ studentId }: { studentId: string }) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await grantCreditAction({
        studentId,
        reason: String(formData.get("reason") ?? ""),
      });
      if (!result.ok) return { ok: false, message: result.error };
      return {
        ok: true,
        message: `Crédito concedido. Novo status: ${result.value.credit.status}.`,
      };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <div className="mt-4">
        <Field label="Motivo da concessão" id="credito-motivo">
          <input
            id="credito-motivo"
            name="reason"
            type="text"
            required
            placeholder="Ex.: bonificação do estúdio"
          />
        </Field>
      </div>
      <Button type="submit" variant="prim" disabled={pending}>
        {pending ? "Concedendo…" : "Conceder crédito"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Devolucao e cancelamento de um credito, cada um com o seu motivo. */
export function CreditChangeForms({ creditId }: { creditId: string }) {
  const router = useRouter();

  const [returned, returnAction, returnPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await returnCreditAction({
      creditId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.error };
    return {
      ok: true,
      message: `Crédito devolvido. Novo status: ${result.value.credit.status}.`,
    };
  }, INITIAL_STATE);

  const [cancelled, cancelAction, cancelPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await cancelCreditAction({
      creditId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.error };
    return {
      ok: true,
      message: `Crédito cancelado. Novo status: ${result.value.credit.status}.`,
    };
  }, INITIAL_STATE);

  useEffect(() => {
    if (returned.ok || cancelled.ok) router.refresh();
  }, [returned.ok, cancelled.ok, router]);

  return (
    <div className="mt-4 space-y-4">
      <form action={returnAction}>
        <Field label="Motivo da devolução" id={`credito-devolucao-${creditId}`}>
          <input
            id={`credito-devolucao-${creditId}`}
            name="reason"
            type="text"
            required
            placeholder="Ex.: ajuste do estúdio"
          />
        </Field>
        <Button type="submit" variant="sec" small disabled={returnPending}>
          {returnPending ? "Devolvendo…" : "Devolver crédito"}
        </Button>
        <Feedback state={returned} />
      </form>

      <form action={cancelAction}>
        <Field
          label="Motivo do cancelamento"
          id={`credito-cancelamento-${creditId}`}
        >
          <input
            id={`credito-cancelamento-${creditId}`}
            name="reason"
            type="text"
            required
            placeholder="Ex.: crédito indevido"
          />
        </Field>
        <Button type="submit" variant="sec" small disabled={cancelPending}>
          {cancelPending ? "Cancelando…" : "Cancelar crédito"}
        </Button>
        <Feedback state={cancelled} />
      </form>
    </div>
  );
}
