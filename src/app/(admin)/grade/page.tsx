import {
  addDays,
  todayInStudio,
  weekdayOf,
} from "../../../modules/classes/domain/occurrences";
import {
  getComposition,
} from "../../../modules/bookings/services/composition";
import {
  listActiveSlots,
} from "../../../modules/classes/services/classes";
import { listActiveStudents } from "../../../modules/students/services/students";
import { OccurrenceForms } from "./booking-forms";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Grade minima do admin (RES-05, RES-08, RES-27): a semana com as turmas
 * ativas e, em cada ocorrencia, as tres perguntas do negocio (quantos
 * fixos, reposicoes e experimentais) e as vagas restantes. Os formularios de
 * reserva manual e de horario fixo apontam para as acoes do modulo.
 */
export default async function AdminGradePage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const today = todayInStudio();
  // Janela de 7 dias comecando hoje: a grade sempre mostra as proximas
  // ocorrencias, mesmo quando a semana de calendario ja terminou.
  const weekStart = today;
  const weekEnd = addDays(today, 6);

  const [slots, students] = await Promise.all([
    listActiveSlots(db),
    listActiveStudents(db),
  ]);

  const days = [];
  for (let index = 0; index < 7; index++) {
    const date = addDays(weekStart, index);
    const occurrences = [];
    for (const slot of slots) {
      if (slot.weekday !== weekdayOf(date)) continue;
      const composition = await getComposition(db, {
        classSlotId: slot.id,
        date,
      });
      // Ocorrencia passada que nunca foi materializada nao tem composicao
      if (!composition.ok) continue;
      occurrences.push({ slot, composition: composition.value });
    }
    days.push({ date, occurrences });
  }

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Grade da semana</h1>
        <p className="text-xs">
          {weekStart} a {weekEnd} - fixos, reposições, experimentais e vagas
          por ocorrência
        </p>
      </header>

      {slots.length === 0 ? (
        <p className="text-sm">Nenhuma turma ativa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((day) => (
            <section
              key={day.date}
              className="rounded-lg border border-[var(--yoguese-bege)] bg-white p-3"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide">
                {WEEKDAY_LABELS[weekdayOf(day.date) - 1]}
              </h2>
              <p className="text-xs opacity-70">{day.date}</p>

              {day.occurrences.length === 0 ? (
                <p className="mt-3 text-xs opacity-60">Sem aulas</p>
              ) : (
                day.occurrences.map((occurrence) => (
                  <article
                    key={occurrence.slot.id}
                    className="mt-3 rounded-md border border-[var(--yoguese-bege)] bg-[var(--yoguese-off-white)] p-3"
                  >
                    <p className="text-sm font-medium">
                      {occurrence.slot.classTypeName}
                    </p>
                    <p className="text-xs opacity-80">
                      {formatTime(occurrence.slot.startTime)} -{" "}
                      {formatTime(occurrence.slot.endTime)}
                    </p>

                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <dt>Fixos</dt>
                        <dd>{occurrence.composition.fixedCount}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Reposições</dt>
                        <dd>{occurrence.composition.makeupCount}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Experimentais</dt>
                        <dd>{occurrence.composition.experimentalCount}</dd>
                      </div>
                      <div className="flex justify-between border-t border-[var(--yoguese-bege)] pt-1 font-medium">
                        <dt>Vagas</dt>
                        <dd>{occurrence.composition.availableSpots}</dd>
                      </div>
                    </dl>

                    {occurrence.composition.sessionStatus === "BLOQUEADA" ? (
                      <p className="mt-2 text-xs text-red-700">
                        Bloqueada por feriado ou recesso
                      </p>
                    ) : null}

                    {occurrence.composition.sessionStatus === "CANCELADA" ? (
                      <p className="mt-2 text-xs text-red-700">
                        Cancelada - a grade da turma mudou
                      </p>
                    ) : null}

                    <OccurrenceForms
                      students={students.map((student) => ({
                        id: student.id,
                        name: student.name,
                      }))}
                      classSlotId={occurrence.slot.id}
                      date={day.date}
                    />
                  </article>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
