"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createStudentAction,
  setStudentStatusAction,
  updateStudentAction,
} from "../../../modules/students/actions";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

export type PlanOption = {
  id: string;
  name: string;
};

// Os 4 status do PRD 4.4 (STUD-03)
const STATUS_OPTIONS = [
  { value: "EXPERIMENTAL", label: "Experimental" },
  { value: "AGUARDANDO_MATRICULA", label: "Aguardando matrícula" },
  { value: "ATIVO", label: "Ativa" },
  { value: "INATIVO", label: "Inativa" },
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

function StudentFields({
  plans,
  student,
}: {
  plans: PlanOption[];
  student?: StudentFormData;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium">
          Nome
          <input
            name="name"
            required
            defaultValue={student?.name}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Telefone
          <input
            name="phone"
            required
            defaultValue={student?.phone}
            className={inputClass}
            placeholder="Ex.: 11999990000"
          />
        </label>
        <label className="block text-xs font-medium">
          E-mail
          <input
            name="email"
            type="email"
            required
            defaultValue={student?.email}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Data de nascimento
          <input
            name="birthDate"
            type="date"
            required
            defaultValue={student?.birthDate}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Data de matrícula
          <input
            name="enrollmentDate"
            type="date"
            defaultValue={student?.enrollmentDate}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Status
          <select
            name="status"
            required
            defaultValue={student?.status ?? "EXPERIMENTAL"}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium">
        Plano (obrigatório para aluna Ativa)
        <select
          name="planId"
          defaultValue={student?.planId ?? ""}
          className={inputClass}
        >
          <option value="">Sem plano</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium">
        Observações
        <input
          name="notes"
          defaultValue={student?.notes ?? ""}
          className={inputClass}
        />
      </label>
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
    <form action={formAction} className="space-y-2">
      <StudentFields plans={plans} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Cadastrando..." : "Cadastrar aluna"}
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
    <form action={formAction} className="space-y-2">
      <StudentFields plans={plans} student={student} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Salvando..." : "Salvar alterações"}
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
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-[var(--yoguese-bege)] px-2 py-0.5 text-xs hover:bg-[var(--yoguese-off-white)]"
      >
        {pending
          ? "Atualizando..."
          : status === "ATIVO"
            ? "Inativar"
            : "Reativar"}
      </button>
      {state.message && !state.ok ? (
        <p className="mt-1 text-xs text-red-700">{state.message}</p>
      ) : null}
    </form>
  );
}
