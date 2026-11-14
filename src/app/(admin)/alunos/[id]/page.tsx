import Link from "next/link";
import { getStudentProfileAction } from "../../../../modules/students/actions";
import { STUDIO_TIMEZONE } from "../../../../modules/classes/domain/occurrences";
import { Chip } from "../../../../modules/ui/components/kit";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const statusLabel: Record<string, string> = {
  EXPERIMENTAL: "Experimental",
  AGUARDANDO_MATRICULA: "Aguardando matrícula",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  ATIVA: "Ativa",
  CANCELADA: "Cancelada",
  FALTA: "Falta",
};

const bookingTypeLabel: Record<string, string> = {
  FIXED: "Fixa",
  MAKEUP: "Reposição",
  EXPERIMENTAL: "Experimental",
};

const sectionClass = "border-t-2 border-t-[var(--preto)] pt-4";
const headingClass = "mb-2 text-[22px]";
const emptyClass = "text-[15px] text-[color:var(--cinza)]";
const listClass = "m-0 list-none p-0 text-[15px]";

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    timeZone: STUDIO_TIMEZONE,
  });
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Detalhe da aluna (STUD-08): os quatro blocos de informacao do perfil -
 * cadastro, horarios fixos ativos, creditos disponiveis com vencimento e
 * historico de reservas - consumindo getStudentProfile. A pele e a do admin
 * do guia: papel, bordas pretas de 2px e listas em divisores.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getStudentProfileAction(id);

  if (!profile.ok) {
    return (
      <main>
        <p className="text-[15px]">Aluna não encontrada.</p>
        <p className="mt-2 text-[14px]">
          <Link
            href="/alunos"
            className="underline decoration-2 underline-offset-4"
          >
            Voltar para alunas
          </Link>
        </p>
      </main>
    );
  }

  const { student, plan, fixedEnrollments, credits, bookings } = profile.value;

  return (
    <main>
      <header className="mb-6">
        <p className="text-[13.5px] text-[color:var(--cinza)]">
          <Link
            href="/alunos"
            className="underline decoration-2 underline-offset-4"
          >
            Alunas
          </Link>{" "}
          / {student.name}
        </p>
        <h1 className="mt-1 text-[34px]">{student.name}</h1>
      </header>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className={sectionClass}>
          <h2 className={headingClass}>Dados cadastrais</h2>
          <dl className="grid grid-cols-[9em_1fr] gap-x-4 gap-y-1 text-[15px]">
            <dt className="text-[color:var(--cinza)]">Telefone</dt>
            <dd>{student.phone}</dd>
            <dt className="text-[color:var(--cinza)]">E-mail</dt>
            <dd>{student.email}</dd>
            <dt className="text-[color:var(--cinza)]">Nascimento</dt>
            <dd>{formatDate(student.birthDate)}</dd>
            <dt className="text-[color:var(--cinza)]">Matrícula</dt>
            <dd>{formatDate(student.enrollmentDate)}</dd>
            <dt className="text-[color:var(--cinza)]">Status</dt>
            <dd>
              <Chip variant={student.status === "ATIVO" ? undefined : "cl"}>
                {statusLabel[student.status]}
              </Chip>
            </dd>
            <dt className="text-[color:var(--cinza)]">Plano</dt>
            {/* A aluna mantem o plano visivel mesmo com ele inativo (PLAN-05) */}
            <dd>
              {plan
                ? `${plan.name} (${plan.status === "ATIVO" ? "Ativo" : "Inativo"})`
                : "Sem plano"}
            </dd>
            <dt className="text-[color:var(--cinza)]">Observações</dt>
            <dd>{student.notes ?? "-"}</dd>
          </dl>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Horários fixos ativos</h2>
          {fixedEnrollments.length === 0 ? (
            <p className={emptyClass}>Nenhum horário fixo ativo.</p>
          ) : (
            <ul className={listClass}>
              {fixedEnrollments.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="border-t border-t-[var(--linha)] py-2 first:border-t-0"
                >
                  {WEEKDAY_LABELS[enrollment.weekday - 1]} das{" "}
                  {formatTime(enrollment.startTime)} às{" "}
                  {formatTime(enrollment.endTime)} -{" "}
                  {enrollment.classTypeName} (desde{" "}
                  {formatDate(enrollment.startDate)})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Créditos disponíveis</h2>
          {credits.length === 0 ? (
            <p className={emptyClass}>Nenhum crédito disponível.</p>
          ) : (
            <ul className={listClass}>
              {credits.map((credit) => (
                <li
                  key={credit.id}
                  className="border-t border-t-[var(--linha)] py-2 first:border-t-0"
                >
                  Vence em {formatDate(credit.expiresAt)} - origem{" "}
                  {credit.source} (gerado em {formatDate(credit.generatedAt)})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Histórico de reservas</h2>
          {bookings.length === 0 ? (
            <p className={emptyClass}>Nenhuma reserva registrada.</p>
          ) : (
            <ul className={listClass}>
              {bookings.map((booking) => (
                <li
                  key={booking.id}
                  className="border-t border-t-[var(--linha)] py-2 first:border-t-0"
                >
                  {formatDate(booking.date)} - {booking.classTypeName} das{" "}
                  {formatTime(booking.startTime)} às{" "}
                  {formatTime(booking.endTime)} -{" "}
                  {bookingTypeLabel[booking.bookingType]} -{" "}
                  {statusLabel[booking.status]}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
