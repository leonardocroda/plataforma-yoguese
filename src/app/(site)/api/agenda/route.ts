import {
  occurrenceDates,
} from "../../../../modules/classes/domain/occurrences";
import {
  getComposition,
} from "../../../../modules/bookings/services/composition";
import {
  listActiveSlots,
} from "../../../../modules/classes/services/classes";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AgendaOccurrence = {
  date: string;
  startTime: string;
  endTime: string;
  classTypeName: string;
  availableSpots: number;
};

/**
 * Agenda publica (RES-25, RES-26): dias, horarios, modalidade e vagas
 * disponiveis de um periodo. Nunca devolve nome nem dado pessoal de aluno -
 * a composicao vem por numero (fonte unica, RES-27). Turma inativa e
 * modalidade inativa nao aparecem, e ocorrencia bloqueada por feriado/recesso
 * ou cancelada tambem nao (AD-014).
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return Response.json(
      {
        error:
          "periodo invalido: informe from e to no formato AAAA-MM-DD",
      },
      { status: 400 },
    );
  }
  if (from > to) {
    return Response.json(
      { error: "periodo invalido: from nao pode ser depois de to" },
      { status: 400 },
    );
  }

  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../../db");
  const slots = await listActiveSlots(db);

  const occurrences: AgendaOccurrence[] = [];
  for (const slot of slots) {
    for (const date of occurrenceDates(slot, from, to)) {
      const composition = await getComposition(db, {
        classSlotId: slot.id,
        date,
      });
      if (!composition.ok) {
        // Ocorrencia sem leitura: no passado so existe se foi materializada,
        // e uma turma desativada no meio da leitura nao gera ocorrencia.
        continue;
      }
      occurrences.push({
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        classTypeName: slot.classTypeName,
        availableSpots: composition.value.availableSpots,
      });
    }
  }

  occurrences.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );

  return Response.json({ from, to, occurrences });
}
