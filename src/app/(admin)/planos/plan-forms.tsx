"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPlanAction,
  deactivatePlanAction,
  updatePlanAction,
} from "../../../modules/plans/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

/**
 * Formularios de plano (PLAN-01 a PLAN-04): criar, editar e inativar. O
 * feedback da operacao aparece no formulario, fora da listagem.
 */
export function CreatePlanForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await createPlanAction({
        name: String(formData.get("name") ?? ""),
        price: String(formData.get("price") ?? ""),
        weeklyFrequency: Number(formData.get("weeklyFrequency") ?? 0),
        description: String(formData.get("description") ?? "") || null,
      });
      return result.ok
        ? { ok: true, message: `Plano "${result.value.name}" criado.` }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-2">
      <label className="block text-xs font-medium">
        Nome
        <input name="name" required className={inputClass} />
      </label>
      <label className="block text-xs font-medium">
        Valor mensal (R$)
        <input
          name="price"
          required
          inputMode="decimal"
          className={inputClass}
          placeholder="Ex.: 180.00"
        />
      </label>
      <label className="block text-xs font-medium">
        Aulas por semana
        <input
          name="weeklyFrequency"
          type="number"
          min={1}
          required
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-medium">
        Descrição (opcional)
        <input name="description" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Criando..." : "Criar plano"}
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

/** Edicao e inativacao de um plano, no proprio cartao do plano. */
export function PlanCardForms({
  planId,
  name,
  price,
  weeklyFrequency,
  description,
  status,
}: {
  planId: string;
  name: string;
  price: string;
  weeklyFrequency: number;
  description: string | null;
  status: "ATIVO" | "INATIVO";
}) {
  const router = useRouter();

  const [edited, editAction, editPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await updatePlanAction({
      planId,
      name: String(formData.get("name") ?? ""),
      price: String(formData.get("price") ?? ""),
      weeklyFrequency: Number(formData.get("weeklyFrequency") ?? 0),
      description: String(formData.get("description") ?? ""),
    });
    return result.ok
      ? { ok: true, message: "Plano atualizado." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  const [deactivated, deactivateAction, deactivatePending] = useActionState<
    ActionState,
    FormData
  >(async () => {
    const result = await deactivatePlanAction(planId);
    return result.ok
      ? { ok: true, message: "Plano inativado." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  useEffect(() => {
    if (edited.ok || deactivated.ok) router.refresh();
  }, [edited.ok, deactivated.ok, router]);

  return (
    <div className="mt-2 space-y-2">
      <form action={editAction} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium">
            Nome
            <input name="name" defaultValue={name} required className={inputClass} />
          </label>
          <label className="block text-xs font-medium">
            Valor mensal (R$)
            <input
              name="price"
              defaultValue={price}
              required
              inputMode="decimal"
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium">
            Aulas por semana
            <input
              name="weeklyFrequency"
              type="number"
              min={1}
              defaultValue={weeklyFrequency}
              required
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium">
            Descrição
            <input
              name="description"
              defaultValue={description ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <button type="submit" disabled={editPending} className={buttonClass}>
          {editPending ? "Salvando..." : "Salvar alterações"}
        </button>
        {edited.message ? (
          <p
            className={
              edited.ok
                ? "text-xs text-[var(--yoguese-cinza)]"
                : "text-xs text-red-700"
            }
          >
            {edited.message}
          </p>
        ) : null}
      </form>

      {status === "ATIVO" ? (
        <form action={deactivateAction} className="space-y-2">
          <button
            type="submit"
            disabled={deactivatePending}
            className="rounded border border-[var(--yoguese-bege)] px-2 py-1 text-xs hover:bg-[var(--yoguese-off-white)]"
          >
            {deactivatePending ? "Inativando..." : "Inativar plano"}
          </button>
          {deactivated.message ? (
            <p
              className={
                deactivated.ok
                  ? "text-xs text-[var(--yoguese-cinza)]"
                  : "text-xs text-red-700"
              }
            >
              {deactivated.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
