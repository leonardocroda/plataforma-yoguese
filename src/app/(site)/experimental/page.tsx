import { listExperimentalOccurrences } from "../../../modules/experimentals/services/experimentals";
import {
  EXPERIMENTAL_PRICE_CENTS,
  HEALTH_DECLARATION,
} from "../../../modules/experimentals/domain/validators";
import { ExperimentalRequestForm } from "./experimental-form";

// Formulario publico da aula experimental (PRD 8.1, 10.5). A pagina lista
// as ocorrencias futuras com vaga e entrega os textos fixos do PRD ao
// formulario. Nenhum dado de outra pessoa aparece aqui. A composicao e a
// tela "Agendar aula experimental" do guia: cartao centralizado, opcoes de
// turma, campos, valor e a confirmacao com o pato.

export const dynamic = "force-dynamic";

export default async function ExperimentalPage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");
  const options = await listExperimentalOccurrences(db);

  return (
    <main className="flex justify-center px-5 py-10">
      {/* Cartao-desenho do guia (`.celular`): 390px, papel com manchinhas,
          borda preta de 2px, canto de 38px. */}
      <div className="w-[min(100%,390px)] rounded-[38px] border-2 border-[var(--preto)] bg-[var(--papel)] p-[24px_20px_28px] [background-image:var(--manchinhas)]">
        <h1 className="mb-2.5 text-[44px] leading-[0.92] tracking-[-0.04em]">
          Aula experimental
        </h1>

        <ExperimentalRequestForm
          options={options}
          declaration={HEALTH_DECLARATION}
          priceCents={EXPERIMENTAL_PRICE_CENTS}
        />
      </div>
    </main>
  );
}