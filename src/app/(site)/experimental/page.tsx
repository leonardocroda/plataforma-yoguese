import { listExperimentalOccurrences } from "../../../modules/experimentals/services/experimentals";
import {
  EXPERIMENTAL_PRICE_CENTS,
  HEALTH_DECLARATION,
} from "../../../modules/experimentals/domain/validators";
import { ExperimentalRequestForm } from "./experimental-form";

// Formulario publico da aula experimental (PRD 8.1, 10.5). A pagina lista
// as ocorrencias futuras com vaga e entrega os textos fixos do PRD ao
// formulario. Nenhum dado de outra pessoa aparece aqui.

export const dynamic = "force-dynamic";

export default async function ExperimentalPage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");
  const options = await listExperimentalOccurrences(db);

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-8">
      <h1 className="text-3xl font-light text-[var(--yoguese-cinza)]">
        Aula experimental
      </h1>
      <p className="mt-2 text-sm text-[#8a8a8a]">
        Agende sua primeira aula no estúdio Yogue-se Yoga.
      </p>

      <ExperimentalRequestForm
        options={options}
        declaration={HEALTH_DECLARATION}
        priceCents={EXPERIMENTAL_PRICE_CENTS}
      />
    </main>
  );
}
