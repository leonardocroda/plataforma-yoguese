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
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

/**
 * O resultado de toda operacao da tela aparece em um unico lugar, fora das
 * listas: ao remover um registro a linha sai da lista no refresh, e o
 * feedback dentro dela desapareceria junto (FER-17, FER-21, FER-24, FER-25).
 * Sucesso na pilula preta do guia, falha em texto puro no token de erro.
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
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. As ocorrências
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
    <form action={formAction}>
      <div className="mt-4">
        <Field label="Data" id="feriado-data">
          <input id="feriado-data" type="date" name="date" required />
        </Field>
        <Field label="Nome" id="feriado-nome">
          <input
            id="feriado-nome"
            name="name"
            type="text"
            required
            placeholder="Ex.: Natal"
          />
        </Field>
      </div>
      <Button type="submit" variant="prim" small disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar feriado"}
      </Button>
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
    const message = "Feriado removido e ocorrências desbloqueadas.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  useEffect(() => {
    if (updated.ok || removed.ok) router.refresh();
  }, [updated.ok, removed.ok, router]);

  return (
    <div className="mt-3 space-y-4">
      <form action={updateAction}>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Data" id={`feriado-data-${holiday.id}`}>
            <input
              id={`feriado-data-${holiday.id}`}
              type="date"
              name="date"
              defaultValue={holiday.date}
              required
            />
          </Field>
          <Field label="Nome" id={`feriado-nome-${holiday.id}`}>
            <input
              id={`feriado-nome-${holiday.id}`}
              name="name"
              type="text"
              defaultValue={holiday.name}
              required
            />
          </Field>
        </div>
        <Button type="submit" variant="sec" small disabled={updatePending}>
          {updatePending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
      <form action={removeAction}>
        <Button type="submit" variant="sec" small disabled={removePending}>
          {removePending ? "Removendo…" : "Remover feriado"}
        </Button>
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
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. As ocorrências
      do período ficam bloqueadas e as reservas ativas foram canceladas.`;
      showFeedback(true, message);
      return { ok: true, message };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <div className="mt-4">
        <Field label="Início" id="recesso-inicio">
          <input
            id="recesso-inicio"
            type="date"
            name="startDate"
            required
          />
        </Field>
        <Field label="Fim" id="recesso-fim">
          <input id="recesso-fim" type="date" name="endDate" required />
        </Field>
        <Field label="Motivo" id="recesso-motivo">
          <input
            id="recesso-motivo"
            name="reason"
            type="text"
            required
            placeholder="Ex.: recesso de fim de ano"
          />
        </Field>
      </div>
      <Button type="submit" variant="prim" small disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar recesso"}
      </Button>
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
    const message = "Recesso removido e ocorrências desbloqueadas.";
    showFeedback(true, message);
    return { ok: true, message };
  }, INITIAL_STATE);

  useEffect(() => {
    if (updated.ok || removed.ok) router.refresh();
  }, [updated.ok, removed.ok, router]);

  return (
    <div className="mt-3 space-y-4">
      <form action={updateAction}>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Início" id={`recesso-inicio-${closure.id}`}>
            <input
              id={`recesso-inicio-${closure.id}`}
              type="date"
              name="startDate"
              defaultValue={closure.startDate}
              required
            />
          </Field>
          <Field label="Fim" id={`recesso-fim-${closure.id}`}>
            <input
              id={`recesso-fim-${closure.id}`}
              type="date"
              name="endDate"
              defaultValue={closure.endDate}
              required
            />
          </Field>
          <Field label="Motivo" id={`recesso-motivo-${closure.id}`}>
            <input
              id={`recesso-motivo-${closure.id}`}
              name="reason"
              type="text"
              defaultValue={closure.reason}
              required
            />
          </Field>
        </div>
        <Button type="submit" variant="sec" small disabled={updatePending}>
          {updatePending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
      <form action={removeAction}>
        <Button type="submit" variant="sec" small disabled={removePending}>
          {removePending ? "Removendo…" : "Remover recesso"}
        </Button>
      </form>
    </div>
  );
}
