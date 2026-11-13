import Link from "next/link";
import { listSelectablePlans } from "../../../modules/plans/services/plans";
import { listStudents } from "../../../modules/students/services/students";
import { Chip } from "../../../modules/ui/components/kit";
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
 *
 * A pele e a do guia: superficie pena com borda preta de 2px no formulario e
 * a lista em divisores, com o status em chip e as acoes em pilula de texto.
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
    <main>
      <header className="mb-6">
        <h1 className="text-[34px]">Alunas</h1>
        <p className="mt-1.5 max-w-[48em] text-[15px] text-[color:var(--cinza)]">
          Cadastro completo com telefone, e-mail, plano, status e observações.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] xl:items-start">
        <section className="rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-5">
          <h2 className="text-[22px]">
            {editingForm ? `Editar ${editingForm.name}` : "Nova aluna"}
          </h2>
          {editingForm ? (
            <>
              <EditStudentForm student={editingForm} plans={editPlans} />
              <p className="mt-3 text-[14px]">
                <Link
                  href="/alunos"
                  className="underline decoration-2 underline-offset-4"
                >
                  Cancelar edição e cadastrar nova
                </Link>
              </p>
            </>
          ) : (
            <CreateStudentForm plans={createPlans} />
          )}
        </section>

        <section>
          <h2 className="text-[22px]">Alunas cadastradas</h2>
          {students.length === 0 ? (
            <p className="mt-2 text-[15px] text-[color:var(--cinza)]">
              Nenhuma aluna cadastrada ainda.
            </p>
          ) : (
            <ul className="mt-2 list-none p-0">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-t-[var(--linha)] py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-extrabold tracking-[-0.02em]">
                      {student.name}
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-[color:var(--cinza)]">
                      {student.planName ?? "Sem plano"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Chip variant={student.status === "ATIVO" ? undefined : "cl"}>
                      {statusLabel[student.status]}
                    </Chip>
                    <Link
                      href={`/alunos/${student.id}`}
                      className="btn btn-txt peq"
                    >
                      Ver detalhe
                    </Link>
                    <Link
                      href={`/alunos?editar=${student.id}`}
                      className="btn btn-txt peq"
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
        </section>
      </div>
    </main>
  );
}
