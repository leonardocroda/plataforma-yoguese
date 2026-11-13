"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createStudentAction,
  setStudentStatusAction,
  updateStudentAction,
} from "../../../modules/students/actions";
import { Button, Field, Toast } from "../../../modules/ui/components/kit";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

export type PlanOption = {
  id: string;
  name: string;
};

// Os 4 status do PRD 4.4 (STUD-03)
const STATUS_OPTIONS = [
  { value: "EXPERIMENTAL", label: "Experimental" },
  { value: "AGUARDANDO_MATRICULA", label: "Aguardando matrícula" },
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
];

export type StudentFormData = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  enrollmentDate: string;
  planId: string | null;
  status: "EXPERIMENTAL" | "AGUARDANDO_MATRICULA" | "ATIVO" | "INATIVO";
  notes: string | null;
};

function planIdOrNull(formData: FormData): string | null {
  const value = String(formData.get("planId") ?? "");
  return value === "" ? null : value;
}

function formDataOf(
  formData: FormData,
): Omit<Parameters<typeof createStudentAction>[0], never> {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    enrollmentDate: String(formData.get("enrollmentDate") ?? "") || undefined,
    planId: planIdOrNull(formData),
    status: String(formData.get("status") ?? "") as StudentFormData["status"],
    notes: String(formData.get("notes") ?? "") || null,
  };
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

function StudentFields({
  plans,
  student,
}: {
  plans: PlanOption[];
  student?: StudentFormData;
}) {
  return (
    <>
      <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
        <Field label="Nome" id="aluno-nome">
          <input
            id="aluno-nome"
            name="name"
            type="text"
            required
            defaultValue={student?.name}
          />
        </Field>
        <Field label="Telefone" id="aluno-telefone">
          <input
            id="aluno-telefone"
            name="phone"
            type="tel"
            required
            defaultValue={student?.phone}
            placeholder="Ex.: 11999990000"
          />
        </Field>
        <Field label="E-mail" id="aluno-email">
          <input
            id="aluno-email"
            name="email"
            type="email"
            required
            defaultValue={student?.email}
          />
        </Field>
        <Field label="Data de nascimento" id="aluno-nascimento">
          <input
            id="aluno-nascimento"
            name="birthDate"
            type="date"
            required
            defaultValue={student?.birthDate}
          />
        </Field>
        <Field label="Data de matrícula" id="aluno-matricula">
          <input
            id="aluno-matricula"
            name="enrollmentDate"
            type="date"
            defaultValue={student?.enrollmentDate}
          />
        </Field>
        <Field label="Status" id="aluno-status">
          <select
            id="aluno-status"
            name="status"
            required
            defaultValue={student?.status ?? "EXPERIMENTAL"}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Plano (obrigatório quando o status é Ativo)"
        id="aluno-plano"
      >
        <select
          id="aluno-plano"
          name="planId"
          defaultValue={student?.planId ?? ""}
        >
          <option value="">Sem plano</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Observações" id="aluno-observacoes">
        <input
          id="aluno-observacoes"
          name="notes"
          type="text"
          defaultValue={student?.notes ?? ""}
        />
      </Field>
    </>
  );
}

/** Cadastro de nova aluna (STUD-01): o feedback aparece no formulario. */
export function CreateStudentForm({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await createStudentAction(formDataOf(formData));
      return result.ok
        ? { ok: true, message: `Aluna "${result.value.name}" cadastrada.` }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <StudentFields plans={plans} />
      <Button type="submit" variant="prim" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar aluna"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Edicao da aluna selecionada (?editar=<id>). */
export function EditStudentForm({
  student,
  plans,
}: {
  student: StudentFormData;
  plans: PlanOption[];
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await updateStudentAction({
        studentId: student.id,
        ...formDataOf(formData),
      });
      return result.ok
        ? { ok: true, message: "Cadastro atualizado." }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <StudentFields plans={plans} student={student} />
      <Button type="submit" variant="prim" disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Inativar ou reativar direto da listagem (STUD-06, STUD-07). */
export function StudentStatusButton({
  studentId,
  status,
}: {
  studentId: string;
  status: StudentFormData["status"];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      const result = await setStudentStatusAction({
        studentId,
        status: status === "ATIVO" ? "INATIVO" : "ATIVO",
      });
      return result.ok
        ? { ok: true, message: "Status atualizado." }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending
          ? "Atualizando…"
          : status === "ATIVO"
            ? "Inativar"
            : "Reativar"}
      </Button>
      {state.message && !state.ok ? (
        <p
          role="alert"
          className="mt-1 text-[13px] font-medium text-[color:var(--erro)]"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
