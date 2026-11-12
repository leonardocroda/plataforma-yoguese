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
import { ExperimentalActions } from "./experimental-forms";

export const dynamic = "force-dynamic";

const blockClass =
  "rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs";

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
 * tentativa duplicada aparece somente leitura, sem nenhuma acao.
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
      <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
        <p className="text-sm">Solicitação não encontrada.</p>
        <p className="mt-2 text-xs">
          <Link href="/experimentais" className="underline">
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
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <p className="text-xs">
          <Link href="/experimentais" className="underline">
            Experimentais
          </Link>{" "}
          / {experimental.name}
        </p>
        <h1 className="text-2xl font-light">{experimental.name}</h1>
        <p className="text-xs opacity-70">
          Aula experimental: {formatPrice(EXPERIMENTAL_PRICE_CENTS)}
        </p>
      </header>

      <section className="space-y-4">
        <div className={blockClass}>
          <h2 className="text-sm font-medium">Solicitação</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="opacity-70">Nome</dt>
            <dd>{experimental.name}</dd>
            <dt className="opacity-70">Telefone</dt>
            <dd>{experimental.phone}</dd>
            <dt className="opacity-70">Modalidade</dt>
            <dd>{occurrence.classTypeName}</dd>
            <dt className="opacity-70">Data e horário</dt>
            <dd>
              {formatOccurrenceDate(occurrence.date)} -{" "}
              {formatOccurrenceTime(occurrence.startTime)}
            </dd>
            <dt className="opacity-70">Status</dt>
            <dd>{EXPERIMENTAL_STATUS_LABELS[experimental.status]}</dd>
            <dt className="opacity-70">Pagamento</dt>
            <dd>{PAYMENT_STATUS_LABELS[experimental.paymentStatus]}</dd>
            {experimental.duplicateOfId ? (
              <>
                <dt className="opacity-70">Tentativa ligada a</dt>
                <dd>
                  <Link
                    href={`/experimentais/${experimental.duplicateOfId}`}
                    className="underline"
                  >
                    solicitação existente
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
          <p className="mt-3 text-xs opacity-70">Declaração de saúde</p>
          <p className="mt-1 text-xs">{experimental.healthDeclaration}</p>
        </div>

        <div className={blockClass}>
          <h2 className="text-sm font-medium">Timestamps</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="opacity-70">Solicitada em</dt>
            <dd>{formatMoment(experimental.requestedAt)}</dd>
            <dt className="opacity-70">Aprovada em</dt>
            <dd>{formatMoment(experimental.approvedAt)}</dd>
            <dt className="opacity-70">Cancelada em</dt>
            <dd>{formatMoment(experimental.cancelledAt)}</dd>
            <dt className="opacity-70">Falta em</dt>
            <dd>{formatMoment(experimental.noShowAt)}</dd>
            <dt className="opacity-70">Contato via WhatsApp em</dt>
            <dd>{formatMoment(experimental.whatsappContactedAt)}</dd>
            <dt className="opacity-70">Realizada em</dt>
            <dd>{formatMoment(experimental.attendedAt)}</dd>
          </dl>
        </div>

        {convertedStudent ? (
          <div className={blockClass}>
            <h2 className="text-sm font-medium">Aluna convertida</h2>
            <p className="mt-2">
              <Link
                href={`/alunos/${convertedStudent.id}`}
                className="underline"
              >
                {convertedStudent.name}
              </Link>{" "}
              - {convertedStudent.email}
            </p>
          </div>
        ) : null}

        {reschedules.length > 0 ? (
          <div className={blockClass}>
            <h2 className="text-sm font-medium">Histórico de reagendamentos</h2>
            <ul className="mt-2 space-y-1">
              {reschedules.map((entry) => (
                <li key={entry.id}>
                  {entry.reason} - {formatMoment(entry.rescheduledAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
        />
      </section>
    </main>
  );
}
