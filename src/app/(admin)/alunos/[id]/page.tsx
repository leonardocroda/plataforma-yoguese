import Link from "next/link";
import { getStudentProfileAction } from "../../../../modules/students/actions";
import { STUDIO_TIMEZONE } from "../../../../modules/classes/domain/occurrences";

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
  ATIVO: "Ativa",
  INATIVO: "Inativa",
  ATIVA: "Ativa",
  CANCELADA: "Cancelada",
  FALTA: "Falta",
};

const bookingTypeLabel: Record<string, string> = {
  FIXED: "Fixa",
  MAKEUP: "Reposição",
  EXPERIMENTAL: "Experimental",
};

const blockClass =
  "rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs";

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
 * historico de reservas - consumindo getStudentProfile.
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
      <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
        <p className="text-sm">Aluna não encontrada.</p>
        <p className="mt-2 text-xs">
          <Link href="/alunos" className="underline">
            Voltar para alunas
          </Link>
        </p>
      </main>
    );
  }

  const { student, plan, fixedEnrollments, credits, bookings } = profile.value;

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <p className="text-xs">
          <Link href="/alunos" className="underline">
            Alunas
          </Link>{" "}
          / {student.name}
        </p>
        <h1 className="text-2xl font-light">{student.name}</h1>
      </header>

      <section className="space-y-4">
        <div className={blockClass}>
          <h2 className="text-sm font-medium">Dados cadastrais</h2>
          <dl className="mt-2 grid grid-cols-2 gap-1">
            <dt className="opacity-70">Telefone</dt>
            <dd>{student.phone}</dd>
            <dt className="opacity-70">E-mail</dt>
            <dd>{student.email}</dd>
            <dt className="opacity-70">Nascimento</dt>
            <dd>{formatDate(student.birthDate)}</dd>
            <dt className="opacity-70">Matrícula</dt>
            <dd>{formatDate(student.enrollmentDate)}</dd>
            <dt className="opacity-70">Status</dt>
            <dd>{statusLabel[student.status]}</dd>
            <dt className="opacity-70">Plano</dt>
            {/* A aluna mantem o plano visivel mesmo com ele inativo (PLAN-05) */}
            <dd>
              {plan ? `${plan.name} (${plan.status === "ATIVO" ? "Ativo" : "Inativo"})` : "Sem plano"}
            </dd>
            <dt className="opacity-70">Observações</dt>
            <dd>{student.notes ?? "-"}</dd>
          </dl>
        </div>

        <div className={blockClass}>
          <h2 className="text-sm font-medium">Horários fixos ativos</h2>
          {fixedEnrollments.length === 0 ? (
            <p className="mt-2 opacity-70">Nenhum horário fixo ativo.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {fixedEnrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  {WEEKDAY_LABELS[enrollment.weekday - 1]} das{" "}
                  {formatTime(enrollment.startTime)} às{" "}
                  {formatTime(enrollment.endTime)} -{" "}
                  {enrollment.classTypeName} (desde{" "}
                  {formatDate(enrollment.startDate)})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={blockClass}>
          <h2 className="text-sm font-medium">Créditos disponíveis</h2>
          {credits.length === 0 ? (
            <p className="mt-2 opacity-70">
              Nenhum crédito disponível.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {credits.map((credit) => (
                <li key={credit.id}>
                  Vence em {formatDate(credit.expiresAt)} - origem{" "}
                  {credit.source} (gerado em {formatDate(credit.generatedAt)})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={blockClass}>
          <h2 className="text-sm font-medium">Histórico de reservas</h2>
          {bookings.length === 0 ? (
            <p className="mt-2 opacity-70">
              Nenhuma reserva registrada.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  {formatDate(booking.date)} - {booking.classTypeName} das{" "}
                  {formatTime(booking.startTime)} às{" "}
                  {formatTime(booking.endTime)} -{" "}
                  {bookingTypeLabel[booking.bookingType]} -{" "}
                  {statusLabel[booking.status]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
