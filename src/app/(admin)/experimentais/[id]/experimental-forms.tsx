"use client";

import {
  useActionState,
  useEffect,
  useId,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  approveExperimentalAction,
  cancelExperimentalAction,
  changeExperimentalOccurrenceAction,
  convertExperimentalAction,
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
import { Button, Field, Toast } from "../../../../modules/ui/components/kit";

// Formularios de acao do detalhe da experimental (EXP-24, EXP-29, EXP-31,
// EXP-32, EXP-33, EXP-49). Cada acao mostra o resultado sem perder a tela
// e as acoes destrutivas pedem confirmacao antes de aplicar.

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

const sectionClass = "border-t-2 border-t-[var(--preto)] pt-4";
const headingClass = "mb-2 text-[22px]";
const dividerClass =
  "border-t border-t-[var(--linha)] pt-4 first:border-t-0 first:pt-0";

/** Cada acao ocupa um bloco separado pelo divisor do guia. */
function Block({ children }: { children: ReactNode }) {
  return <div className={dividerClass}>{children}</div>;
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

/** Opcao de ocorrencia futura com vaga, oferecida na troca e no reagendamento. */
export type OccurrenceChoice = {
  classSlotId: string;
  date: string;
  label: string;
};

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
      if (!result.ok) {
        return {
          ok: false,
          message: result.error ?? "Não foi possível concluir a ação. Tente de novo.",
        };
      }
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
    >
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <Feedback state={state} />
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
  const fieldId = useId();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const value = String(formData.get("occurrence") ?? "");
      const [classSlotId, date] = value.split("|");
      if (!classSlotId || !date) {
        return { ok: false, message: "Escolha a nova data e horário." };
      }
      const result = await run({ classSlotId, date });
      if (!result.ok) {
        return {
          ok: false,
          message: result.error ?? "Não foi possível concluir a ação. Tente de novo.",
        };
      }
      return { ok: true, message: `${label} concluído.` };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <Field label="Nova data e horário" id={fieldId}>
        <select
          id={fieldId}
          name="occurrence"
          required
          defaultValue=""
        >
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
      </Field>
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <Feedback state={state} />
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
  const fieldId = useId();

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
    <form action={formAction}>
      <Field label="Pagamento" id={fieldId}>
        <select
          id={fieldId}
          name="paymentStatus"
          defaultValue={current}
        >
          {(Object.keys(
            PAYMENT_STATUS_LABELS,
          ) as ExperimentalPaymentStatus[]).map((status) => (
            <option key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending ? "Registrando…" : "Registrar pagamento"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Plano escolhido na conversao (EXP-51). */
export type ConversionPlanOption = {
  id: string;
  name: string;
};

/** Horario fixo escolhido na conversao (EXP-51). */
export type ConversionScheduleOption = {
  id: string;
  label: string;
};

/**
 * Conversao em aluna (EXP-50, EXP-51, EXP-57): e-mail, data de
 * nascimento, plano e horario fixo. A conversao pede confirmacao antes de
 * aplicar e mostra o resultado sem perder a tela.
 */
export function ConversionForm({
  experimentalId,
  plans,
  schedules,
}: {
  experimentalId: string;
  plans: ConversionPlanOption[];
  schedules: ConversionScheduleOption[];
}) {
  const router = useRouter();
  const emailId = useId();
  const birthDateId = useId();
  const planId = useId();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const classSlotIds = formData
        .getAll("classSlotIds")
        .map((value) => String(value))
        .filter((value) => value !== "");

      const result = await convertExperimentalAction({
        experimentalId,
        email: String(formData.get("email") ?? ""),
        birthDate: String(formData.get("birthDate") ?? ""),
        planId: String(formData.get("planId") ?? ""),
        classSlotIds,
      });
      if (!result.ok) return { ok: false, message: result.error };
      return {
        ok: true,
        message: `Aluna "${result.value.student.name}" criada com o plano e o horário fixo.`,
      };
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
        if (
          !confirmAction(
            "Converter esta experimental em aluna ativa? A aluna entra com o plano e o horário fixo escolhidos.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Field label="E-mail da aluna" id={emailId}>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          placeholder="maria@exemplo.com"
        />
      </Field>

      <Field label="Data de nascimento" id={birthDateId}>
        <input id={birthDateId} name="birthDate" type="date" required />
      </Field>

      <Field label="Plano" id={planId}>
        <select id={planId} name="planId" required defaultValue="">
          <option value="">Selecione o plano</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="mb-4">
        <legend className="mb-1 text-[13.5px] font-medium">Horário fixo</legend>
        {schedules.length === 0 ? (
          <p className="text-[13.5px] text-[color:var(--cinza)]">
            Nenhuma turma ativa cadastrada.
          </p>
        ) : (
          schedules.map((schedule) => (
            <label
              key={schedule.id}
              className="flex items-center gap-2 text-[15px]"
            >
              <input
                type="checkbox"
                name="classSlotIds"
                value={schedule.id}
                className="h-4 w-4"
              />
              {schedule.label}
            </label>
          ))
        )}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Convertendo…" : "Converter em aluna"}
      </Button>
      <Feedback state={state} />
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
  plans = [],
  schedules = [],
}: {
  experimentalId: string;
  status: ExperimentalStatus;
  paymentStatus: ExperimentalPaymentStatus;
  /** O cancelamento encerra o direito ao reagendamento (menos de 24h). */
  cancelLosesRight: boolean;
  occurrences: OccurrenceChoice[];
  /** Planos ativos oferecidos na conversao (EXP-51). */
  plans?: ConversionPlanOption[];
  /** Horarios ativos oferecidos na conversao (EXP-51). */
  schedules?: ConversionScheduleOption[];
}) {
  if (status === "DUPLICADA") {
    return (
      <section className={sectionClass}>
        <h2 className={headingClass}>Tentativa duplicada</h2>
        <p className="text-[15px]">
          Esta tentativa foi bloqueada pelo telefone e é somente leitura: não
          há ação a aplicar.
        </p>
      </section>
    );
  }

  const viva = status === "PENDENTE" || status === "APROVADA";
  const reagendavel = status === "CANCELADA_COM_DIREITO";

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Ações</h2>

      <div className="space-y-4">
        {status === "PENDENTE" ? (
          <Block>
            <SimpleActionForm
              label="Aprovar"
              pendingLabel="Aprovando…"
              run={() => approveExperimentalAction({ experimentalId })}
            />
          </Block>
        ) : null}

        {viva ? (
          <Block>
            <SimpleActionForm
              label="Recusar"
              pendingLabel="Recusando…"
              confirmMessage="Recusar esta solicitação? O telefone volta a ficar livre para uma nova solicitação."
              run={() => refuseExperimentalAction({ experimentalId })}
            />
          </Block>
        ) : null}

        {viva ? (
          <Block>
            <OccurrenceActionForm
              label="Trocar data e horário"
              pendingLabel="Trocando…"
              occurrences={occurrences}
              run={(choice) =>
                changeExperimentalOccurrenceAction({
                  experimentalId,
                  classSlotId: choice.classSlotId,
                  date: choice.date,
                })
              }
            />
          </Block>
        ) : null}

        {reagendavel ? (
          <Block>
            <OccurrenceActionForm
              label="Reagendar"
              pendingLabel="Reagendando…"
              occurrences={occurrences}
              run={(choice) =>
                rescheduleExperimentalAction({
                  experimentalId,
                  classSlotId: choice.classSlotId,
                  date: choice.date,
                })
              }
            />
          </Block>
        ) : null}

        {viva ? (
          <Block>
            <SimpleActionForm
              label="Cancelar"
              pendingLabel="Cancelando…"
              confirmMessage={
                cancelLosesRight
                  ? "Cancelar esta solicitação? O direito ao reagendamento acaba."
                  : "Cancelar esta solicitação? O direito ao reagendamento é mantido."
              }
              run={() => cancelExperimentalAction({ experimentalId })}
            />
          </Block>
        ) : null}

        {viva ? (
          <Block>
            <SimpleActionForm
              label="Registrar falta"
              pendingLabel="Registrando…"
              confirmMessage="Registrar falta nesta experimental? A vaga é liberada e o direito ao reagendamento acaba."
              run={() => registerNoShowAction({ experimentalId })}
            />
          </Block>
        ) : null}

        <Block>
          <PaymentForm experimentalId={experimentalId} current={paymentStatus} />
        </Block>

        <Block>
          <SimpleActionForm
            label="Registrar contato via WhatsApp"
            pendingLabel="Registrando…"
            run={() => registerWhatsAppContactAction({ experimentalId })}
          />
        </Block>

        {status === "APROVADA" ? (
          <Block>
            <h3 className="mb-2 text-[17px]">Converter em aluna</h3>
            <ConversionForm
              experimentalId={experimentalId}
              plans={plans}
              schedules={schedules}
            />
          </Block>
        ) : null}
      </div>
    </section>
  );
}
