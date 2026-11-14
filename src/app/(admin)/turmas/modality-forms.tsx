"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createClassTypeAction,
  updateClassTypeAction,
} from "../../../modules/classes/actions";
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
  field?: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

/** Sucesso na pilula preta do guia; falha em texto puro no token de erro. */
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
 * Cadastro de modalidade (TURM-03): nome da modalidade. O erro do servidor
 * aparece no proprio campo.
 */
export function CreateModalityForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await createClassTypeAction({
        name: String(formData.get("name") ?? ""),
      });
      return result.ok
        ? { ok: true, message: `Modalidade "${result.value.name}" criada.` }
        : { ok: false, message: result.error, field: result.field };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const fieldError = !state.ok && state.field === "name" ? state.message : "";
  const generalError = !state.ok && !state.field ? state.message : "";

  return (
    <form action={formAction}>
      <div className="mt-4">
        <Field label="Nome da modalidade" id="modalidade-nome" error={fieldError}>
          <input
            id="modalidade-nome"
            name="name"
            type="text"
            required
            placeholder="Ex.: Superioga Clássico"
          />
        </Field>
      </div>
      <Button type="submit" variant="prim" disabled={pending}>
        {pending ? "Criando…" : "Criar modalidade"}
      </Button>
      <Feedback ok={state.ok} message={state.ok ? state.message : generalError} />
    </form>
  );
}

/**
 * Edicao de uma modalidade (TURM-05): nome e status. O campo status e a
 * desativacao - a modalidade inativa deixa de aparecer nos formularios de
 * turma (TURM-06).
 */
export function ModalityCardForms({
  classTypeId,
  name,
  status,
}: {
  classTypeId: string;
  name: string;
  status: "ATIVA" | "INATIVA";
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await updateClassTypeAction(classTypeId, {
        name: String(formData.get("name") ?? ""),
        status: formData.get("status") === "INATIVA" ? "INATIVA" : "ATIVA",
      });
      return result.ok
        ? { ok: true, message: "Modalidade atualizada." }
        : { ok: false, message: result.error, field: result.field };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const fieldError = !state.ok && state.field === "name" ? state.message : "";
  const generalError = !state.ok && !state.field ? state.message : "";

  return (
    <form action={formAction} className="mt-3 space-y-4">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Nome" id={`modalidade-nome-${classTypeId}`} error={fieldError}>
          <input
            id={`modalidade-nome-${classTypeId}`}
            name="name"
            type="text"
            defaultValue={name}
            required
          />
        </Field>
        <Field label="Status" id={`modalidade-status-${classTypeId}`}>
          <select
            id={`modalidade-status-${classTypeId}`}
            name="status"
            defaultValue={status}
          >
            <option value="ATIVA">Ativa</option>
            <option value="INATIVA">Inativa</option>
          </select>
        </Field>
      </div>
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
      <Feedback ok={state.ok} message={state.ok ? state.message : generalError} />
    </form>
  );
}
