import { listPlansAction } from "../../../modules/plans/actions";
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
 * inativa planos; o valor mostrado vem do banco. Os formularios mostram o
 * feedback fora da listagem, no padrao visual das telas admin.
 */
export default async function AdminPlansPage() {
  // As actions leem via dbClient dinamico: a tela nao importa o banco no
  // build.
  const plans = await listPlansAction();

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Planos</h1>
        <p className="text-xs">
          A tabela de preços é sua: crie, edite e inative planos com valor e
          frequência
        </p>
      </header>

      <div className="max-w-sm rounded-lg border border-[var(--yoguese-bege)] bg-white p-3">
        <h2 className="text-sm font-medium">Criar plano</h2>
        <CreatePlanForm />
      </div>

      <h2 className="mt-6 text-sm font-medium">Planos cadastrados</h2>
      {plans.length === 0 ? (
        <p className="mt-2 text-xs opacity-70">
          Nenhum plano cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
            >
              <dl className="grid grid-cols-2 gap-1">
                <dt className="opacity-70">Nome</dt>
                <dd>{plan.name}</dd>
                <dt className="opacity-70">Valor mensal</dt>
                <dd>{formatPrice(plan.price)}</dd>
                <dt className="opacity-70">Aulas por semana</dt>
                <dd>{plan.weeklyFrequency}</dd>
                <dt className="opacity-70">Descrição</dt>
                <dd>{plan.description ?? "-"}</dd>
                <dt className="opacity-70">Status</dt>
                <dd>{statusLabel[plan.status]}</dd>
              </dl>

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
    </main>
  );
}
