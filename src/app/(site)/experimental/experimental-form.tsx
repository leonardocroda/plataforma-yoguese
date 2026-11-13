"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { requestExperimentalAction } from "../../../modules/experimentals/actions";
import { isValidPhone, normalizePhone } from "../../../modules/experimentals/domain/phone";
import { weekdayOf } from "../../../modules/classes/domain/occurrences";
import { Button, Field } from "../../../modules/ui/components/kit";
import { VacancyDucks } from "../../../modules/ui/components/vacancy-ducks";

// Formulario publico da aula experimental (PRD 8.1, EXP-02, EXP-03,
// EXP-04, EXP-05, EXP-12, EXP-13). A tela mostra nome, telefone,
// modalidade, dia e horario, o valor e a declaracao antes do envio, e
// confirma o recebimento quando a solicitacao e criada. A pele e a do guia
// (tela "Agendar aula experimental"): a turma escolhida pinta o patinho da
// pessoa de pessego e o botao so libera com o pedido completo.

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

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Todo turma tem 8 vagas; a leitura publica so sabe quantas estao livres. */
const TURMA_VAGAS = 8;

/** Textos do guia (secao "Voz") para os dois erros que o visitante causa. */
const INCOMPLETE_PHONE =
  "Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678.";
const DUPLICATE_PHONE = "Já existe uma aula experimental para este telefone.";

// Opcao de turma (guia: `.opt`): superficie pena, borda de 2px e, quando a
// turma esta escolhida, borda preta com fundo pessego-claro. As duas classes
// sao inteiras para nao haver utilitario conflitante no mesmo elemento.
const OPTION_IDLE_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-[var(--linha)] bg-[var(--pena)] px-3.5 py-3 text-left hover:border-[var(--preto)]";
const OPTION_PRESSED_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-[var(--preto)] bg-[var(--pessego-claro)] px-3.5 py-3 text-left";

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatWhen(date: string, startTime: string): string {
  return `${WEEKDAYS[weekdayOf(date) - 1]}, ${startTime.slice(0, 5)}`;
}

/** Duas semanas com a mesma turma precisam de data para nao empatar. */
function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Ocupadas de uma turma na leitura publica: 8 vagas menos as livres. */
function occupied(availableSpots: number): number {
  return Math.max(0, TURMA_VAGAS - availableSpots);
}

/**
 * Mensagem do servidor na voz do guia: os dois erros que o visitante pode
 * causar tem texto fixo, o resto aparece em texto puro no token de erro.
 */
