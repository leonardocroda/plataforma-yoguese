"use client";

import Link from "next/link";
import {
  Fragment,
  useActionState,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  blockClassSlotDateAction,
  createBookingAction,
  createEnrollmentAction,
  unblockClassSlotDateAction,
} from "../../../modules/classes/actions";
import {
  bookMakeupByAdminAction,
  cancelOccurrenceByStudioAction,
  registerNonAttendanceAction,
} from "../../../modules/credits/actions";
import { weekdayOf } from "../../../modules/classes/domain/occurrences";
import type { CalendarView } from "../../../modules/bookings/domain/calendar";
import { Button, Chip, Field, Toast } from "../../../modules/ui/components/kit";
import { VacancyDucks } from "../../../modules/ui/components/vacancy-ducks";

type ActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "" };

export type StudentOption = {
  id: string;
  name: string;
};

/** Credito DISPONIVEL do aluno, como aparece no select. */
export type CreditOption = {
  id: string;
  label: string;
};

type BookingType = "FIXED" | "MAKEUP" | "EXPERIMENTAL";

/** Um participante da turma, com o vinculo e a vaga que ocupa. */
export type GradeParticipant = {
  id: string;
  name: string;
  kind: "fixo" | "reposição" | "experimental";
};

/** Falta ou cancelamento de uma aula fixa e o credito que ele gerou. */
export type GradeNotice = {
  id: string;
  name: string;
  status: "CANCELADA" | "FALTA";
  creditExpiresAt: string | null;
};

/** Uma ocorrencia da semana, ja no formato que a grade e o painel leem. */
export type GradeOccurrence = {
  key: string;
  classSlotId: string;
  classSessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  classTypeName: string;
  capacity: number;
  sessionStatus: "AGENDADA" | "BLOQUEADA" | "CANCELADA";
  classBlocked: boolean;
  fixedCount: number;
  makeupCount: number;
  experimentalCount: number;
  availableSpots: number;
  fixedStudents: StudentOption[];
  participants: GradeParticipant[];
  notices: GradeNotice[];
  studioCancelled: number;
  studioCredits: number;
};

export type GradeDay = {
  date: string;
  occurrences: GradeOccurrence[];
};

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SLOT_BASE =
  "grid min-h-[72px] content-between gap-1.5 rounded-[var(--r-md)] border-2 px-2 py-2 text-left";
const SLOT_IDLE = `${SLOT_BASE} border-[var(--linha)] bg-[var(--pena)] hover:border-[var(--preto)]`;
const SLOT_PRESSED = `${SLOT_BASE} border-[var(--preto)] bg-[var(--pessego)]`;

