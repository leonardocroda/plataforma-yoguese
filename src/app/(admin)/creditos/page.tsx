import { listStudentCreditsAction } from "../../../modules/credits/actions";
import { STUDIO_TIMEZONE } from "../../../modules/classes/domain/occurrences";
import { listActiveStudents } from "../../../modules/students/services/students";
import { CreditChangeForms, GrantCreditForm } from "./credit-forms";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-xs text-[var(--yoguese-cinza)]";
const buttonClass =
  "rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-xs text-white disabled:opacity-60";

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
}

/**
 * Tela de creditos do aluno (CRD-39, CRD-40): o admin escolhe o aluno,
 * ve os creditos com geracao, vencimento, status, origem e as transacoes de
 * cada um, e concede, devolve ou cancela credito com motivo. Sem auth nesta
 * slice: o responsavel fica por rotulo (AD-016).
 */
export default async function AdminCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string }>;
}) {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const params = await searchParams;
  const students = await listActiveStudents(db);
  const selected = students.find((student) => student.id === params.aluno);
  const student = selected ?? students[0];
  const credits = student ? await listStudentCreditsAction(student.id) : [];

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Créditos do aluno</h1>
        <p className="text-xs">
          Conceder, devolver e cancelar crédito com motivo e acompanhar as
          transações
        </p>
      </header>

      <form method="get" className="mb-6 max-w-sm space-y-2">
        <label className="block text-xs font-medium">
          Aluno
          <select
            name="aluno"
            className={inputClass}
            defaultValue={student?.id ?? ""}
          >
            {students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass}>
          Abrir créditos
        </button>
      </form>

      {students.length === 0 ? (
        <p className="text-sm">Nenhum aluno ativo cadastrado.</p>
      ) : null}

      {student ? (
        <section>
          <h2 className="text-lg font-medium">{student.name}</h2>

          <div className="mt-3 max-w-sm rounded-lg border border-[var(--yoguese-bege)] bg-white p-3">
            <h3 className="text-sm font-medium">Conceder crédito</h3>
            <GrantCreditForm studentId={student.id} />
          </div>

          <h3 className="mt-6 text-sm font-medium">Créditos</h3>
          {credits.length === 0 ? (
            <p className="mt-2 text-xs opacity-70">
              Nenhum crédito para este aluno.
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {credits.map((credit) => (
                <li
                  key={credit.id}
                  className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
                >
                  <dl className="grid grid-cols-2 gap-1">
                    <dt className="opacity-70">Origem</dt>
                    <dd>{credit.source}</dd>
                    <dt className="opacity-70">Geração</dt>
                    <dd>{formatDate(credit.generatedAt)}</dd>
                    <dt className="opacity-70">Vencimento</dt>
                    <dd>{formatDate(credit.expiresAt)}</dd>
                    <dt className="opacity-70">Status</dt>
                    <dd>{credit.status}</dd>
                  </dl>

                  <p className="mt-2 font-medium">Transações</p>
                  {credit.transactions.length === 0 ? (
                    <p className="opacity-70">Sem transações.</p>
                  ) : (
                    <ul>
                      {credit.transactions.map((transaction) => (
                        <li key={transaction.id}>
                          {transaction.action} (
                          {transaction.previousStatus ?? "-"} {"->"}{" "}
                          {transaction.newStatus}) - {transaction.reason} -{" "}
                          {transaction.adminLabel} em{" "}
                          {formatDate(transaction.createdAt)}
                        </li>
                      ))}
                    </ul>
                  )}

                  <CreditChangeForms creditId={credit.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
