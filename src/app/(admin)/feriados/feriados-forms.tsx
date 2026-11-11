"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createHolidayAction,
  createStudioClosureAction,
  deleteHolidayAction,
  deleteStudioClosureAction,
  updateHolidayAction,
  updateStudioClosureAction,
} from "../../../modules/classes/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1 text-xs text-red-700 disabled:opacity-60";

/**
 * O resultado de toda operacao da tela aparece em um unico lugar, fora das
 * listas: ao remover um registro a linha sai da lista no refresh, e o
 * feedback dentro dela desapareceria junto (FER-17, FER-21, FER-24, FER-25).
 */
const FEEDBACK_EVENT = "feriados:feedback";

function showFeedback(ok: boolean, message: string) {
  window.dispatchEvent(
    new CustomEvent(FEEDBACK_EVENT, { detail: { ok, message } }),
  );
}

export function FeedbackHost() {
  const [state, setState] = useState<ActionState>(INITIAL_STATE);

  useEffect(() => {
    function onFeedback(event: Event) {
      setState((event as CustomEvent<ActionState>).detail);
    }
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, []);

  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.ok
          ? "text-xs text-[var(--yoguese-cinza)]"
          : "text-xs text-red-700"
      }
    >
      {state.message}
    </p>
  );
}

type Holiday = { id: string; date: string; name: string };

type Closure = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
};

/**
 * Formularios de feriados e recessos (FER-17, FER-21, FER-24, FER-25):
 * cadastro, edicao e remocao, cada operacao apresentando o resultado
 * devolvido pela action - sucesso com o efeito aplicado ou o erro do
 * servico (data duplicada, fim antes do inicio).
 */
export function CreateHolidayForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await createHolidayAction({
        date: String(formData.get("date") ?? ""),
        name: String(formData.get("name") ?? ""),
      });
      if (!result.ok) {
        showFeedback(false, result.error);
        return INITIAL_STATE;
      }
      const message = `Feriado cadastrado para ${new Date(
        `${result.value.date}T12:00:00Z`,
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. As ocorrencias
      da data ficam bloqueadas e as reservas ativas foram canceladas.`;
      showFeedback(true, message);
      return { ok: true, message };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-2">
      <label className="block text-xs font-medium">
        Data
        <input type="date" name="date" required className={inputClass} />
      </label>
      <label className="block text-xs font-medium">
        Nome
        <input
          name="name"
          required
          className={inputClass}
          placeholder="Ex.: Natal"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Cadastrando..." : "Cadastrar feriado"}
      </button>
    </form>
  );
}

export function HolidayRowForms({ holiday }: { holiday: Holiday }) {
  const router = useRouter();

  const [updated, updateAction, updatePending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await updateHolidayAction({
      id: holiday.id,
      date: String(formData.get("date") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    if (!result.ok) {
      showFeedback(false, result.error);
      return INITIAL_STATE;
    }
    const message = "Feriado atualizado e bloqueios reprocessados.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  const [removed, removeAction, removePending] = useActionState<
    ActionState,
    FormData
  >(async () => {
    const result = await deleteHolidayAction(holiday.id);
    if (!result.ok) {
      showFeedback(false, result.error);
      return INITIAL_STATE;
    }
    const message = "Feriado removido e ocorrencias desbloqueadas.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  useEffect(() => {
    if (updated.ok || removed.ok) router.refresh();
  }, [updated.ok, removed.ok, router]);

  return (
    <div className="mt-2 space-y-2">
      <form action={updateAction} className="grid gap-2 md:grid-cols-3">
        <label className="block text-xs font-medium">
          Data
          <input
            type="date"
            name="date"
            defaultValue={holiday.date}
            required
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Nome
          <input
            name="name"
            defaultValue={holiday.name}
            required
            className={inputClass}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={updatePending} className={buttonClass}>
            {updatePending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
      <form action={removeAction}>
        <button type="submit" disabled={removePending} className={dangerButtonClass}>
          {removePending ? "Removendo..." : "Remover feriado"}
        </button>
      </form>
    </div>
  );
}

export function CreateClosureForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await createStudioClosureAction({
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
      if (!result.ok) {
        showFeedback(false, result.error);
        return INITIAL_STATE;
      }
      const message = `Recesso cadastrado de ${new Date(
        `${result.value.startDate}T12:00:00Z`,
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${new Date(
        `${result.value.endDate}T12:00:00Z`,
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. As ocorrencias
      do periodo ficam bloqueadas e as reservas ativas foram canceladas.`;
      showFeedback(true, message);
      return { ok: true, message };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-2">
      <label className="block text-xs font-medium">
        Início
        <input type="date" name="startDate" required className={inputClass} />
      </label>
      <label className="block text-xs font-medium">
        Fim
        <input type="date" name="endDate" required className={inputClass} />
      </label>
      <label className="block text-xs font-medium">
        Motivo
        <input
          name="reason"
          required
          className={inputClass}
          placeholder="Ex.: Recesso de fim de ano"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Cadastrando..." : "Cadastrar recesso"}
      </button>
    </form>
  );
}

export function ClosureRowForms({ closure }: { closure: Closure }) {
  const router = useRouter();

  const [updated, updateAction, updatePending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await updateStudioClosureAction({
      id: closure.id,
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) {
      showFeedback(false, result.error);
      return INITIAL_STATE;
    }
    const message = "Recesso atualizado e bloqueios reprocessados.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  const [removed, removeAction, removePending] = useActionState<
    ActionState,
    FormData
  >(async () => {
    const result = await deleteStudioClosureAction(closure.id);
    if (!result.ok) {
      showFeedback(false, result.error);
      return INITIAL_STATE;
    }
    const message = "Recesso removido e ocorrencias desbloqueadas.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  useEffect(() => {
    if (updated.ok || removed.ok) router.refresh();
  }, [updated.ok, removed.ok, router]);

  return (
    <div className="mt-2 space-y-2">
      <form action={updateAction} className="grid gap-2 md:grid-cols-4">
        <label className="block text-xs font-medium">
          Início
          <input
            type="date"
            name="startDate"
            defaultValue={closure.startDate}
            required
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Fim
          <input
            type="date"
            name="endDate"
            defaultValue={closure.endDate}
            required
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Motivo
          <input
            name="reason"
            defaultValue={closure.reason}
            required
            className={inputClass}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={updatePending} className={buttonClass}>
            {updatePending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
      <form action={removeAction}>
        <button type="submit" disabled={removePending} className={dangerButtonClass}>
          {removePending ? "Removendo..." : "Remover recesso"}
        </button>
      </form>
    </div>
  );
}
