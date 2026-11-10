"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelCreditAction,
  grantCreditAction,
  returnCreditAction,
} from "../../../modules/credits/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

/**
 * Formularios de credito do aluno (CRD-40): conceder, devolver e cancelar.
 * O motivo e obrigatorio no formulario e o servico recusa a alteracao sem
 * motivo (CRD-16). Depois da acao o formulario mostra o novo status e a
 * transacao registrada.
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
      const { credit, transaction } = result.value;
      return {
        ok: true,
        message: `Novo status: ${credit.status}. Transação: ${transaction.action} (${
          transaction.previousStatus ?? "-"
        } -> ${transaction.newStatus}) - ${transaction.reason} - ${
          transaction.adminLabel
        } em ${formatDate(transaction.createdAt)}.`,
      };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-2">
      <label className="block text-xs font-medium">
        Motivo da concessão
        <input
          name="reason"
          required
          className={inputClass}
          placeholder="Ex.: bonificacao do estudio"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Concedendo..." : "Conceder crédito"}
      </button>
      {state.message ? (
        <p
          className={
            state.ok
              ? "text-xs text-[var(--yoguese-cinza)]"
              : "text-xs text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}
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
    const { credit, transaction } = result.value;
    return {
      ok: true,
      message: `Novo status: ${credit.status}. Transação: ${transaction.action} (${
        transaction.previousStatus ?? "-"
      } -> ${transaction.newStatus}) - ${transaction.reason} - ${
        transaction.adminLabel
      } em ${formatDate(transaction.createdAt)}.`,
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
    const { credit, transaction } = result.value;
    return {
      ok: true,
      message: `Novo status: ${credit.status}. Transação: ${transaction.action} (${
        transaction.previousStatus ?? "-"
      } -> ${transaction.newStatus}) - ${transaction.reason} - ${
        transaction.adminLabel
      } em ${formatDate(transaction.createdAt)}.`,
    };
  }, INITIAL_STATE);

  useEffect(() => {
    if (returned.ok || cancelled.ok) router.refresh();
  }, [returned.ok, cancelled.ok, router]);

  return (
    <div className="mt-2 space-y-2">
      <form action={returnAction} className="space-y-2">
        <label className="block text-xs font-medium">
          Motivo da devolução
          <input
            name="reason"
            required
            className={inputClass}
            placeholder="Ex.: ajuste do estudio"
          />
        </label>
        <button
          type="submit"
          disabled={returnPending}
          className={buttonClass}
        >
          {returnPending ? "Devolvendo..." : "Devolver crédito"}
        </button>
        {returned.message ? (
          <p
            className={
              returned.ok
                ? "text-xs text-[var(--yoguese-cinza)]"
                : "text-xs text-red-700"
            }
          >
            {returned.message}
          </p>
        ) : null}
      </form>

      <form action={cancelAction} className="space-y-2">
        <label className="block text-xs font-medium">
          Motivo do cancelamento
          <input
            name="reason"
            required
            className={inputClass}
            placeholder="Ex.: credito indevido"
          />
        </label>
        <button type="submit" disabled={cancelPending} className={buttonClass}>
          {cancelPending ? "Cancelando..." : "Cancelar crédito"}
        </button>
        {cancelled.message ? (
          <p
            className={
              cancelled.ok
                ? "text-xs text-[var(--yoguese-cinza)]"
                : "text-xs text-red-700"
            }
          >
            {cancelled.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
