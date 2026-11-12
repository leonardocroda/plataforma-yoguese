// Validadores puros de plano (PLAN-02): cada regra recusa no servidor
// apontando o campo invalido. Roda antes da persistencia. O preco vem como
// string (numeric do drizzle e campo de formulario); dinheiro nao vai em
// float, a comparacao decide > 0.

export type PlanValidationError = { field: string; message: string };

export type PlanValidationResult =
  | { ok: true }
  | { ok: false; errors: PlanValidationError[] };

export type PlanData = {
  name: string;
  price: string;
  weeklyFrequency: number;
};

export function validatePlan(data: PlanData): PlanValidationResult {
  const errors: PlanValidationError[] = [];

  if (data.name.trim() === "") {
    errors.push({ field: "name", message: "nome obrigatorio" });
  }

  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push({
      field: "price",
      message: "valor mensal deve ser maior que zero",
    });
  }

  if (!Number.isInteger(data.weeklyFrequency) || data.weeklyFrequency < 1) {
    errors.push({
      field: "weeklyFrequency",
      message: "aulas por semana deve ser maior ou igual a 1",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
