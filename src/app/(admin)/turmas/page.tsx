import {
  listAllClassTypes,
  listAllSlots,
} from "../../../modules/classes/services/classes";
import { Chip } from "../../../modules/ui/components/kit";
import { CreateModalityForm, ModalityCardForms } from "./modality-forms";
import { CreateClassForm } from "./turma-create-form";
import { ClassCardForms } from "./turma-edit-forms";

export const dynamic = "force-dynamic";

// O dia da semana no banco vai de 1 (domingo) a 7 (sabado), como o
// validador de turma (RES-03).
const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function formatTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Tela de turmas (TURM-01, TURM-02): a lista completa de modalidades e
 * turmas, ativas e inativas, para a administradora manter a grade do
 * estudio. A pele e a do admin do guia: superficie pena, lista em divisores,
 * status em chip.
 */
export default async function AdminClassesPage() {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const [classTypes, slots] = await Promise.all([
    listAllClassTypes(db),
    listAllSlots(db),
  ]);

  return (
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Turmas</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          As turmas da grade do estúdio: modalidade, dia, horário e capacidade.
          Turma inativa continua guardada no histórico.
        </p>
      </header>

      <section className="max-w-[520px] rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
        <h2 className="text-[22px]">Criar modalidade</h2>
        <CreateModalityForm />
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Modalidades</h2>
        {classTypes.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Nenhuma modalidade cadastrada ainda.
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {classTypes.map((classType) => (
              <li
                key={classType.id}
                className="border-t border-t-[var(--linha)] py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <p className="text-[19px] font-extrabold tracking-[-0.02em]">
                    {classType.name}
                  </p>
                  <Chip variant={classType.status === "ATIVA" ? undefined : "cl"}>
                    {classType.status === "ATIVA" ? "Ativa" : "Inativa"}
                  </Chip>
                </div>
                <ModalityCardForms
                  classTypeId={classType.id}
                  name={classType.name}
                  status={classType.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 max-w-[640px] rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
        <h2 className="text-[22px]">Criar turma</h2>
        <CreateClassForm
          classTypes={classTypes
            .filter((classType) => classType.status === "ATIVA")
            .map((classType) => ({ id: classType.id, name: classType.name }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Turmas cadastradas</h2>
        {slots.length === 0 ? (
          <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
            Nenhuma turma cadastrada ainda.
          </p>
        ) : (
          <ul className="mt-2 list-none p-0">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="border-t border-t-[var(--linha)] py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <p className="text-[19px] font-extrabold tracking-[-0.02em]">
                    {slot.classTypeName}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tnum text-[15px] font-semibold text-[color:var(--grafite)]">
                      {WEEKDAYS[slot.weekday - 1]} · {formatTime(slot.startTime)}–
                      {formatTime(slot.endTime)}
                    </span>
                    <Chip variant={slot.status === "ATIVA" ? undefined : "cl"}>
                      {slot.status === "ATIVA" ? "Ativa" : "Inativa"}
                    </Chip>
                  </div>
                </div>
                <p className="mt-1 text-[13.5px] text-[color:var(--cinza)]">
                  Capacidade {slot.capacity} alunas
                  {slot.classTypeStatus === "INATIVA"
                    ? " · modalidade inativa"
                    : ""}
                </p>
                <ClassCardForms
                  slotId={slot.id}
                  weekday={slot.weekday}
                  startTime={formatTime(slot.startTime)}
                  endTime={formatTime(slot.endTime)}
                  capacity={slot.capacity}
                  status={slot.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
