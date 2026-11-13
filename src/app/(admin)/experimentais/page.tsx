import Link from "next/link";
import {
  EXPERIMENTAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "../../../modules/experimentals/domain/validators";
import { listExperimentals } from "../../../modules/experimentals/services/experimentals";
import { STUDIO_TIMEZONE } from "../../../modules/classes/domain/occurrences";
import { Button, Chip, Field } from "../../../modules/ui/components/kit";

export const dynamic = "force-dynamic";

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
 *
 * A pele e a do admin do guia: a busca em campo do guia e a lista em
 * divisores, com o status em chip.
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
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Aulas experimentais</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          Solicitações recebidas pelo site, com a ocorrência escolhida, o
          status e a situação do pagamento.
        </p>
      </header>

      <form method="get" className="max-w-[430px]">
        <Field label="Buscar por telefone" id="experimental-telefone">
          <input
            id="experimental-telefone"
            name="telefone"
            type="tel"
            defaultValue={phone}
            placeholder="Ex.: (11) 99999-0000"
          />
        </Field>
        <Button type="submit" variant="sec" small>
          Buscar
        </Button>
        {phone ? (
          <p className="mt-2 text-[13.5px]">
            <Link
              href="/experimentais"
              className="underline decoration-2 underline-offset-4"
            >
              Limpar busca
            </Link>
          </p>
        ) : null}
      </form>

      <section className="mt-8">
        <h2 className="text-[20px]">
          {phone ? "Tentativas do telefone" : "Solicitações"}
        </h2>
        {experimentals.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            {phone
              ? "Nenhuma solicitação encontrada para este telefone."
              : "Nenhuma solicitação de aula experimental ainda."}
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {experimentals.map((experimental) => (
              <li
                key={experimental.id}
                className="border-t border-t-[var(--linha)] py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <p className="text-[17px] font-extrabold tracking-[-0.02em]">
                    {experimental.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Chip
                      variant={
                        experimental.status === "PENDENTE" ? undefined : "cl"
                      }
                    >
                      {EXPERIMENTAL_STATUS_LABELS[experimental.status]}
                    </Chip>
                    <Link
                      href={`/experimentais/${experimental.id}`}
                      className="btn btn-txt peq"
                    >
                      Ver detalhe
                    </Link>
                  </div>
                </div>
                <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-[13.5px] sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-[color:var(--cinza)]">Telefone</dt>
                    <dd>{experimental.phone}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[color:var(--cinza)]">Aula</dt>
                    <dd className="tnum">
                      {formatOccurrenceDate(experimental.occurrence.date)} -{" "}
                      {formatOccurrenceTime(
                        experimental.occurrence.startTime,
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[color:var(--cinza)]">Modalidade</dt>
                    <dd>{experimental.occurrence.classTypeName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[color:var(--cinza)]">Pagamento</dt>
                    <dd>{PAYMENT_STATUS_LABELS[experimental.paymentStatus]}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[color:var(--cinza)]">Solicitada em</dt>
                    <dd className="tnum">
                      {formatDate(experimental.requestedAt)} -{" "}
                      {formatTime(experimental.requestedAt)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
