import type { ReactNode } from "react";

// Vagas sao patinhos (guia, secao "Vagas"): toda turma tem 8 vagas (PRD) e cada
// vaga e um pato. Estado: fixo (preto solido), reposicao (pena, contorno
// preto), experimental (pontilhado pessego), sua vaga (pessego solido) e livre
// (tracejado cinza). A regra de negocio - fixo, reposicao e experimental
// ocupam vaga do mesmo jeito - vive na composicao; aqui e so a leitura visual.
// Rotulo acessivel ("N vagas livres de 8") para leitor de tela, sem texto
// visivel duplicado (BRAND-09). O pato nunca e redesenhado: o desenho e o do
// guia, em paths.

const CAPACITY = 8;

type DuckSize = "xs" | "sm" | "md" | "lg";

type DuckState = "fixo" | "rep" | "exp" | "eu" | "livre";

const DUCK_PATH =
  "M10 1C7.4 1 6.2 2.8 6.2 5.2c0 2.2.9 3.4.6 5C4.2 11.6 1 14 1 18.5 1 22.6 5 25 10 25s9-2.4 9-6.5c0-4.5-3.2-6.9-5.8-8.3-.3-1.6.6-2.8.6-5C13.8 2.8 12.6 1 10 1Z";
const BEAK_PATH =
  "M7.7 5.1q2.3-1.3 4.6 0-.4 2.3-2.3 2.5-1.9-.2-2.3-2.5Z";

function Duck({ state }: { state: DuckState }) {
  return (
    <svg
      className={`pato ${state}`}
      viewBox="0 0 20 26"
      aria-hidden="true"
      focusable="false"
    >
      <path className="corpo" d={DUCK_PATH} />
      <path className="bico" d={BEAK_PATH} />
    </svg>
  );
}

export function VacancyDucks({
  fixed = 0,
  makeup = 0,
  experimental = 0,
  own = false,
  size = "xs",
  label,
  children,
}: {
  fixed?: number;
  makeup?: number;
  experimental?: number;
  own?: boolean;
  size?: DuckSize;
  /** Rotulo acessivel; sem ele, o componente deriva "N vagas livres de 8" */
  label?: string;
  children?: ReactNode;
}) {
  const occupied = fixed + makeup + experimental + (own ? 1 : 0);
  const free = Math.max(0, CAPACITY - occupied);
  const states: DuckState[] = [];
  const push = (state: DuckState, count: number) => {
    for (let i = 0; i < count && states.length < CAPACITY; i++) {
      states.push(state);
    }
  };
  push("fixo", fixed);
  push("rep", makeup);
  push("exp", experimental);
  if (own && states.length < CAPACITY) push("eu", 1);
  while (states.length < CAPACITY) push("livre", 1);
  const spoken =
    label ??
    (free === 1 ? "1 vaga livre de 8" : `${free} vagas livres de 8`);

  if (size === "sm") {
    // Versao miniatura (calendario do admin): bolinhas em grade 4x2
    return (
      <span className="vagas sm" role="img" aria-label={spoken}>
        {states.map((state, i) => (
          <span key={`${state}-${i}`} className={`dot ${state}`} />
        ))}
        {children}
      </span>
    );
  }

  return (
    <span className={`vagas ${size}`} role="img" aria-label={spoken}>
      {states.map((state, i) => (
        <Duck key={`${state}-${i}`} state={state} />
      ))}
      {children}
    </span>
  );
}
