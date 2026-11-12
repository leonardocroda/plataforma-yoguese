// Identidade do telefone (PRD 8.2, EXP-07, EXP-08, EXP-10): o telefone
// normalizado e a chave de duplicidade da experimental. A comparacao
// ignora a mascara digitada e o codigo do pais.

const COUNTRY_CODE = "55";
const PHONE_PATTERN = /^\d{10,11}$/;

/**
 * Telefone normalizado: so digitos, sem o codigo do pais. O "55" inicial
 * so sai quando o resto ainda tem 10 ou 11 digitos, para nao mutilar um
 * numero brasileiro que comece com 55.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const rest = digits.slice(COUNTRY_CODE.length);
  if (
    digits.startsWith(COUNTRY_CODE) &&
    (rest.length === 10 || rest.length === 11)
  ) {
    return rest;
  }
  return digits;
}

/** Telefone valido: 10 digitos (fixo com DDD) ou 11 (celular com 9). */
export function isValidPhone(normalized: string): boolean {
  return PHONE_PATTERN.test(normalized);
}
