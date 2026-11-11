import {
  listHolidays,
  listStudioClosures,
} from "../../../modules/classes/services/blocks";
import {
  CreateClosureForm,
  CreateHolidayForm,
  ClosureRowForms,
  HolidayRowForms,
} from "./feriados-forms";

export const dynamic = "force-dynamic";

/**
 * Tela de feriados e recessos (FER-16 a FER-25): o admin cadastra, edita e
 * remove os bloqueios de datas e ve o resultado de cada operacao. O cadastro
 * bloqueia as ocorrencias de hoje em diante na hora e nao gera credito
 * (PRD 7.1/7.2); remover ou editar o bloqueio reabre as ocorrencias.
 */
export default async function AdminBlocksPage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const holidays = await listHolidays(db);
  const closures = await listStudioClosures(db);

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Feriados e recessos</h1>
        <p className="text-xs">
          Feriado e recesso bloqueiam as turmas das datas correspondentes e não
          geram crédito. Remover ou editar o bloqueio reabre as ocorrências de
          hoje em diante.
        </p>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3">
          <h2 className="text-sm font-medium">Cadastrar feriado</h2>
          <CreateHolidayForm />
        </div>
        <div className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3">
          <h2 className="text-sm font-medium">Cadastrar recesso</h2>
          <CreateClosureForm />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-medium">Feriados</h2>
        {holidays.length === 0 ? (
          <p className="mt-2 text-xs opacity-70">Nenhum feriado cadastrado.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {holidays.map((holiday) => (
              <li
                key={holiday.id}
                className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
              >
                <p className="font-medium">
                  {new Date(`${holiday.date}T12:00:00Z`).toLocaleDateString(
                    "pt-BR",
                    { timeZone: "UTC" },
                  )}
                </p>
                <p className="opacity-70">{holiday.name}</p>
                <HolidayRowForms holiday={holiday} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium">Recessos</h2>
        {closures.length === 0 ? (
          <p className="mt-2 text-xs opacity-70">Nenhum recesso cadastrado.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {closures.map((closure) => (
              <li
                key={closure.id}
                className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
              >
                <p className="font-medium">
                  {new Date(`${closure.startDate}T12:00:00Z`).toLocaleDateString(
                    "pt-BR",
                    { timeZone: "UTC" },
                  )}{" "}
                  a{" "}
                  {new Date(`${closure.endDate}T12:00:00Z`).toLocaleDateString(
                    "pt-BR",
                    { timeZone: "UTC" },
                  )}
                </p>
                <p className="opacity-70">{closure.reason}</p>
                <ClosureRowForms closure={closure} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
