"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  approveExperimentalAction,
  cancelExperimentalAction,
  changeExperimentalOccurrenceAction,
  refuseExperimentalAction,
  registerNoShowAction,
  registerPaymentAction,
  registerWhatsAppContactAction,
  rescheduleExperimentalAction,
} from "../../../../modules/experimentals/actions";
import {
  PAYMENT_STATUS_LABELS,
  type ExperimentalPaymentStatus,
  type ExperimentalStatus,
} from "../../../../modules/experimentals/domain/validators";

// Formularios de acao do detalhe da experimental (EXP-24, EXP-29, EXP-31,
// EXP-32, EXP-33, EXP-49). Cada acao mostra o resultado sem perder a tela
// e as acoes destrutivas pedem confirmacao antes de aplicar.

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

/** Opcao de ocorrencia futura com vaga, oferecida na troca e no reagendamento. */
export type OccurrenceChoice = {
  classSlotId: string;
  date: string;
  label: string;
};

function Message({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-xs" : "text-xs text-red-700"}>
      {state.message}
    </p>
  );
}

/**
 * Confirma a acao destrutiva antes de aplicar. Devolve false quando o
 * admin desiste - nesse caso o envio e cancelado.
 */
export function confirmAction(message: string): boolean {
  return typeof window === "undefined" ? true : window.confirm(message);
}

/**
 * Formulario de uma acao que nao muda a ocorrencia: aprovar, recusar,
 * cancelar, registrar falta, pagamento e contato via WhatsApp.
 */
function SimpleActionForm({
  label,
  pendingLabel,
  confirmMessage,
  run,
}: {
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
  run: () => Promise<{ ok: boolean; error?: string } | { ok: true }>;
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      const result = await run();
      if (!result.ok) return { ok: false, message: result.error ?? "erro" };
      return { ok: true, message: `${label} concluído.` };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !confirmAction(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="space-y-1"
    >
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? pendingLabel : label}
      </button>
      <Message state={state} />
    </form>
  );
}

/** A ocorrencia escolhida no formulario: turma e data. */
type OccurrenceSelection = { classSlotId: string; date: string };

/** Troca de data/horario e reagendamento: os dois escolhem uma ocorrencia. */
function OccurrenceActionForm({
  label,
  pendingLabel,
  occurrences,
  run,
}: {
  label: string;
  pendingLabel: string;
  occurrences: OccurrenceChoice[];
  run: (choice: OccurrenceSelection) => Promise<
    { ok: boolean; error?: string } | { ok: true }
  >;
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const value = String(formData.get("occurrence") ?? "");
      const [classSlotId, date] = value.split("|");
      if (!classSlotId || !date) {
        return { ok: false, message: "Escolha a nova data e horário." };
      }
      const result = await run({ classSlotId, date });
      if (!result.ok) return { ok: false, message: result.error ?? "erro" };
      return { ok: true, message: `${label} concluído.` };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-1">
      <label className="block text-xs font-medium">
        Nova data e horário
        <select name="occurrence" className={inputClass} required>
          <option value="">Selecione a data e o horário</option>
          {occurrences.map((option) => (
            <option
              key={`${option.classSlotId}-${option.date}`}
              value={`${option.classSlotId}|${option.date}`}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? pendingLabel : label}
      </button>
      <Message state={state} />
    </form>
  );
}

/** Pagamento: um dos quatro status do PRD 8.4, com os termos exatos. */
function PaymentForm({
  experimentalId,
  current,
}: {
  experimentalId: string;
  current: ExperimentalPaymentStatus;
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await registerPaymentAction({
        experimentalId,
        paymentStatus: String(formData.get("paymentStatus") ?? ""),
      });
      if (!result.ok) return { ok: false, message: result.error };
      return { ok: true, message: "Pagamento registrado." };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-1">
      <label className="block text-xs font-medium">
        Pagamento
        <select
          name="paymentStatus"
          className={inputClass}
          defaultValue={current}
        >
          {(Object.keys(PAYMENT_STATUS_LABELS) as ExperimentalPaymentStatus[]).map(
            (status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ),
          )}
        </select>
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Registrando..." : "Registrar pagamento"}
      </button>
      <Message state={state} />
    </form>
  );
}

/**
 * Bloco de acoes do detalhe. O status decide o que o admin ainda pode
 * fazer; a tentativa duplicada aparece somente leitura (EXP-49).
 */
export function ExperimentalActions({
  experimentalId,
  status,
  paymentStatus,
  cancelLosesRight,
  occurrences,
}: {
  experimentalId: string;
  status: ExperimentalStatus;
  paymentStatus: ExperimentalPaymentStatus;
  /** O cancelamento encerra o direito ao reagendamento (menos de 24h). */
  cancelLosesRight: boolean;
  occurrences: OccurrenceChoice[];
}) {
  if (status === "DUPLICADA") {
    return (
      <div className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs">
        <h2 className="text-sm font-medium">Tentativa duplicada</h2>
        <p className="mt-2 opacity-70">
          Esta tentativa foi bloqueada pelo telefone e é somente leitura: não
          há ação a aplicar.
        </p>
      </div>
    );
  }

  const viva = status === "PENDENTE" || status === "APROVADA";
  const reagendavel = status === "CANCELADA_COM_DIREITO";

  return (
    <div className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs">
      <h2 className="text-sm font-medium">Ações</h2>

      <div className="mt-2 space-y-3">
        {status === "PENDENTE" ? (
          <SimpleActionForm
            label="Aprovar"
            pendingLabel="Aprovando..."
            run={() => approveExperimentalAction({ experimentalId })}
          />
        ) : null}

        {viva ? (
          <SimpleActionForm
            label="Recusar"
            pendingLabel="Recusando..."
            confirmMessage="Recusar esta solicitação? O telefone volta a ficar livre para uma nova solicitação."
            run={() => refuseExperimentalAction({ experimentalId })}
          />
        ) : null}

        {viva ? (
          <OccurrenceActionForm
            label="Trocar data e horário"
            pendingLabel="Trocando..."
            occurrences={occurrences}
            run={(choice) =>
              changeExperimentalOccurrenceAction({
                experimentalId,
                classSlotId: choice.classSlotId,
                date: choice.date,
              })
            }
          />
        ) : null}

        {reagendavel ? (
          <OccurrenceActionForm
            label="Reagendar"
            pendingLabel="Reagendando..."
            occurrences={occurrences}
            run={(choice) =>
              rescheduleExperimentalAction({
                experimentalId,
                classSlotId: choice.classSlotId,
                date: choice.date,
              })
            }
          />
        ) : null}

        {viva ? (
          <SimpleActionForm
            label="Cancelar"
            pendingLabel="Cancelando..."
            confirmMessage={
              cancelLosesRight
                ? "Cancelar esta solicitação? O direito ao reagendamento acaba."
                : "Cancelar esta solicitação? O direito ao reagendamento é mantido."
            }
            run={() => cancelExperimentalAction({ experimentalId })}
          />
        ) : null}

        {viva ? (
          <SimpleActionForm
            label="Registrar falta"
            pendingLabel="Registrando..."
            confirmMessage="Registrar falta nesta experimental? A vaga é liberada e o direito ao reagendamento acaba."
            run={() => registerNoShowAction({ experimentalId })}
          />
        ) : null}

        <PaymentForm experimentalId={experimentalId} current={paymentStatus} />

        <SimpleActionForm
          label="Registrar contato via WhatsApp"
          pendingLabel="Registrando..."
          run={() => registerWhatsAppContactAction({ experimentalId })}
        />
      </div>
    </div>
  );
}
