// Validadores puros de turma (RES-03, RES-04): cada regra recusa no servidor
// apontando o campo invalido. Roda antes da persistencia.

export type ErroValidacaoSlot = { campo: string; mensagem: string };

export type ResultadoValidacaoSlot =
  | { ok: true }
  | { ok: false; erros: ErroValidacaoSlot[] };

export type DadosSlot = {
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
};

function horarioEmMinutos(horario: string): number {
  const [hora, minuto] = horario.split(":").map(Number);
  return hora * 60 + minuto;
}

export function validarSlot(dados: DadosSlot): ResultadoValidacaoSlot {
  const erros: ErroValidacaoSlot[] = [];

  if (dados.weekday < 1 || dados.weekday > 7) {
    erros.push({
      campo: "weekday",
      mensagem: "weekday deve estar entre 1 (domingo) e 7 (sabado)",
    });
  }

  if (horarioEmMinutos(dados.endTime) <= horarioEmMinutos(dados.startTime)) {
    erros.push({
      campo: "endTime",
      mensagem: "endTime deve ser maior que startTime",
    });
  }

  if (dados.capacity < 1) {
    erros.push({
      campo: "capacity",
      mensagem: "capacity deve ser maior ou igual a 1",
    });
  }

  if (erros.length > 0) return { ok: false, erros };
  return { ok: true };
}
