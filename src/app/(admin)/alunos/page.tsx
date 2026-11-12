import Link from "next/link";
import { listSelectablePlans } from "../../../modules/plans/services/plans";
import { listStudents } from "../../../modules/students/services/students";
import {
  CreateStudentForm,
  EditStudentForm,
  StudentStatusButton,
  type PlanOption,
  type StudentFormData,
} from "./student-forms";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  EXPERIMENTAL: "Experimental",
  AGUARDANDO_MATRICULA: "Aguardando matrícula",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

/**
 * Tela de alunas (STUD-01 a STUD-05): listagem com nome, status e plano,
 * formulario de cadastro completo (PRD 4.4) e edicao pre-preenchida via
 * ?editar=<id>. O seletor de plano usa listSelectablePlans: plano inativo
 * nao e oferecido, mas a aluna em edicao mantem o plano atual (PLAN-04,
 * PLAN-05).
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../../db");

  const params = await searchParams;
  const students = await listStudents(db);
  const editing = params.editar
    ? students.find((student) => student.id === params.editar)
    : undefined;

  const createPlans: PlanOption[] = (await listSelectablePlans(db)).map(
    (plan) => ({ id: plan.id, name: plan.name }),
  );
  // Em edicao, o plano atual entra no seletor mesmo inativo (PLAN-05)
  const editPlans: PlanOption[] = editing
    ? (
        await listSelectablePlans(db, editing.planId ?? undefined)
      ).map((plan) => ({ id: plan.id, name: plan.name }))
    : [];

  const editingForm: StudentFormData | undefined = editing
    ? {
        id: editing.id,
        name: editing.name,
        phone: editing.phone,
        email: editing.email,
        birthDate: editing.birthDate,
        enrollmentDate: editing.enrollmentDate,
        planId: editing.planId,
        status: editing.status,
        notes: editing.notes,
      }
    : undefined;

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-6 text-[var(--yoguese-cinza)]">
      <header className="mb-6">
        <h1 className="text-2xl font-light">Alunas</h1>
        <p className="text-xs">
          Cadastro completo com telefone, e-mail, plano, status e observações
        </p>
      </header>

      <div className="max-w-lg rounded-lg border border-[var(--yoguese-bege)] bg-white p-3">
        <h2 className="text-sm font-medium">
          {editingForm ? `Editar ${editingForm.name}` : "Nova aluna"}
        </h2>
        {editingForm ? (
          <>
            <EditStudentForm student={editingForm} plans={editPlans} />
            <p className="mt-2 text-xs">
              <Link href="/alunos" className="underline">
                Cancelar edição e cadastrar nova
              </Link>
            </p>
          </>
        ) : (
          <CreateStudentForm plans={createPlans} />
        )}
      </div>

      <h2 className="mt-6 text-sm font-medium">Alunas cadastradas</h2>
      {students.length === 0 ? (
        <p className="mt-2 text-xs opacity-70">
          Nenhuma aluna cadastrada ainda.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {students.map((student) => (
            <li
              key={student.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--yoguese-bege)] bg-white p-3 text-xs"
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="opacity-70">Nome</dt>
                <dd>{student.name}</dd>
                <dt className="opacity-70">Status</dt>
                <dd>{statusLabel[student.status]}</dd>
                <dt className="opacity-70">Plano</dt>
                <dd>{student.planName ?? "Sem plano"}</dd>
              </dl>
              <div className="flex items-center gap-2">
                <Link
                  href={`/alunos/${student.id}`}
                  className="rounded border border-[var(--yoguese-bege)] px-2 py-0.5 text-xs hover:bg-[var(--yoguese-off-white)]"
                >
                  Ver detalhe
                </Link>
                <Link
                  href={`/alunos?editar=${student.id}`}
                  className="rounded border border-[var(--yoguese-bege)] px-2 py-0.5 text-xs hover:bg-[var(--yoguese-off-white)]"
                >
                  Editar
                </Link>
                <StudentStatusButton
                  studentId={student.id}
                  status={student.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
