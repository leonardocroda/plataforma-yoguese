import Image from "next/image";
import Link from "next/link";
import { weekdayOf } from "../../modules/classes/domain/occurrences";
import { listExperimentalOccurrences } from "../../modules/experimentals/services/experimentals";
import { VacancyDucks } from "../../modules/ui/components/vacancy-ducks";

// Home publica (guia, tela "Home publica"): logo no topo com "Entrar" e a
// acao principal da experimental, titulo gigante escalonado com o pato sobre
// o circulo pontilhado e, logo abaixo, as proximas aulas com vaga. A lista
// usa a mesma consulta de ocorrencias da tela de experimental - turma e
// modalidade ativas, ocorrencia agendada e com vaga (AD-014) - sem
// reescrever filtro nenhum.

export const dynamic = "force-dynamic";

/** Todo turma tem 8 vagas; a leitura publica so sabe quantas estao livres. */
const TURMA_VAGAS = 8;

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

type HomeOccurrence = {
  classSlotId: string;
  date: string;
  startTime: string;
  classTypeName: string;
  availableSpots: number;
};

function formatWhen(date: string, startTime: string): string {
  return `${WEEKDAYS[weekdayOf(date) - 1]}, ${startTime.slice(0, 5)}`;
}

export default async function SiteHome() {
  // A consulta so existe em tempo de execucao; se ela nao carregar, a tela
  // mostra o texto de carregamento do guia, nunca uma tela quebrada.
  let occurrences: HomeOccurrence[] | null = null;
  try {
    const { db } = await import("../../db");
    const options = await listExperimentalOccurrences(db);
    occurrences = options.map((option) => ({
      classSlotId: option.classSlotId,
      date: option.date,
      startTime: option.startTime,
      classTypeName: option.classTypeName,
      availableSpots: option.availableSpots,
    }));
  } catch {
    occurrences = null;
  }

  return (
    <main>
      <header className="relative z-[3] flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Image
          src="/assets/logo.png"
          alt="Yogue-se"
          width={343}
          height={72}
          className="relative z-[3] h-[34px] w-auto"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn btn-sec peq">
            Entrar
          </Link>
          <Link href="/experimental" className="btn btn-prim">
            Agendar aula experimental
          </Link>
        </div>
      </header>

      <section className="relative min-h-[470px] overflow-hidden px-5 pb-14 pt-5 sm:px-8">
        <div
          className="bolha absolute right-[-30px] top-[-70px] aspect-square w-[clamp(220px,40%,420px)]"
          aria-hidden="true"
        />
        <div
          className="bolha absolute right-[70px] top-[300px] hidden aspect-square w-[clamp(120px,22%,230px)] opacity-90 sm:block"
          aria-hidden="true"
        />
        <Image
          src="/assets/pato.png"
          alt="Pato em lótus"
          width={400}
          height={423}
          className="absolute right-3.5 top-2 z-[2] w-[170px] sm:right-8 sm:w-[clamp(150px,26%,250px)]"
        />
        <h1 className="relative z-[3] -ml-[0.04em] mt-[210px] text-[clamp(64px,11.5vw,138px)] font-extrabold leading-[0.86] tracking-[-0.045em] sm:mt-[34px]">
          <span className="block">Yoga</span>
          <span className="block sm:ml-[clamp(70px,44%,360px)]">do</span>
          <span className="block ml-[0.06em]">Pato</span>
        </h1>
        <div className="relative z-[3] mt-[30px] max-w-[27em]">
          <p className="mb-[22px] text-[19px] text-[color:var(--grafite)]">
            Turmas de até 8 pessoas, com a professora acompanhando cada uma de
            perto.
          </p>
        </div>
      </section>

      <section className="relative z-[3] border-t-2 border-t-[var(--preto)] px-5 pb-6 pt-[26px] sm:px-8">
        <h2 className="mb-1.5 text-[26px] tracking-[-0.03em]">
          Próximas aulas com vaga
        </h2>

        {occurrences === null ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Respirando fundo…
          </p>
        ) : occurrences.length === 0 ? (
          <div className="grid grid-cols-[1fr_60px] items-center gap-3 rounded-[var(--r-md)] border-2 border-dashed border-[var(--grafite)] p-4 text-[15px]">
            <div>
              <b className="mb-1 block text-[20px] font-extrabold tracking-[-0.02em]">
                Nenhuma aula com vaga agora
              </b>
              Assim que uma turma abrir vaga, ela aparece aqui.
            </div>
            <Image
              src="/assets/pato.png"
              alt=""
              width={60}
              height={63}
              className="h-auto w-[60px]"
            />
          </div>
        ) : (
          <ul className="mt-2.5 grid grid-cols-1 gap-x-7 sm:grid-cols-2 lg:grid-cols-3">
            {occurrences.map((occurrence) => (
              <li
                key={`${occurrence.classSlotId}-${occurrence.date}`}
                className="grid gap-2 border-t border-t-[var(--linha)] py-3.5"
              >
                <div className="tnum text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em]">
                  {formatWhen(occurrence.date, occurrence.startTime)}
                </div>
                <div className="text-[14.5px] text-[color:var(--cinza)]">
                  {occurrence.classTypeName}
                </div>
                <VacancyDucks
                  fixed={Math.max(
                    0,
                    TURMA_VAGAS - occurrence.availableSpots,
                  )}
                  size="md"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}