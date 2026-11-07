// Dominio puro: composicao e vagas de uma ocorrencia (RES-08, RES-09).
// Fixos derivam de FIXED_ENROLLMENTS ativos na data (e de BOOKINGS FIXED
// individuais desta ocorrencia - RES-14 AC1); reposicoes e experimentais
// derivam de BOOKINGS ativos por tipo. A formula ancora no exemplo do PRD
// (secao 4.2): capacidade 8 com 5 fixos + 2 reposicoes + 1 experimental tem
// total 8 e vagas 0.

export type Composition = {
  fixedCount: number;
  makeupCount: number;
  experimentalCount: number;
  total: number;
  availableSpots: number;
};

export type CompositionInput = {
  capacity: number;
  fixedCount: number;
  makeupCount: number;
  experimentalCount: number;
};

export function calculateComposition(
  input: CompositionInput,
): Composition {
  const total =
    input.fixedCount + input.makeupCount + input.experimentalCount;
  return {
    fixedCount: input.fixedCount,
    makeupCount: input.makeupCount,
    experimentalCount: input.experimentalCount,
    total,
    availableSpots: input.capacity - total,
  };
}