function fieldError(
  state: ActionState,
): { field: string; message: string } | null {
  if (state.ok || !state.message) return null;
  if (state.message.includes("aula experimental para este telefone")) {
    return { field: "phone", message: DUPLICATE_PHONE };
  }
  if (state.field === "phone") {
    return { field: "phone", message: INCOMPLETE_PHONE };
  }
  return { field: state.field || "form", message: state.message };
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
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);

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
        ? { ok: true, message: "", field: "" }
        : {
            ok: false,
            message: result.error,
            field: result.field ?? "",
          };
    },
    INITIAL_STATE,
  );

  const error = fieldError(state);
  const selected = options.find(
    (option) => `${option.classSlotId}|${option.date}` === chosen,
  );
  // O pedido completo: nome, telefone valido, declaracao e turma escolhida
  const complete =
    Boolean(selected) &&
    name.trim() !== "" &&
    isValidPhone(normalizePhone(phone)) &&
    accepted;
  // Telefone pela metade: o campo mostra a frase do guia no lugar da ajuda,
  // sem esperar o envio (o botao so libera com o telefone inteiro).
  const phoneError =
    error?.field === "phone"
      ? error.message
      : phone.trim() !== "" && !isValidPhone(normalizePhone(phone))
        ? INCOMPLETE_PHONE
        : undefined;

  if (options.length === 0) {
    return (
      <div className="grid grid-cols-[1fr_60px] items-center gap-3 rounded-[var(--r-md)] border-2 border-dashed border-[var(--grafite)] p-4 text-[15px]">
        <div>
          <b className="mb-1 block text-[20px] font-extrabold tracking-[-0.02em]">
            Nenhuma aula experimental com vaga no momento
          </b>
          Volte em breve: assim que uma nova data abrir, o envio volta a ficar
          disponível.
        </div>
        <Image
          src="/assets/pato.png"
          alt=""
          width={60}
          height={63}
          className="h-auto w-[60px]"
        />
      </div>
    );
  }

  if (state.ok) {
    return (
      <div
        className="mt-4 grid grid-cols-[1fr_74px] items-center gap-3.5 rounded-[var(--r-md)] bg-[var(--pessego)] p-[18px]"
        role="status"
      >
        <div>
          <h2 className="mb-1.5 text-[24px] tracking-[-0.03em]">
            Pedido enviado
          </h2>
          <p className="text-[15px]">
            A professora confirma e te avisa pelo telefone. Enquanto isso,
            respire fundo.
          </p>
        </div>
        <Image
          src="/assets/pato.png"
          alt=""
          width={74}
          height={78}
          className="h-auto w-[74px]"
        />
      </div>
    );
  }

  return (
    <>
      <p className="mb-[18px] text-[15px] text-[color:var(--cinza)]">
        Escolha uma turma com vaga.
      </p>

      <form action={formAction}>
        <input type="hidden" name="occurrence" value={chosen} />
        <input
          type="hidden"
          name="classTypeId"
          value={selected?.classTypeId ?? ""}
        />

        <div className="mb-[22px] grid gap-2">
          {options.map((option) => {
            const key = `${option.classSlotId}|${option.date}`;
            const pressed = key === chosen;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={pressed}
                onClick={() => setChosen(key)}
                className={pressed ? OPTION_PRESSED_CLASS : OPTION_IDLE_CLASS}
              >
                <span>
                  <b className="tnum block text-[18px] font-extrabold tracking-[-0.02em]">
                    {formatWhen(option.date, option.startTime)}
                    <span className="ml-2 align-middle text-[14px] font-semibold text-[color:var(--cinza)]">
                      {formatDay(option.date)}
                    </span>
                  </b>
                  <small className="text-[13.5px] text-[color:var(--cinza)]">
                    {option.classTypeName}
                  </small>
                </span>
                <VacancyDucks
                  fixed={occupied(option.availableSpots)}
                  own={pressed}
                  size="xs"
                />
              </button>
            );
          })}
        </div>

        <Field
          label="Seu nome"
          id="exp-nome"
          error={error?.field === "name" ? error.message : undefined}
        >
          <input
            id="exp-nome"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Telefone"
          id="exp-tel"
          help="A professora vai te avisar por aqui."
          error={phoneError}
        >
          <input
            id="exp-tel"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="11 91234-5678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <label className="check">
          <input
            type="checkbox"
            name="healthDeclaration"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>{declaration}</span>
        </label>

        {error && error.field === "healthDeclaration" ? (
          <p
            className="mb-3 text-[14.5px] font-medium text-[color:var(--erro)]"
            role="alert"
          >
            {error.message}
          </p>
        ) : null}

        <div className="mb-4 flex items-baseline justify-between border-t-2 border-t-[var(--preto)] py-3.5">
          <span className="text-[color:var(--cinza)]">Valor da aula</span>
          <b className="tnum text-[30px] font-extrabold tracking-[-0.03em]">
            {formatPrice(priceCents)}
          </b>
        </div>

        <Button type="submit" variant="prim" disabled={pending || !complete}>
          Pedir aula experimental
        </Button>

        {error && error.field === "form" ? (
          <p
            className="mt-2 text-[14.5px] font-medium text-[color:var(--erro)]"
            role="alert"
          >
            {error.message}
          </p>
        ) : null}
      </form>
    </>
  );
}