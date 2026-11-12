import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { credits, plans, students } from "../../../../db/schema";
import {
  clearTables,
  createTestClass,
  grantTestCredit,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { createBooking } from "../../../bookings/services/bookings";
import { createEnrollment } from "../enrollments";
import {
  createStudent,
  getStudentProfile,
  listStudents,
  setStudentStatus,
  updateStudent,
  type StudentInput,
} from "../students";

// STUD-01 a STUD-05, STUD-08, PLAN-05: cadastro completo, e-mail unico e o
// perfil agregado do detalhe, contra o Postgres do Testcontainers.

describe("students services", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  async function createTestPlan(
    overrides: Partial<{
      name: string;
      price: string;
      status: "ATIVO" | "INATIVO";
    }> = {},
  ): Promise<{ id: string; name: string; status: string }> {
    const [plan] = await pg.db
      .insert(plans)
      .values({
        name: overrides.name ?? `Plano ${Math.random().toString(16).slice(2, 8)}`,
        price: overrides.price ?? "150.00",
        weeklyFrequency: 2,
        status: overrides.status ?? "ATIVO",
      })
      .returning();
    return plan;
  }

  function studentInput(
    overrides: Partial<StudentInput> = {},
  ): StudentInput {
    const suffix = Math.random().toString(16).slice(2, 8);
    return {
      name: "Maria Silva",
      phone: "11999990000",
      email: `maria-${suffix}@teste.com`,
      birthDate: "1990-05-10",
      status: "EXPERIMENTAL",
      ...overrides,
    };
  }

  it("cria aluna com todos os campos do cadastro (STUD-01)", async () => {
    const plan = await createTestPlan();
    const created = await createStudent(pg.db, {
      name: "Maria Silva",
      phone: "11999990000",
      email: "maria@teste.com",
      birthDate: "1990-05-10",
      enrollmentDate: "2026-01-15",
      planId: plan.id,
      status: "ATIVO",
      notes: "Prefere o turno da manha",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [stored] = await pg.db
      .select()
      .from(students)
      .where(eq(students.id, created.value.id));
    expect(stored.name).toBe("Maria Silva");
    expect(stored.phone).toBe("11999990000");
    expect(stored.email).toBe("maria@teste.com");
    expect(stored.birthDate).toBe("1990-05-10");
    expect(stored.enrollmentDate).toBe("2026-01-15");
    expect(stored.planId).toBe(plan.id);
    expect(stored.status).toBe("ATIVO");
    expect(stored.notes).toBe("Prefere o turno da manha");
  });

  it("recusa cadastro sem campo obrigatorio com erro do campo (STUD-02)", async () => {
    const missingName = await createStudent(pg.db, studentInput({ name: "  " }));
    expect(missingName.ok).toBe(false);
    if (!missingName.ok) expect(missingName.field).toBe("name");

    const missingPhone = await createStudent(pg.db, studentInput({ phone: "" }));
    expect(missingPhone.ok).toBe(false);
    if (!missingPhone.ok) expect(missingPhone.field).toBe("phone");

    const missingEmail = await createStudent(pg.db, studentInput({ email: "" }));
    expect(missingEmail.ok).toBe(false);
    if (!missingEmail.ok) expect(missingEmail.field).toBe("email");

    const missingBirth = await createStudent(
      pg.db,
      studentInput({ birthDate: "31/12/1990" }),
    );
    expect(missingBirth.ok).toBe(false);
    if (!missingBirth.ok) expect(missingBirth.field).toBe("birthDate");

    const activeWithoutPlan = await createStudent(
      pg.db,
      studentInput({ status: "ATIVO", planId: null }),
    );
    expect(activeWithoutPlan.ok).toBe(false);
    if (!activeWithoutPlan.ok) expect(activeWithoutPlan.field).toBe("planId");

    const rows = await pg.db.select().from(students);
    expect(rows).toHaveLength(0);
  });

  it("aceita os 4 status do PRD no cadastro (STUD-03)", async () => {
    for (const status of [
      "EXPERIMENTAL",
      "AGUARDANDO_MATRICULA",
      "INATIVO",
    ] as const) {
      const created = await createStudent(pg.db, studentInput({ status }));
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.value.status).toBe(status);
    }

    // ATIVO so entra com plano
    const plan = await createTestPlan();
    const active = await createStudent(
      pg.db,
      studentInput({ status: "ATIVO", planId: plan.id }),
    );
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(active.value.status).toBe("ATIVO");
  });

  it("recusa e-mail duplicado com erro proprio (STUD-04)", async () => {
    const first = await createStudent(
      pg.db,
      studentInput({ email: "maria@teste.com" }),
    );
    expect(first.ok).toBe(true);

    const duplicate = await createStudent(
      pg.db,
      studentInput({ email: "maria@teste.com", name: "Outra Maria" }),
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.field).toBe("email");
      expect(duplicate.error).toContain("cadastrado");
    }

    const rows = await pg.db.select().from(students);
    expect(rows).toHaveLength(1);
  });

  it("edita a aluna e a mudanca aparece na listagem (STUD-05)", async () => {
    const plan = await createTestPlan({ name: "Mensal 2x" });
    const created = await createStudent(pg.db, studentInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateStudent(pg.db, {
      studentId: created.value.id,
      name: "Maria Silva Souza",
      phone: "11888887777",
      email: "maria.souza@teste.com",
      birthDate: "1990-05-10",
      status: "ATIVO",
      planId: plan.id,
      notes: null,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    const listed = await listStudents(pg.db);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Maria Silva Souza");
    expect(listed[0].email).toBe("maria.souza@teste.com");
    expect(listed[0].status).toBe("ATIVO");
    expect(listed[0].planName).toBe("Mensal 2x");
  });

  it("edita mantendo o proprio e-mail e recusa o de outra aluna (STUD-04)", async () => {
    const created = await createStudent(
      pg.db,
      studentInput({ email: "maria@teste.com" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const other = await createStudent(
      pg.db,
      studentInput({ email: "outra@teste.com" }),
    );
    expect(other.ok).toBe(true);
    if (!other.ok) return;

    const kept = await updateStudent(pg.db, {
      studentId: created.value.id,
      ...studentInput({ email: "maria@teste.com", name: "Maria Editada" }),
    });
    expect(kept.ok).toBe(true);

    const stolen = await updateStudent(pg.db, {
      studentId: created.value.id,
      ...studentInput({ email: "outra@teste.com", name: "Maria Editada" }),
    });
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.field).toBe("email");
  });

  it("setStudentStatus inativa e reativa sem tocar nas matriculas", async () => {
    const created = await createStudent(pg.db, studentInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deactivated = await setStudentStatus(pg.db, {
      studentId: created.value.id,
      status: "INATIVO",
    });
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) return;
    expect(deactivated.value.status).toBe("INATIVO");

    const reactivated = await setStudentStatus(pg.db, {
      studentId: created.value.id,
      status: "ATIVO",
    });
    expect(reactivated.ok).toBe(true);
    if (!reactivated.ok) return;
    expect(reactivated.value.status).toBe("ATIVO");
  });

  it("listagem traz o nome do plano de cada aluna", async () => {
    const plan = await createTestPlan({ name: "Mensal 3x" });
    await createStudent(
      pg.db,
      studentInput({ status: "ATIVO", planId: plan.id }),
    );
    await createStudent(pg.db, studentInput({ email: "sem-plano@teste.com" }));

    const listed = await listStudents(pg.db);
    expect(listed).toHaveLength(2);
    const withPlan = listed.find((student) => student.planId === plan.id);
    expect(withPlan?.planName).toBe("Mensal 3x");
    expect(withPlan?.planStatus).toBe("ATIVO");
    const withoutPlan = listed.find((student) => student.planId === null);
    expect(withoutPlan?.planName).toBeNull();
  });

  it("perfil agrega fixos, creditos e historico (STUD-08)", async () => {
    const plan = await createTestPlan();
    const created = await createStudent(
      pg.db,
      studentInput({ status: "ATIVO", planId: plan.id }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const studentId = created.value.id;

    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, todayInStudio(new Date()));
    const enrollment = await createEnrollment(pg.db, {
      studentId,
      classSlotId: slotId,
      startDate: date,
    });
    expect(enrollment.ok).toBe(true);

    await grantTestCredit(pg.db, studentId);

    // Historico em outra turma: fixo na propria ocorrencia e recusado (RES-17)
    const { slotId: bookingSlotId } = await createTestClass(pg.db, {
      weekday: 4,
      capacity: 8,
    });
    const bookingDate = nextOccurrence({ weekday: 4 }, todayInStudio(new Date()));
    const booking = await createBooking(pg.db, {
      studentId,
      classSlotId: bookingSlotId,
      date: bookingDate,
      type: "EXPERIMENTAL",
    });
    expect(booking.ok).toBe(true);

    const profile = await getStudentProfile(pg.db, studentId);
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;

    expect(profile.value.student.id).toBe(studentId);
    expect(profile.value.plan?.id).toBe(plan.id);
    expect(profile.value.fixedEnrollments).toHaveLength(1);
    expect(profile.value.fixedEnrollments[0].classSlotId).toBe(slotId);
    expect(profile.value.credits).toHaveLength(1);
    expect(profile.value.credits[0].status).toBe("DISPONIVEL");
    expect(profile.value.credits[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(profile.value.bookings).toHaveLength(1);
    expect(profile.value.bookings[0].bookingType).toBe("EXPERIMENTAL");
    expect(profile.value.bookings[0].date).toBe(bookingDate);
  });

  it("perfil mostra o plano mesmo depois de inativado (PLAN-05)", async () => {
    const plan = await createTestPlan();
    const created = await createStudent(
      pg.db,
      studentInput({ status: "ATIVO", planId: plan.id }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await pg.db
      .update(plans)
      .set({ status: "INATIVO" })
      .where(eq(plans.id, plan.id));

    const profile = await getStudentProfile(pg.db, created.value.id);
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.value.plan?.id).toBe(plan.id);
    expect(profile.value.plan?.status).toBe("INATIVO");
  });

  it("perfil lista so os creditos disponiveis", async () => {
    const created = await createStudent(pg.db, studentInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const creditId = await grantTestCredit(pg.db, created.value.id);
    await pg.db
      .update(credits)
      .set({ status: "CANCELADO" })
      .where(eq(credits.id, creditId));
    await grantTestCredit(pg.db, created.value.id);

    const profile = await getStudentProfile(pg.db, created.value.id);
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.value.credits).toHaveLength(1);
    expect(profile.value.credits[0].status).toBe("DISPONIVEL");
  });

  it("perfil de aluna inexistente e recusado", async () => {
    const profile = await getStudentProfile(pg.db, "00000000-0000-0000-0000-000000000000");
    expect(profile.ok).toBe(false);
    if (!profile.ok) expect(profile.error).toContain("nao encontrada");
  });
});
