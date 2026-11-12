import Link from "next/link";
import {
  EXPERIMENTAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "../../../modules/experimentals/domain/validators";
import { listExperimentals } from "../../../modules/experimentals/services/experimentals";
import { STUDIO_TIMEZONE } from "../../../modules/classes/domain/occurrences";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

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
 * Tela de solicitacoes de aula experimental (EXP-17, EXP-18, EXP-30): a
 * listagem traz nome, telefone, data/horario da aula, modalidade, status,
 * pagamento e a data da solicitacao. A busca por telefone mostra todas as
 * tentativas daquele telefone normalizado - inclusive a duplicada, a
 * recusada, a cancelada e a convertida.
 */
export default async function AdminExperimentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string }>;
}) {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const params = await searchParams;
  const phone = params.telefone?.trim() ?? "";
  const experimentals = await listExperimentals(db, phone ? { phone } : {});

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Aulas experimentais</h1>
        <p className="text-xs">
          Solicitações recebidas pelo site, com a ocorrência escolhida, o
          status e a situação do pagamento
        </p>
      </header>

      <form method="get" className="mb-6 max-w-sm space-y-2">
        <label className="block text-xs font-medium">
          Buscar por telefone
          <input
            name="telefone"
            defaultValue={phone}
            className={inputClass}
            placeholder="Ex.: (11) 99999-0000"
          />
        </label>
        <button type="submit" className={buttonClass}>
          Buscar
        </button>
        {phone ? (
          <p className="text-xs opacity-70">
            <Link href="/experimentais" className="underline">
              Limpar busca
            </Link>
          </p>
        ) : null}
      </form>

      <h2 className="text-sm font-medium">
        {phone ? "Tentativas do telefone" : "Solicitações"}
      </h2>
      {experimentals.length === 0 ? (
        <p className="mt-2 text-xs opacity-70">
          {phone
            ? "Nenhuma solicitação encontrada para este telefone."
            : "Nenhuma solicitação de aula experimental ainda."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {experimentals.map((experimental) => (
            <li
              key={experimental.id}
              className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="opacity-70">Nome</dt>
                <dd>{experimental.name}</dd>
                <dt className="opacity-70">Telefone</dt>
                <dd>{experimental.phone}</dd>
                <dt className="opacity-70">Aula</dt>
                <dd>
                  {formatOccurrenceDate(experimental.occurrence.date)} -{" "}
                  {formatOccurrenceTime(experimental.occurrence.startTime)}
                </dd>
                <dt className="opacity-70">Modalidade</dt>
                <dd>{experimental.occurrence.classTypeName}</dd>
                <dt className="opacity-70">Status</dt>
                <dd>{EXPERIMENTAL_STATUS_LABELS[experimental.status]}</dd>
                <dt className="opacity-70">Pagamento</dt>
                <dd>{PAYMENT_STATUS_LABELS[experimental.paymentStatus]}</dd>
                <dt className="opacity-70">Solicitada em</dt>
                <dd>
                  {formatDate(experimental.requestedAt)} -{" "}
                  {formatTime(experimental.requestedAt)}
                </dd>
              </dl>
              <div className="mt-2">
                <Link
                  href={`/experimentais/${experimental.id}`}
                  className="rounded border border-[var(--yoguese-bege)] px-2 py-0.5 text-xs hover:bg-[var(--yoguese-off-white)]"
                >
                  Ver detalhe
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
