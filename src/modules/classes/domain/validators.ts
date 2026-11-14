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

/** Horario no formato HH:MM ou HH:MM:SS, dentro do dia. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isValidTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

export function validateSlot(data: SlotData): SlotValidationResult {
  const errors: SlotValidationError[] = [];

  if (!Number.isInteger(data.weekday) || data.weekday < 1 || data.weekday > 7) {
    errors.push({
      field: "weekday",
      message: "weekday deve estar entre 1 (domingo) e 7 (sabado)",
    });
  }

  if (!isValidTime(data.startTime)) {
    errors.push({
      field: "startTime",
      message: "startTime deve ser um horario valido (HH:MM)",
    });
  }

  if (!isValidTime(data.endTime)) {
    errors.push({
      field: "endTime",
      message: "endTime deve ser um horario valido (HH:MM)",
    });
  } else if (
    isValidTime(data.startTime) &&
    timeInMinutes(data.endTime) <= timeInMinutes(data.startTime)
  ) {
    errors.push({
      field: "endTime",
      message: "endTime deve ser maior que startTime",
    });
  }

  if (!Number.isInteger(data.capacity) || data.capacity < 1) {
    errors.push({
      field: "capacity",
      message: "capacity deve ser maior ou igual a 1",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
