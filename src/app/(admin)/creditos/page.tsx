import { listStudentCreditsAction } from "../../../modules/credits/actions";
import { STUDIO_TIMEZONE } from "../../../modules/classes/domain/occurrences";
import { listActiveStudents } from "../../../modules/students/services/students";
import { Button, Chip, Field } from "../../../modules/ui/components/kit";
import { CreditChangeForms, GrantCreditForm } from "./credit-forms";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: STUDIO_TIMEZONE });
}

/**
 * Tela de creditos do aluno (CRD-39, CRD-40): o admin escolhe o aluno,
 * ve os creditos com geracao, vencimento, status, origem e as transacoes de
 * cada um, e concede, devolve ou cancela credito com motivo. Sem auth nesta
 * slice: o responsavel fica por rotulo (AD-016). A pele e a do admin do
 * guia: pena para os formularios, a lista em divisores e o status em chip.
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
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Créditos de reposição</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          Conceda, devolva ou cancele um crédito de reposição com motivo e
          acompanhe as transações.
        </p>
      </header>

      <form method="get" className="max-w-[430px]">
        <Field label="Aluno" id="credito-aluno">
          <select
            id="credito-aluno"
            name="aluno"
            defaultValue={student?.id ?? ""}
          >
            {students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="sec" small>
          Abrir créditos
        </Button>
      </form>

      {students.length === 0 ? (
        <p className="mt-6 text-[15px] text-[color:var(--cinza)]">
          Nenhum aluno ativo cadastrado.
        </p>
      ) : null}

      {student ? (
        <section className="mt-8">
          <h2 className="text-[24px]">{student.name}</h2>

          <div className="mt-3 max-w-[430px] rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
            <h3 className="text-[20px]">Conceder crédito</h3>
            <GrantCreditForm studentId={student.id} />
          </div>

          <h3 className="mt-8 text-[20px]">Créditos</h3>
          {credits.length === 0 ? (
            <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
              Nenhum crédito para este aluno.
            </p>
          ) : (
            <ul className="mt-2 list-none p-0">
              {credits.map((credit) => (
                <li
                  key={credit.id}
                  className="border-t border-t-[var(--linha)] py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <p className="text-[15px] font-semibold">
                      Origem {credit.source}
                    </p>
                    <Chip
                      variant={credit.status === "DISPONIVEL" ? undefined : "cl"}
                    >
                      {credit.status}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[13.5px] text-[color:var(--cinza)]">
                    Gerado em {formatDate(credit.generatedAt)} · Vence em{" "}
                    {formatDate(credit.expiresAt)}
                  </p>

                  <p className="mt-3 text-[13.5px] font-semibold">
                    Transações
                  </p>
                  {credit.transactions.length === 0 ? (
                    <p className="text-[13.5px] text-[color:var(--cinza)]">
                      Sem transações.
                    </p>
                  ) : (
                    <ul className="m-0 list-none p-0 text-[13.5px]">
                      {credit.transactions.map((transaction) => (
                        <li
                          key={transaction.id}
                          className="border-t border-t-[var(--linha)] py-1.5"
                        >
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
