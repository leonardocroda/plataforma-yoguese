import { listPlansAction } from "../../../modules/plans/actions";
import { Chip } from "../../../modules/ui/components/kit";
import { CreatePlanForm, PlanCardForms } from "./plan-forms";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

function formatPrice(price: string): string {
  // O valor exibido e o gravado no banco (PLAN-06): sem tabela de precos no
  // codigo, a formatacao e so apresentacao.
  return Number(price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Tela de planos (PLAN-01 a PLAN-03, PLAN-06): o admin cria, edita e
 * inativa planos; o valor mostrado vem do banco. A pele e a do admin do
 * guia: superficie pena para o cadastro, a lista em divisores com o status em
 * chip e o feedback de cada operacao no proprio formulario.
 */
export default async function AdminPlansPage() {
  // As actions leem via dbClient dinamico: a tela nao importa o banco no
  // build.
  const plans = await listPlansAction();

  return (
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Planos</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          A tabela de preços é sua: crie, edite e inative planos com valor e
          frequência.
        </p>
      </header>

      <section className="max-w-[520px] rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
        <h2 className="text-[22px]">Criar plano</h2>
        <CreatePlanForm />
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Planos cadastrados</h2>
        {plans.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Nenhum plano cadastrado ainda.
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="border-t border-t-[var(--linha)] py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <p className="text-[19px] font-extrabold tracking-[-0.02em]">
                    {plan.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tnum text-[19px] font-extrabold tracking-[-0.02em]">
                      {formatPrice(plan.price)}
                    </span>
                    <Chip variant={plan.status === "ATIVO" ? undefined : "cl"}>
                      {statusLabel[plan.status]}
                    </Chip>
                  </div>
                </div>
                <p className="mt-1 text-[13.5px] text-[color:var(--cinza)]">
                  {plan.weeklyFrequency}{" "}
                  {plan.weeklyFrequency === 1
                    ? "aula por semana"
                    : "aulas por semana"}{" "}
                  · {plan.description ?? "-"}
                </p>

                <PlanCardForms
                  planId={plan.id}
                  name={plan.name}
                  price={plan.price}
                  weeklyFrequency={plan.weeklyFrequency}
                  description={plan.description}
                  status={plan.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
