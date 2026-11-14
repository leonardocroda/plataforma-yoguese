"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSlotAction } from "../../../modules/classes/actions";
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

/**
 * O servidor nomeia o campo invalido em cada erro e separa os erros por
 * "; " (validators.ts). A tela mostra cada um no seu campo.
 */
function fieldError(message: string, field: string): string {
  const part = message
    .split("; ")
    .find((piece) => piece.startsWith(`${field}:`));
  return part ? part.slice(field.length + 1).trim() : "";
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
 * Cadastro de turma (TURM-08 a TURM-11): modalidade, dia da semana, horarios
 * e capacidade. Sem capacidade informada a turma nasce com 8 (RES-02); o
 * servidor recusa dado invalido nomeando o campo.
 */
export function CreateClassForm({
  classTypes,
}: {
  classTypes: { id: string; name: string }[];
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const capacity = String(formData.get("capacity") ?? "").trim();
      const result = await createSlotAction({
        classTypeId: String(formData.get("classTypeId") ?? ""),
        weekday: Number(formData.get("weekday") ?? 0),
        startTime: String(formData.get("startTime") ?? ""),
        endTime: String(formData.get("endTime") ?? ""),
        // Sem capacidade: o servidor grava 8 (RES-02)
        capacity: capacity === "" ? undefined : Number(capacity),
      });
      return result.ok
        ? { ok: true, message: "Turma criada." }
        : { ok: false, message: result.error };
    },
    INITIAL_STATE,
  );

  // O refresh depende do estado inteiro: com so `state.ok` no array, a
  // segunda operacao bem-sucedida nao atualizava a listagem.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const error = state.ok ? "" : state.message;
  const namedFields = [
    "classTypeId",
    "weekday",
    "startTime",
    "endTime",
    "capacity",
  ];
  const generalError = namedFields.some((field) => fieldError(error, field))
    ? ""
    : error;

  return (
    <form action={formAction}>
      <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
        <Field
          label="Modalidade"
          id="turma-modalidade"
          error={fieldError(error, "classTypeId")}
        >
          <select
            id="turma-modalidade"
            name="classTypeId"
            required
            disabled={classTypes.length === 0}
          >
            {classTypes.length === 0 ? (
              <option value="">Nenhuma modalidade ativa</option>
            ) : (
              classTypes.map((classType) => (
                <option key={classType.id} value={classType.id}>
                  {classType.name}
                </option>
              ))
            )}
          </select>
        </Field>

        <Field label="Dia da semana" id="turma-dia" error={fieldError(error, "weekday")}>
          <select id="turma-dia" name="weekday" required>
            {WEEKDAYS.map((weekday) => (
              <option key={weekday.value} value={weekday.value}>
                {weekday.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Horário de início" id="turma-inicio" error={fieldError(error, "startTime")}>
          <input id="turma-inicio" name="startTime" type="time" required />
        </Field>

        <Field label="Horário de término" id="turma-fim" error={fieldError(error, "endTime")}>
          <input id="turma-fim" name="endTime" type="time" required />
        </Field>

        <Field
          label="Capacidade (opcional)"
          id="turma-capacidade"
          error={fieldError(error, "capacity")}
          help="Sem capacidade, a turma fica com 8 vagas."
        >
          <input
            id="turma-capacidade"
            name="capacity"
            type="number"
            min={1}
            placeholder="8"
            className={NUMBER_CLASS}
          />
        </Field>
      </div>

      <Button type="submit" variant="prim" disabled={pending || classTypes.length === 0}>
        {pending ? "Criando…" : "Criar turma"}
      </Button>
      <Feedback ok={state.ok} message={state.ok ? state.message : generalError} />
    </form>
  );
}
