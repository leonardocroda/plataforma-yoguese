"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPlanAction,
  deactivatePlanAction,
  updatePlanAction,
} from "../../../modules/plans/actions";
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

// O guia estiliza os campos pelo tipo; o campo numerico de aulas por semana
// completa a forma do campo com os mesmos tokens.
const NUMBER_CLASS =
  "w-full min-h-[50px] rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pena)] px-4";

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
    <form action={formAction}>
      <div className="mt-4">
        <Field label="Nome" id="plano-nome">
          <input id="plano-nome" name="name" type="text" required />
        </Field>
        <Field label="Valor mensal (R$)" id="plano-valor">
          <input
            id="plano-valor"
            name="price"
            type="text"
            inputMode="decimal"
            required
            placeholder="Ex.: 180.00"
          />
        </Field>
        <Field label="Aulas por semana" id="plano-aulas">
          <input
            id="plano-aulas"
            name="weeklyFrequency"
            type="number"
            min={1}
            required
            className={NUMBER_CLASS}
          />
        </Field>
        <Field label="Descrição (opcional)" id="plano-descricao">
          <input id="plano-descricao" name="description" type="text" />
        </Field>
      </div>
      <Button type="submit" variant="prim" disabled={pending}>
        {pending ? "Criando…" : "Criar plano"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Edicao e inativacao de um plano, no proprio item da lista. */
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
    <div className="mt-3 space-y-4">
      <form action={editAction}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Nome" id={`plano-nome-${planId}`}>
            <input
              id={`plano-nome-${planId}`}
              name="name"
              type="text"
              defaultValue={name}
              required
            />
          </Field>
          <Field label="Valor mensal (R$)" id={`plano-valor-${planId}`}>
            <input
              id={`plano-valor-${planId}`}
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={price}
              required
            />
          </Field>
          <Field label="Aulas por semana" id={`plano-aulas-${planId}`}>
            <input
              id={`plano-aulas-${planId}`}
              name="weeklyFrequency"
              type="number"
              min={1}
              defaultValue={weeklyFrequency}
              required
              className={NUMBER_CLASS}
            />
          </Field>
          <Field label="Descrição" id={`plano-descricao-${planId}`}>
            <input
              id={`plano-descricao-${planId}`}
              name="description"
              type="text"
              defaultValue={description ?? ""}
            />
          </Field>
        </div>
        <Button type="submit" variant="sec" small disabled={editPending}>
          {editPending ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Feedback state={edited} />
      </form>

      {status === "ATIVO" ? (
        <form action={deactivateAction}>
          <Button
            type="submit"
            variant="sec"
            small
            disabled={deactivatePending}
          >
            {deactivatePending ? "Inativando…" : "Inativar plano"}
          </Button>
          <Feedback state={deactivated} />
        </form>
      ) : null}
    </div>
  );
}
