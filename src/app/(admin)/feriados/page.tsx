import {
  listHolidays,
  listStudioClosures,
} from "../../../modules/classes/services/blocks";
import {
  CreateClosureForm,
  CreateHolidayForm,
  ClosureRowForms,
  FeedbackHost,
  HolidayRowForms,
} from "./feriados-forms";

export const dynamic = "force-dynamic";

/**
 * Tela de feriados e recessos (FER-16 a FER-25): o admin cadastra, edita e
 * remove os bloqueios de datas e ve o resultado de cada operacao. O cadastro
 * bloqueia as ocorrencias de hoje em diante na hora e nao gera credito
 * (PRD 7.1/7.2); remover ou editar o bloqueio reabre as ocorrencias.
 *
 * A pele e a do admin do guia: pena para os formularios, as duas listas em
 * divisores e o resultado de qualquer operacao na pilula preta, no topo.
 */
export default async function AdminBlocksPage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const holidays = await listHolidays(db);
  const closures = await listStudioClosures(db);

  return (
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Feriados e recessos</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          Feriado e recesso bloqueiam as turmas das datas correspondentes e não
          geram crédito. Remover ou editar o bloqueio reabre as ocorrências de
          hoje em diante.
        </p>
        <FeedbackHost />
      </header>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
          <h2 className="text-[20px]">Cadastrar feriado</h2>
          <CreateHolidayForm />
        </div>
        <div className="rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
          <h2 className="text-[20px]">Cadastrar recesso</h2>
          <CreateClosureForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[20px]">Feriados</h2>
        {holidays.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Nenhum feriado cadastrado.
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {holidays.map((holiday) => (
              <li
                key={holiday.id}
                className="border-t border-t-[var(--linha)] py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="tnum text-[17px] font-extrabold tracking-[-0.02em]">
                    {new Date(`${holiday.date}T12:00:00Z`).toLocaleDateString(
                      "pt-BR",
                      { timeZone: "UTC" },
                    )}
                  </p>
                  <p className="text-[14px] text-[color:var(--cinza)]">
                    {holiday.name}
                  </p>
                </div>
                <HolidayRowForms holiday={holiday} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[20px]">Recessos</h2>
        {closures.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Nenhum recesso cadastrado.
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {closures.map((closure) => (
              <li
                key={closure.id}
                className="border-t border-t-[var(--linha)] py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="tnum text-[17px] font-extrabold tracking-[-0.02em]">
                    {new Date(
                      `${closure.startDate}T12:00:00Z`,
                    ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}{" "}
                    a{" "}
                    {new Date(`${closure.endDate}T12:00:00Z`).toLocaleDateString(
                      "pt-BR",
                      { timeZone: "UTC" },
                    )}
                  </p>
                  <p className="text-[14px] text-[color:var(--cinza)]">
                    {closure.reason}
                  </p>
                </div>
                <ClosureRowForms closure={closure} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