/** O slot do guia mostra o tipo curto ("Clássico"/"Intenso"), nao o nome inteiro. */
function shortClassName(name: string): string {
  const match = name.match(/(cl[áa]ssico|intenso)$/i);
  if (!match) return name;
  const kind = match[1].toLowerCase();
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** "19:00" vira "19h"; "19:30" vira "19h30" (voz do guia). */
function hourLabel(time: string): string {
  const [hour, minute] = time.split(":");
  return minute && minute !== "00" ? `${hour}h${minute}` : `${hour}h`;
}

/** "2026-11-13" vira "13/11". */
function dayLabel(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function occurrenceTitle(occurrence: GradeOccurrence): string {
  return `${WEEKDAYS[weekdayOf(occurrence.date) - 1]}, ${hourLabel(occurrence.startTime)}`;
}

/**
 * A grade do admin (guia, tela "Admin: calendário e turma"): a semana com os
 * 8 patinhos de cada horario a esquerda e a turma escolhida a direita, com o
 * quadro de alunos, os avisos e os formularios da ocorrencia. Escolher um
 * horario troca o painel - nenhuma acao muda de comportamento.
 */
export function GradeBoard({
  days,
  students,
  creditsByStudent,
  period,
  selectedKey,
  view,
  date,
  today,
}: {
  days: GradeDay[];
  students: StudentOption[];
  creditsByStudent: Record<string, CreditOption[]>;
  period: string;
  selectedKey?: string;
  view: CalendarView;
  date: string;
  today: string;
}) {
  const router = useRouter();
  const occurrences = days.flatMap((day) => day.occurrences);
  const current =
    occurrences.find((occurrence) => occurrence.key === selectedKey) ??
    occurrences[0];
  const times = Array.from(
    new Set(occurrences.map((occurrence) => occurrence.startTime)),
  ).sort();

  return (
    <div className="grid overflow-hidden rounded-[var(--r-lg)] border-2 border-[var(--preto)] xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      <section className="border-b-2 border-[var(--preto)] p-6 xl:border-b-0 xl:border-r-2 xl:p-7">
        <h1 className="text-[34px]">Semana</h1>
        <p className="mt-1.5 text-[15px] text-[color:var(--cinza)]">
          {period}. Cada horário mostra as 8 vagas da turma.
        </p>

        {occurrences.length === 0 ? (
          <p className="mt-6 text-[15px] text-[color:var(--cinza)]">
            Nenhuma turma ativa cadastrada.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <div className="grid min-w-[600px] grid-cols-[34px_repeat(7,minmax(0,1fr))] gap-1.5 text-[13.5px]">
              <span aria-hidden="true" />
              {days.map((day) => (
                <div
                  key={day.date}
                  className="pb-1 text-center font-semibold text-[color:var(--cinza)]"
                >
                  <span className="block">
                    {WEEKDAYS_SHORT[weekdayOf(day.date) - 1]}
                  </span>
                  <span className="block text-[11.5px] font-normal">
                    {dayLabel(day.date)}
                  </span>
                </div>
              ))}

              {times.map((time) => (
                <Fragment key={time}>
                  <div className="pt-2.5 pr-1.5 text-right font-semibold text-[color:var(--cinza)]">
                    {hourLabel(time)}
                  </div>
                  {days.map((day) => {
                    const cell = day.occurrences.filter(
                      (occurrence) => occurrence.startTime === time,
                    );
                    if (cell.length === 0) {
                      return (
                        <div
                          key={`${day.date}|${time}`}
                          aria-hidden="true"
                          className="min-h-[72px] rounded-[var(--r-md)] border-2 border-dashed border-[var(--linha)]"
                        />
                      );
                    }
                    return (
                      <div key={`${day.date}|${time}`} className="grid gap-1.5">
                        {cell.map((occurrence) => (
                          <button
                            key={occurrence.key}
                            type="button"
                            aria-pressed={occurrence.key === current?.key}
                            aria-label={`${occurrenceTitle(occurrence)}, ${occurrence.classTypeName}, ${occurrence.availableSpots} vagas livres de ${occurrence.capacity}`}
                            onClick={() => {
                              const params = new URLSearchParams({
                                view,
                                data: date,
                                ocorrencia: occurrence.key,
                              });
                              router.push(`/grade?${params.toString()}`);
                            }}
                            className={
                              occurrence.key === current?.key
                                ? SLOT_PRESSED
                                : SLOT_IDLE
                            }
                          >
                            <span className="truncate text-[13.5px] font-extrabold tracking-[-0.01em]">
                              {shortClassName(occurrence.classTypeName)}
                            </span>
                            <VacancyDucks
                              fixed={occurrence.fixedCount}
                              makeup={occurrence.makeupCount}
                              experimental={occurrence.experimentalCount}
                              capacity={occurrence.capacity}
                              size="sm"
                            />
                            {occurrence.sessionStatus !== "AGENDADA" ? (
                              <span className="text-[11px] font-semibold text-[color:var(--erro)]">
                                {occurrence.sessionStatus === "BLOQUEADA"
                                  ? "Bloqueada"
                                  : "Cancelada"}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="bg-[var(--papel-2)] p-6 xl:p-7" aria-live="polite">
        {current ? (
          <TurmaPanel
            occurrence={current}
            students={students}
            creditsByStudent={creditsByStudent}
            readOnly={current.date < today}
          />
        ) : (
          <p className="text-[15px] text-[color:var(--cinza)]">
            Escolha um horário na semana para ver a turma.
          </p>
        )}
      </aside>
    </div>
  );
}

export function TurmaPanel({
  occurrence,
  students,
  creditsByStudent,
  readOnly = false,
}: {
  occurrence: GradeOccurrence;
  students: StudentOption[];
  creditsByStudent: Record<string, CreditOption[]>;
  readOnly?: boolean;
}) {
  const fixed = occurrence.participants.filter(
    (participant) => participant.kind === "fixo",
  );
  const makeup = occurrence.participants.filter(
    (participant) => participant.kind === "reposição",
  );
  const experimental = occurrence.participants.filter(
    (participant) => participant.kind === "experimental",
  );
  const hasNotices =
    occurrence.notices.length > 0 ||
    occurrence.studioCancelled > 0 ||
    occurrence.studioCredits > 0;

  return (
    <>
      <h2 className="text-[26px] tracking-[-0.03em] xl:text-[30px]">
        {occurrenceTitle(occurrence)}
      </h2>
      <p className="mt-1 text-[15px] text-[color:var(--cinza)]">
        {occurrence.classTypeName} · {formatDate(`${occurrence.date}T12:00:00`)}
      </p>

      {occurrence.sessionStatus === "BLOQUEADA" ? (
        <p className="mt-2 text-[14.5px] font-medium text-[color:var(--erro)]">
          Bloqueada nesta data.
        </p>
      ) : null}
      {occurrence.sessionStatus === "CANCELADA" ? (
        <p className="mt-2 text-[14.5px] font-medium text-[color:var(--erro)]">
          Cancelada: a grade da turma mudou.
        </p>
      ) : null}

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <b className="text-[40px] font-extrabold leading-none tracking-[-0.04em]">
            {occurrence.availableSpots}
          </b>
          <span className="text-[15px] text-[color:var(--cinza)]">
            {occurrence.availableSpots === 1 ? "vaga livre" : "vagas livres"}
          </span>
        </div>
        <div className="mt-3">
          <VacancyDucks
            fixed={occurrence.fixedCount}
            makeup={occurrence.makeupCount}
            experimental={occurrence.experimentalCount}
            capacity={occurrence.capacity}
            size="lg"
          />
        </div>
      </div>

      <RosterGroup
        variant="fixo"
        label="Fixo"
        count={occurrence.fixedCount}
        empty="Nenhum aluno fixo nesta turma."
      >
        {fixed.map((participant) => (
          <li
            key={`fixo-${participant.id}`}
            className="flex items-center justify-between gap-2.5 border-t border-t-[var(--linha)] py-2 text-[15px]"
          >
            <span>{participant.name}</span>
            <Link
              href={`/alunos/${participant.id}`}
              className="btn btn-txt peq"
            >
              Ver cadastro
            </Link>
          </li>
        ))}
      </RosterGroup>

      {makeup.length > 0 ? (
        <RosterGroup
          variant="rep"
          label="Reposição"
          count={occurrence.makeupCount}
        >
          {makeup.map((participant) => (
            <li
              key={`rep-${participant.id}`}
              className="flex items-center justify-between gap-2.5 border-t border-t-[var(--linha)] py-2 text-[15px]"
            >
              <span>{participant.name}</span>
              <Chip variant="cl">Confirmada</Chip>
            </li>
          ))}
        </RosterGroup>
      ) : null}

      {experimental.length > 0 ? (
        <RosterGroup
          variant="exp"
          label="Experimental"
          count={occurrence.experimentalCount}
        >
          {experimental.map((participant) => (
            <li
              key={`exp-${participant.id}`}
              className="flex items-center justify-between gap-2.5 border-t border-t-[var(--linha)] py-2 text-[15px]"
            >
              <span>{participant.name}</span>
            </li>
          ))}
        </RosterGroup>
      ) : null}

      {hasNotices ? (
        <div className="mt-4 border-t-2 border-t-[var(--preto)] pt-3 text-[13.5px] text-[color:var(--grafite)]">
          {occurrence.notices.map((notice) => (
            <p key={notice.id}>
              {notice.name}:{" "}
              {notice.status === "FALTA" ? "falta" : "cancelamento"},{" "}
              {notice.creditExpiresAt
                ? `crédito gerado, vence em ${notice.creditExpiresAt}`
                : "sem crédito"}
            </p>
          ))}
          {occurrence.studioCancelled > 0 ? (
            <p>
              {occurrence.studioCancelled} reservas canceladas pelo estúdio
            </p>
          ) : null}
          {occurrence.studioCredits > 0 ? (
            <p>{occurrence.studioCredits} créditos do estúdio gerados</p>
          ) : null}
        </div>
      ) : null}

      {readOnly ? (
        <div className="mt-5 border-t-2 border-t-[var(--preto)] pt-4">
          <p className="text-[14px] font-semibold text-[color:var(--cinza)]">
            Esta data já passou. A turma aparece em modo de leitura.
          </p>
        </div>
      ) : (
        <div className="mt-5 border-t-2 border-t-[var(--preto)] pt-4">
          {occurrence.sessionStatus !== "CANCELADA" ? (
            <div className="mb-5">
              <h3 className="text-[20px]">Bloqueio nesta data</h3>
              <OccurrenceBlockForm
                classSlotId={occurrence.classSlotId}
                date={occurrence.date}
                classBlocked={occurrence.classBlocked}
              />
            </div>
          ) : null}
          <h3 className="text-[20px]">Adicionar agendamento</h3>
          <OccurrenceForms
            students={students}
            fixedStudents={occurrence.fixedStudents}
            creditsByStudent={creditsByStudent}
            classSlotId={occurrence.classSlotId}
            classSessionId={occurrence.classSessionId}
            date={occurrence.date}
            quando={occurrenceTitle(occurrence)}
          />
        </div>
      )}
    </>
  );
}

function RosterGroup({
  variant,
  label,
  count,
  empty,
  children,
}: {
  variant: "fixo" | "rep" | "exp";
  label: string;
  count: number;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <Chip>
        <VacancyDucks
          fixed={variant === "fixo" ? count : 0}
          makeup={variant === "rep" ? count : 0}
          experimental={variant === "exp" ? count : 0}
          size="xs"
          label={`${count} ${label.toLowerCase()} na turma`}
        />
        {label} · {count}
      </Chip>
      <ul className="m-0 list-none p-0">
        {count === 0 && empty ? (
          <li className="border-t border-t-[var(--linha)] py-2 text-[15px] text-[color:var(--cinza)]">
            {empty}
          </li>
        ) : (
          children
        )}
      </ul>
    </div>
  );
}

/**
 * Bloqueia ou desbloqueia a propria turma em uma data. A action mantem as
 * regras de reservas e creditos; o refresh devolve a occorrencia atualizada.
 */
function OccurrenceBlockForm({
  classSlotId,
  date,
  classBlocked,
}: {
  classSlotId: string;
  date: string;
  classBlocked: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const intent = String(formData.get("intent"));
      const result =
        intent === "unblock"
          ? await unblockClassSlotDateAction({ classSlotId, date })
          : await blockClassSlotDateAction({ classSlotId, date });
      if (!result.ok) return { ok: false, message: result.error };
      return {
        ok: true,
        message:
          intent === "unblock"
            ? "Bloqueio da turma nesta data removido."
            : "Turma bloqueada nesta data.",
      };
    },
    INITIAL_STATE,
  );

  // O refresh depende do estado inteiro: bloquear e desbloquear em sequência
  // precisa atualizar a grade duas vezes, mesmo com `ok` sempre verdadeiro.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="mt-3">
      <input
        type="hidden"
        name="intent"
        value={classBlocked ? "unblock" : "block"}
      />
      <Button type="submit" variant="sec" small disabled={pending}>
        {pending
          ? classBlocked
            ? "Removendo…"
            : "Bloqueando…"
          : classBlocked
            ? "Remover bloqueio"
            : "Bloquear nesta data"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Formularios minimos do admin para uma ocorrencia: reserva manual (com a
 * reposicao manual, que exige um credito DISPONIVEL do aluno), horario fixo,
 * aviso de nao comparecimento e cancelamento da aula pelo estudio. Sucesso
 * confirma na pilula preta do guia; o erro do servico aparece em texto puro
 * no token de erro.
 */
export function OccurrenceForms({
  students,
  classSlotId,
  date,
  classSessionId,
  fixedStudents = [],
  creditsByStudent = {},
  quando = "",
}: {
  students: StudentOption[];
  classSlotId: string;
  date: string;
  /** Ocorrencia materializada: exigida pelos forms de credito. */
  classSessionId?: string;
  /** Alunos fixos da ocorrencia: os candidatos ao aviso de nao comparecimento. */
  fixedStudents?: StudentOption[];
  /** Creditos DISPONIVEL por aluno, para a reposicao manual. */
  creditsByStudent?: Record<string, CreditOption[]>;
  /** Dia e hora da ocorrencia, para o feedback nomear a turma. */
  quando?: string;
}) {
  const router = useRouter();
  const quandoLabel = quando;

  // A reserva manual e a reposicao manual compartilham o form: quando o tipo
  // e MAKEUP o admin escolhe o credito do aluno (CRD-43).
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<BookingType>("MAKEUP");
  const [creditId, setCreditId] = useState("");
  const credits = studentId ? (creditsByStudent[studentId] ?? []) : [];

  const [booking, bookingAction, bookingPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const selectedStudent = String(formData.get("studentId"));
    const selectedType = String(formData.get("type")) as BookingType;
    const selectedCredit = String(formData.get("creditId") ?? "");

    if (selectedType === "MAKEUP") {
      // A reposicao manual so confirma com um credito escolhido (CRD-43)
      if (!selectedCredit) {
        return {
          ok: false,
          message: "Escolha o crédito do aluno para a reposição.",
        };
      }
      const result = await bookMakeupByAdminAction({
        studentId: selectedStudent,
        classSlotId,
        date,
        creditId: selectedCredit,
      });
      return result.ok
        ? { ok: true, message: "Reposição manual confirmada." }
        : { ok: false, message: result.error };
    }

    const result = await createBookingAction({
      studentId: selectedStudent,
      classSlotId,
      date,
      type: selectedType,
    });
    if (!result.ok) return { ok: false, message: result.error };
    // O guia nomeia a turma no feedback: "Reserva confirmada para segunda, 19h."
    const quando = quandoLabel || dayLabel(date);
    return {
      ok: true,
      message: `Reserva confirmada para ${quando.toLowerCase()}.`,
    };
  }, INITIAL_STATE);

  const [enrollment, enrollmentAction, enrollmentPending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await createEnrollmentAction({
      studentId: String(formData.get("studentId")),
      classSlotId,
      startDate: date,
    });
    return result.ok
      ? { ok: true, message: "Horário fixo vinculado." }
      : { ok: false, message: result.error };
  }, INITIAL_STATE);

  const [absence, absenceAction, absencePending] = useActionState<
    ActionState,
    FormData
  >(async (_previous, formData) => {
    const result = await registerNonAttendanceAction({
      studentId: String(formData.get("studentId")),
      classSessionId: classSessionId ?? "",
    });
    if (!result.ok) return { ok: false, message: result.error };
    const { status, credit, noticeHours } = result.value;
    const hours = Math.floor(noticeHours);
    const outcome = status === "CANCELADA" ? "Cancelamento" : "Falta";
    // Com 24h ou mais o aluno recebe o credito; com menos, e falta sem credito
    return credit
      ? {
          ok: true,
          message: `${outcome} registrado (${hours}h de antecedência): crédito gerado, vence em ${formatDate(credit.expiresAt)}.`,
        }
      : {
          ok: true,
          message: `${outcome} registrado (${hours}h de antecedência): sem crédito.`,
        };
  }, INITIAL_STATE);

  const [cancellation, cancellationAction, cancellationPending] =
    useActionState<ActionState, FormData>(async () => {
      const result = await cancelOccurrenceByStudioAction({
        classSessionId: classSessionId ?? "",
      });
      if (!result.ok) return { ok: false, message: result.error };
      const { cancelledBookings, grantedCredits, returnedCredits } =
        result.value;
      return {
        ok: true,
        message: `Ocorrência cancelada: 1. Reservas canceladas: ${cancelledBookings}. Créditos devolvidos: ${returnedCredits}. Créditos gerados: ${grantedCredits}.`,
      };
    }, INITIAL_STATE);

  useEffect(() => {
    if (
      booking.ok ||
      enrollment.ok ||
      absence.ok ||
      cancellation.ok
    ) {
      router.refresh();
    }
  }, [
    booking.ok,
    enrollment.ok,
    absence.ok,
    cancellation.ok,
    router,
  ]);

  if (students.length === 0) {
    return (
      <p className="mt-3 text-[15px] text-[color:var(--cinza)]">
        Nenhum aluno ativo cadastrado.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-5">
      <form action={bookingAction}>
        <Field label="Reserva manual" id="grade-aluno">
          <select
            id="grade-aluno"
            name="studentId"
            required
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              setCreditId("");
            }}
          >
            <option value="">Selecione o aluno</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo" id="grade-tipo">
          <select
            id="grade-tipo"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as BookingType)}
          >
            <option value="FIXED">Aula fixa</option>
            <option value="MAKEUP">Reposição</option>
            <option value="EXPERIMENTAL">Experimental</option>
          </select>
        </Field>
        {type === "MAKEUP" ? (
          <Field label="Crédito da reposição" id="grade-credito">
            <select
              id="grade-credito"
              name="creditId"
              value={creditId}
              onChange={(event) => setCreditId(event.target.value)}
            >
              <option value="">Selecione o crédito</option>
              {credits.map((credit) => (
                <option key={credit.id} value={credit.id}>
                  {credit.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {type === "MAKEUP" ? (
          <p className="mb-4 text-[13.5px] text-[color:var(--cinza)]">
            A reposição manual usa um crédito de reposição do aluno que você
            escolher.
          </p>
        ) : null}
        <Button type="submit" variant="sec" small disabled={bookingPending}>
          {bookingPending ? "Reservando…" : "Reservar"}
        </Button>
        <Feedback state={booking} duck />
      </form>

      <form action={enrollmentAction}>
        <Field label="Horário fixo" id="grade-fixo">
          <select id="grade-fixo" name="studentId" required defaultValue="">
            <option value="">Selecione o aluno</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
        <Button
          type="submit"
          variant="sec"
          small
          disabled={enrollmentPending}
        >
          {enrollmentPending ? "Vinculando…" : "Vincular fixo"}
        </Button>
        <Feedback state={enrollment} />
      </form>

      {classSessionId ? (
        <form action={absenceAction}>
          <Field label="Avisar que não vou" id="grade-aviso">
            <select id="grade-aviso" name="studentId" required defaultValue="">
              <option value="">Selecione o aluno fixo</option>
              {fixedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="sec" small disabled={absencePending}>
            {absencePending ? "Registrando…" : "Registrar aviso"}
          </Button>
          <Feedback state={absence} />
        </form>
      ) : null}

      {classSessionId ? (
        <form action={cancellationAction}>
          <Button
            type="submit"
            variant="sec"
            small
            disabled={cancellationPending}
          >
            {cancellationPending ? "Cancelando…" : "Cancelar aula"}
          </Button>
          <Feedback state={cancellation} />
        </form>
      ) : null}
    </div>
  );
}

/** Sucesso na pilula preta do guia; falha em texto puro no token de erro. */
function Feedback({
  state,
  duck = false,
}: {
  state: ActionState;
  /** O guia mostra o patinho da vaga na confirmacao da reserva. */
  duck?: boolean;
}) {
  if (!state.message) return null;
  if (state.ok) {
    return (
      <div className="mt-3">
        <Toast>
          {duck ? (
            <VacancyDucks own size="xs" label="a vaga desta pessoa" />
          ) : null}
          {state.message}
        </Toast>
      </div>
    );
  }
  return (
    <p
      role="alert"
      className="mt-2 text-[14px] font-medium text-[color:var(--erro)]"
    >
      {state.message}
    </p>
  );
}
