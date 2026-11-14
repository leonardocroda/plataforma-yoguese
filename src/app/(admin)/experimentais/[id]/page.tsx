import Link from "next/link";
import {
  STUDIO_TIMEZONE,
  studioDateTimeToInstant,
} from "../../../../modules/classes/domain/occurrences";
import { cancellationKeepsRight } from "../../../../modules/experimentals/domain/rules";
import {
  EXPERIMENTAL_PRICE_CENTS,
  EXPERIMENTAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "../../../../modules/experimentals/domain/validators";
import {
  getExperimental,
  listExperimentalOccurrences,
} from "../../../../modules/experimentals/services/experimentals";
import { listActiveSlots } from "../../../../modules/classes/services/classes";
import { listSelectablePlans } from "../../../../modules/plans/services/plans";
import { Chip } from "../../../../modules/ui/components/kit";
import { ExperimentalActions } from "./experimental-forms";

export const dynamic = "force-dynamic";

const sectionClass = "border-t-2 border-t-[var(--preto)] pt-4";
const headingClass = "mb-2 text-[22px]";
const listClass = "m-0 list-none p-0 text-[15px]";

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("pt-BR", {
    timeZone: STUDIO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoment(value: Date | null): string {
  if (!value) return "-";
  return `${formatDate(value)} - ${formatTime(value)}`;
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/** Data da ocorrencia ("YYYY-MM-DD") no formato do estudio. */
function formatOccurrenceDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

/** Horario da ocorrencia ("HH:MM:SS") em "HH:MM". */
function formatOccurrenceTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Detalhe da aula experimental (EXP-19, EXP-24, EXP-29, EXP-31, EXP-32,
 * EXP-33, EXP-49): todos os dados da solicitacao com os timestamps do
 * ciclo de vida, as acoes administrativas e o resultado de cada uma. A
 * tentativa duplicada aparece somente leitura, sem nenhuma acao. A pele e a
 * do admin do guia: secoes em divisores e as acoes na superficie pena.
 */
export default async function ExperimentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../../db");

  const detail = await getExperimental(db, { experimentalId: id });

  if (!detail.ok) {
    return (
      <main>
        <p className="text-[15px]">Solicitação não encontrada.</p>
        <p className="mt-2 text-[14px]">
          <Link
            href="/experimentais"
            className="underline decoration-2 underline-offset-4"
          >
            Voltar para experimentais
          </Link>
        </p>
      </main>
    );
  }

  const { experimental, occurrence, convertedStudent, reschedules } =
    detail.value;

  // As ocorrencias futuras com vaga, oferecidas para trocar data/horario
  const occurrences = await listExperimentalOccurrences(db);

  // A conversao em aluna: os planos ativos e as turmas ativas oferecidas no
  // formulario (EXP-51)
  const plans = (await listSelectablePlans(db)).map((plan) => ({
    id: plan.id,
    name: plan.name,
  }));
  const schedules = (await listActiveSlots(db)).map((slot) => ({
    id: slot.id,
    label: `${slot.classTypeName} - ${formatOccurrenceTime(slot.startTime)}`,
  }));

  // A regra das 24 horas decide se o cancelamento mantem o direito ao
  // reagendamento. O cancelamento que o encerra pede confirmacao
  // (EXP-31); o que mantem o direito nao precisa dela.
  const startsAt = studioDateTimeToInstant(
    occurrence.date,
    occurrence.startTime,
  );
  const hoursBeforeStart = (startsAt.getTime() - Date.now()) / 3_600_000;
  const cancelLosesRight = !cancellationKeepsRight(hoursBeforeStart);

  return (
    <main>
      <header className="mb-6">
        <p className="text-[13.5px] text-[color:var(--cinza)]">
          <Link
            href="/experimentais"
            className="underline decoration-2 underline-offset-4"
          >
            Experimentais
          </Link>{" "}
          / {experimental.name}
        </p>
        <h1 className="mt-1 text-[34px]">{experimental.name}</h1>
        <p className="mt-1 text-[15px] text-[color:var(--cinza)]">
          Aula experimental: <span className="tnum">{formatPrice(EXPERIMENTAL_PRICE_CENTS)}</span>
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)] xl:items-start">
        <div className="grid gap-6">
          <section className={sectionClass}>
            <h2 className={headingClass}>Solicitação</h2>
            <dl className="grid grid-cols-[10em_1fr] gap-x-4 gap-y-1 text-[15px]">
              <dt className="text-[color:var(--cinza)]">Nome</dt>
              <dd>{experimental.name}</dd>
              <dt className="text-[color:var(--cinza)]">Telefone</dt>
              <dd>{experimental.phone}</dd>
              <dt className="text-[color:var(--cinza)]">Modalidade</dt>
              <dd>{occurrence.classTypeName}</dd>
              <dt className="text-[color:var(--cinza)]">Data e horário</dt>
              <dd className="tnum">
                {formatOccurrenceDate(occurrence.date)} -{" "}
                {formatOccurrenceTime(occurrence.startTime)}
              </dd>
              <dt className="text-[color:var(--cinza)]">Status</dt>
              <dd>
                <Chip
                  variant={experimental.status === "PENDENTE" ? undefined : "cl"}
                >
                  {EXPERIMENTAL_STATUS_LABELS[experimental.status]}
                </Chip>
              </dd>
              <dt className="text-[color:var(--cinza)]">Pagamento</dt>
              <dd>{PAYMENT_STATUS_LABELS[experimental.paymentStatus]}</dd>
              {experimental.duplicateOfId ? (
                <>
                  <dt className="text-[color:var(--cinza)]">
                    Tentativa ligada a
                  </dt>
                  <dd>
                    <Link
                      href={`/experimentais/${experimental.duplicateOfId}`}
                      className="underline decoration-2 underline-offset-4"
                    >
                      solicitação existente
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
            <p className="mt-3 text-[13.5px] text-[color:var(--cinza)]">
              Declaração de saúde
            </p>
            <p className="mt-1 text-[15px]">{experimental.healthDeclaration}</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Timestamps</h2>
            <dl className="grid grid-cols-[10em_1fr] gap-x-4 gap-y-1 text-[15px]">
              <dt className="text-[color:var(--cinza)]">Solicitada em</dt>
              <dd className="tnum">{formatMoment(experimental.requestedAt)}</dd>
              <dt className="text-[color:var(--cinza)]">Aprovada em</dt>
              <dd className="tnum">{formatMoment(experimental.approvedAt)}</dd>
              <dt className="text-[color:var(--cinza)]">Cancelada em</dt>
              <dd className="tnum">{formatMoment(experimental.cancelledAt)}</dd>
              <dt className="text-[color:var(--cinza)]">Falta em</dt>
              <dd className="tnum">{formatMoment(experimental.noShowAt)}</dd>
              <dt className="text-[color:var(--cinza)]">
                Contato via WhatsApp em
              </dt>
              <dd className="tnum">
                {formatMoment(experimental.whatsappContactedAt)}
              </dd>
              <dt className="text-[color:var(--cinza)]">Realizada em</dt>
              <dd className="tnum">{formatMoment(experimental.attendedAt)}</dd>
            </dl>
          </section>

          {convertedStudent ? (
            <section className={sectionClass}>
              <h2 className={headingClass}>Aluna convertida</h2>
              <p className="text-[15px]">
                <Link
                  href={`/alunos/${convertedStudent.id}`}
                  className="underline decoration-2 underline-offset-4"
                >
                  {convertedStudent.name}
                </Link>{" "}
                - {convertedStudent.email}
              </p>
            </section>
          ) : null}

          {reschedules.length > 0 ? (
            <section className={sectionClass}>
              <h2 className={headingClass}>Histórico de reagendamentos</h2>
              <ul className={listClass}>
                {reschedules.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-t border-t-[var(--linha)] py-1.5 first:border-t-0"
                  >
                    {entry.reason} - {formatMoment(entry.rescheduledAt)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <ExperimentalActions
          experimentalId={experimental.id}
          status={experimental.status}
          paymentStatus={experimental.paymentStatus}
          cancelLosesRight={cancelLosesRight}
          occurrences={occurrences.map((option) => ({
            classSlotId: option.classSlotId,
            date: option.date,
            label: `${option.classTypeName} - ${formatOccurrenceDate(option.date)} ${formatOccurrenceTime(option.startTime)} (${option.availableSpots} ${option.availableSpots === 1 ? "vaga" : "vagas"})`,
          }))}
          plans={plans}
          schedules={schedules}
        />
      </div>
    </main>
  );
}
