// Dominio puro: composicao e vagas de uma ocorrencia (RES-08, RES-09).
// Fixos derivam de FIXED_ENROLLMENTS ativos na data (e de BOOKINGS FIXED
// individuais desta ocorrencia - RES-14 AC1); reposicoes e experimentais
// derivam de BOOKINGS ativos por tipo. A formula ancora no exemplo do PRD
// (secao 4.2): capacidade 8 com 5 fixos + 2 reposicoes + 1 experimental tem
// total 8 e vagas 0.

export type Composicao = {
  fixos: number;
  reposicoes: number;
  experimentais: number;
  total: number;
  vagas: number;
};

export type EntradaComposicao = {
  capacity: number;
  fixos: number;
  reposicoes: number;
  experimentais: number;
};

export function calcularComposicao(entrada: EntradaComposicao): Composicao {
  const total =
    entrada.fixos + entrada.reposicoes + entrada.experimentais;
  return {
    fixos: entrada.fixos,
    reposicoes: entrada.reposicoes,
    experimentais: entrada.experimentais,
    total,
    vagas: entrada.capacity - total,
  };
}
