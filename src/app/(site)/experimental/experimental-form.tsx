"use client";

import { useActionState, useMemo, useState } from "react";
import { requestExperimentalAction } from "../../../modules/experimentals/actions";

// Formulario publico da aula experimental (PRD 8.1, EXP-02, EXP-03,
// EXP-04, EXP-05, EXP-12, EXP-13). A tela mostra nome, telefone,
// modalidade, dia e horario, o valor e a declaracao antes do envio, e
// confirma o recebimento quando a solicitacao e criada.

export type OccurrenceOptionView = {
  classTypeId: string;
  classTypeName: string;
  classSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  availableSpots: number;
};

type ActionState = {
  ok: boolean;
  message: string;
  field: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "", field: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-sm text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-4 py-2 text-sm text-white disabled:opacity-60";

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function ExperimentalRequestForm({
  options,
  declaration,
  priceCents,
}: {
  options: OccurrenceOptionView[];
  declaration: string;
  priceCents: number;
}) {
  const [classTypeId, setClassTypeId] = useState(
    options[0]?.classTypeId ?? "",
  );
  const [occurrence, setOccurrence] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const [classSlotId, date] = String(formData.get("occurrence") ?? "")
        .split("|");
      const result = await requestExperimentalAction({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        classTypeId: String(formData.get("classTypeId") ?? ""),
        classSlotId: classSlotId ?? "",
        date: date ?? "",
        declarationAccepted: formData.get("healthDeclaration") === "on",
      });
      return result.ok
        ? {
            ok: true,
            message:
              "Solicitação recebida! Sua aula experimental está aguardando aprovação. O estúdio entrará em contato via WhatsApp.",
            field: "",
          }
        : {
            ok: false,
            message: result.error,
            field: result.field ?? "",
          };
    },
    INITIAL_STATE,
  );

  const classTypes = useMemo(() => {
    const unique = new Map<string, string>();
    for (const option of options) {
      unique.set(option.classTypeId, option.classTypeName);
    }
    return [...unique.entries()];
  }, [options]);

  const byModality = options.filter(
    (option) => option.classTypeId === classTypeId,
  );
  const hasOptions = byModality.length > 0;

  if (options.length === 0) {
    return (
      <section className="mt-6 max-w-xl rounded border border-[var(--yoguese-bege)] bg-white p-4">
        <h2 className="text-sm font-medium text-[var(--yoguese-cinza)]">
          Nenhuma aula experimental com vaga no momento
        </h2>
        <p className="mt-2 text-xs text-[#8a8a8a]">
          Volte em breve: assim que uma nova data abrir, o envio volta a
          ficar disponível.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 max-w-xl rounded border border-[var(--yoguese-bege)] bg-white p-4">
      <p className="text-sm text-[var(--yoguese-cinza)]">
        Aula experimental: <strong>{formatPrice(priceCents)}</strong>
      </p>

      {state.ok ? (
        <p className="mt-4 rounded border border-[var(--yoguese-salvia)] bg-[var(--yoguese-off-white)] p-3 text-sm text-[var(--yoguese-cinza)]">
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <label className="block text-xs font-medium">
            Nome completo
            <input
              name="name"
              required
              className={inputClass}
              placeholder="Como podemos te chamar"
            />
          </label>

          <label className="block text-xs font-medium">
            Telefone (WhatsApp)
            <input
              name="phone"
              required
              className={inputClass}
              placeholder="Ex.: (11) 99999-0000"
            />
          </label>

          <label className="block text-xs font-medium">
            Modalidade
            <select
              name="classTypeId"
              className={inputClass}
              value={classTypeId}
              onChange={(event) => {
                setClassTypeId(event.target.value);
                setOccurrence("");
              }}
            >
              {classTypes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium">
            Dia e horário
            <select
              name="occurrence"
              required
              className={inputClass}
              value={occurrence}
              onChange={(event) => setOccurrence(event.target.value)}
              disabled={!hasOptions}
            >
              <option value="">Selecione a data e o horário</option>
              {byModality.map((option) => (
                <option
                  key={`${option.classSlotId}-${option.date}`}
                  value={`${option.classSlotId}|${option.date}`}
                >
                  {formatDate(option.date)} - {formatTime(option.startTime)} (
                  {option.availableSpots}{" "}
                  {option.availableSpots === 1 ? "vaga" : "vagas"})
                </option>
              ))}
            </select>
          </label>

          {!hasOptions ? (
            <p className="text-xs text-[#8a8a8a]">
              Sem vagas nesta modalidade no momento.
            </p>
          ) : null}

          <label className="block text-xs font-medium">
            <input
              type="checkbox"
              name="healthDeclaration"
              required
              className="mr-2"
            />
            {declaration}
          </label>

          <button
            type="submit"
            disabled={pending || !hasOptions || occurrence === ""}
            className={buttonClass}
          >
            {pending ? "Enviando..." : "Solicitar aula experimental"}
          </button>

          {state.message ? (
            <p className="text-xs text-red-700">{state.message}</p>
          ) : null}
        </form>
      )}
    </section>
  );
}
