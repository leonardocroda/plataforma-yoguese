// Validadores puros de turma (RES-03, RES-04): cada regra recusa no servidor
// apontando o campo invalido. Roda antes da persistencia.

export type SlotValidationError = { field: string; message: string };

export type SlotValidationResult =
  | { ok: true }
  | { ok: false; errors: SlotValidationError[] };

export type SlotData = {
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
};

function timeInMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateSlot(data: SlotData): SlotValidationResult {
  const errors: SlotValidationError[] = [];

  if (data.weekday < 1 || data.weekday > 7) {
    errors.push({
      field: "weekday",
      message: "weekday deve estar entre 1 (domingo) e 7 (sabado)",
    });
  }

  if (timeInMinutes(data.endTime) <= timeInMinutes(data.startTime)) {
    errors.push({
      field: "endTime",
      message: "endTime deve ser maior que startTime",
    });
  }

  if (data.capacity < 1) {
    errors.push({
      field: "capacity",
      message: "capacity deve ser maior ou igual a 1",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
