import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  experimentals,
  fixedEnrollments,
  plans,
  students,
} from "../../../../db/schema";
import {
  createExperimental,
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  addDays,
  nextOccurrence,
  todayInStudio,
} from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import { listStudents } from "../../../students/services/students";
import { createEnrollment } from "../../../students/services/enrollments";
import { convertExperimental } from "../conversion";

// EXP-50 a EXP-61: a conversao cria a aluna ativa com plano, horarios
// fixos e a declaracao copiada, recusa e-mail e plano invalidos, horario sem
// vaga, conversao antes do fim da aula e segunda conversao - e nada e
// gravado quando a conversao e recusada.

describe("experimental conversion", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  /** Plano de teste, ativo por padrao. */
  async function createPlan(
    status: "ATIVO" | "INATIVO" = "ATIVO",
    weeklyFrequency = 2,
  ) {
    const [plan] = await pg.db
      .insert(plans)
      .values({
        name: `Plano ${Math.random().toString(16).slice(2, 8)}`,
        price: "150.00",
        weeklyFrequency,
        status,
      })
      .returning();
    return plan;
  }

  /**
   * Turma com a ocorrencia passada ja realizada: a materializacao recusa
   * data no passado, entao a linha da ocorrencia entra direto. A data e a
   * quarta anterior, a mesma weekday da turma.
   */
  async function pastOccurrence() {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    const date = addDays(nextOccurrence({ weekday: 3 }, today), -7);
    const [session] = await pg.db
      .insert(classSessions)
      .values({ classSlotId: slotId, sessionDate: date, status: "AGENDADA" })
      .returning();
    return { classTypeId, slotId, date, sessionId: session.id };
  }

  /** Turma com a proxima ocorrencia agendada, no dia da semana dado. */
  async function futureOccurrence(capacity = 8, weekday = 3) {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday,
      capacity,
    });
    const date = nextOccurrence({ weekday }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { classTypeId, slotId, date, sessionId: materialized.value.id };
  }

  /** Experimental aprovada numa ocorrencia que ja acabou. */
  async function approvedExperimental(
    sessionId: string,
    overrides: { name?: string; phone?: string; requestedAt?: Date } = {},
  ) {
    return createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      name: overrides.name ?? "Maria Silva",
      phone: overrides.phone ?? "(11) 98888-7777",
      phoneNormalized: overrides.phone
        ? overrides.phone.replace(/\D/g, "")
        : "11988887777",
      healthDeclaration: "declaracao de saude do PRD",
      requestedAt: overrides.requestedAt ?? new Date("2026-03-01T12:00:00.000Z"),
    });
  }

  it("cria aluna ativa com plano, horarios fixos e declaracao copiada", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    const result = await convertExperimental(pg.db, {
      experimentalId: experimental.id,
      email: "MARIA@TESTE.COM",
      birthDate: "1990-05-10",
      planId: plan.id,
      classSlotIds: [fixo.slotId],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A aluna nasce ATIVA, com o plano escolhido e a matricula de hoje
    const [student] = await pg.db
      .select()
      .from(students)
      .where(eq(students.id, result.value.student.id));
    expect(student.name).toBe("Maria Silva");
    expect(student.phone).toBe("(11) 98888-7777");
    expect(student.email).toBe("maria@teste.com");
    expect(student.birthDate).toBe("1990-05-10");
    expect(student.status).toBe("ATIVO");
    expect(student.planId).toBe(plan.id);
    expect(student.enrollmentDate).toBe(todayInStudio(new Date()));

    // A declaracao de saude e copiada da solicitation, com o instante da
    // solicitacao
    expect(student.healthDeclaration).toBe("declaracao de saude do PRD");
    expect(student.healthDeclarationAcceptedAt?.toISOString()).toBe(
      new Date("2026-03-01T12:00:00.000Z").toISOString(),
    );

    // A matricula fixa do horario escolhido
    const enrollments = await pg.db.select().from(fixedEnrollments);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].studentId).toBe(student.id);
    expect(enrollments[0].classSlotId).toBe(fixo.slotId);
    expect(enrollments[0].status).toBe("ATIVA");

    // A experimental vira CONVERTIDA, com a aluna e a presenca
    const [converted] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));
    expect(converted.status).toBe("CONVERTIDA");
    expect(converted.convertedStudentId).toBe(student.id);
    expect(converted.attendedAt).not.toBeNull();
  });

  it("aluna convertida aparece na listagem e ocupa vaga", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence(4);

    const result = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A listagem de alunas mostra a convertida, com status e plano
    const listagem = await listStudents(pg.db);
    const aluna = listagem.find((item) => item.id === result.value.student.id);
    expect(aluna).toBeTruthy();
    expect(aluna?.status).toBe("ATIVO");
    expect(aluna?.planName).toBe(plan.name);

    // A aluna ocupa vaga na proxima ocorrencia do horario fixo
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: fixo.slotId,
      sessionId: fixo.sessionId,
      date: fixo.date,
      capacity: 4,
    });
    expect(composition.fixedCount).toBe(1);
    expect(composition.total).toBe(1);
    expect(composition.availableSpots).toBe(3);
  });

  it("email duplicado ou invalido recusa e nao cria nada", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    // Ja existe uma aluna com este e-mail
    await pg.db.insert(students).values({
      name: "Outra Maria",
      phone: "11999990000",
      email: "maria@teste.com",
      birthDate: "1988-01-01",
    });

    const duplicado = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "MARIA@TESTE.COM",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(duplicado.ok).toBe(false);
    if (!duplicado.ok) {
      expect(duplicado.field).toBe("email");
      expect(duplicado.error).toContain("cadastrado");
    }

    // O e-mail invalido tambem e recusado, com erro do campo
    const invalido = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "nao-e-email",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(invalido.ok).toBe(false);
    if (!invalido.ok) {
      expect(invalido.field).toBe("email");
    }

    // Nada foi criado: nem aluna nova, nem matricula, nem status trocado
    const alunas = await pg.db.select().from(students);
    expect(alunas).toHaveLength(1);
    expect(alunas[0].name).toBe("Outra Maria");
    expect(await pg.db.select().from(fixedEnrollments)).toHaveLength(0);
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));
    expect(registro.status).toBe("APROVADA");
    expect(registro.convertedStudentId).toBeNull();
  });

  it("plano inexistente ou inativo e recusado", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const fixo = await futureOccurrence();
    const inativo = await createPlan("INATIVO");

    const inexistente = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: crypto.randomUUID(),
        classSlotIds: [fixo.slotId],
      },
    );
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) {
      expect(inexistente.field).toBe("planId");
      expect(inexistente.error).toContain("plano nao encontrado");
    }

    const inativoResult = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: inativo.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(inativoResult.ok).toBe(false);
    if (!inativoResult.ok) {
      expect(inativoResult.field).toBe("planId");
      expect(inativoResult.error).toContain("plano inativo");
    }

    // Nada foi criado
    expect(await pg.db.select().from(students)).toHaveLength(0);
    expect(await pg.db.select().from(fixedEnrollments)).toHaveLength(0);
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));
    expect(registro.status).toBe("APROVADA");
  });

  it("um horario lotado recusa a conversao inteira", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();

    // Um horario fixo com vaga e outro lotado
    const livre = await futureOccurrence(4);
    const lotado = await futureOccurrence(1);
    const [ocupante] = await createStudents(pg.db, 1);
    const enrollment = await createEnrollment(pg.db, {
      studentId: ocupante,
      classSlotId: lotado.slotId,
      startDate: today,
    });
    expect(enrollment.ok).toBe(true);

    const result = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [livre.slotId, lotado.slotId],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("classSlotIds");
      // A recusa nomeia o horario sem vaga
      expect(result.error).toContain("sem vaga no horario");
    }

    // A conversao e transacional: nem a aluna nem as matriculas existem
    const alunas = await pg.db.select().from(students);
    expect(alunas).toHaveLength(1);
    expect(alunas[0].id).toBe(ocupante);
    const enrollments = await pg.db.select().from(fixedEnrollments);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].studentId).toBe(ocupante);
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));
    expect(registro.status).toBe("APROVADA");
    expect(registro.convertedStudentId).toBeNull();
  });

  it("conversao antes do fim ou status nao aprovado e recusada", async () => {
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    // A aula ainda nao acabou: a conversao e recusada
    const futura = await futureOccurrence();
    const experimental = await approvedExperimental(futura.sessionId);
    const antesDoFim = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
      new Date(),
    );
    expect(antesDoFim.ok).toBe(false);
    if (!antesDoFim.ok) {
      expect(antesDoFim.error).toContain("ainda nao foi realizada");
    }

    // O status nao aprovado tambem recusa
    const { sessionId } = await pastOccurrence();
    const pendente = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      name: "Joana Pendente",
      phone: "(11) 97777-6666",
      phoneNormalized: "11977776666",
    });
    const statusRecusado = await convertExperimental(
      pg.db,
      {
        experimentalId: pendente.id,
        email: "joana@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(statusRecusado.ok).toBe(false);
    if (!statusRecusado.ok) {
      expect(statusRecusado.field).toBe("status");
    }

    // Nada foi criado
    expect(await pg.db.select().from(students)).toHaveLength(0);
    expect(await pg.db.select().from(fixedEnrollments)).toHaveLength(0);
  });

  it("segunda conversao e recusada", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    const primeira = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(primeira.ok).toBe(true);

    const segunda = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "outra@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(segunda.ok).toBe(false);
    if (!segunda.ok) {
      expect(segunda.field).toBe("status");
    }

    // Nao existe uma segunda aluna
    expect(await pg.db.select().from(students)).toHaveLength(1);
  });

  it("historico da experimental continua com a aluna convertida", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    const result = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));

    // O historico anterior da solicitation permanece
    expect(registro.name).toBe("Maria Silva");
    expect(registro.phone).toBe("(11) 98888-7777");
    expect(registro.phoneNormalized).toBe("11988887777");
    expect(registro.healthDeclaration).toBe("declaracao de saude do PRD");
    expect(registro.requestedAt.toISOString()).toBe(
      new Date("2026-03-01T12:00:00.000Z").toISOString(),
    );

    // E o vinculo com a aluna convertida
    expect(registro.convertedStudentId).toBe(result.value.student.id);
  });

  it("aluna convertida nao recebe login nesta versao", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan();
    const fixo = await futureOccurrence();

    const result = await convertExperimental(
      pg.db,
      {
        experimentalId: experimental.id,
        email: "maria@teste.com",
        birthDate: "1990-05-10",
        planId: plan.id,
        classSlotIds: [fixo.slotId],
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [aluna] = await pg.db
      .select()
      .from(students)
      .where(eq(students.id, result.value.student.id));

    // Sem user_id: a aluna convertida nao tem acesso nem login (EXP-61)
    expect(aluna.userId).toBeNull();
  });

  it("recusa conversao com mais horarios fixos que a frequencia do plano (PLIM-04)", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan("ATIVO", 2);
    const monday = await futureOccurrence(8, 3);
    const friday = await futureOccurrence(8, 5);
    const saturday = await futureOccurrence(8, 6);

    const result = await convertExperimental(pg.db, {
      experimentalId: experimental.id,
      email: "maria@teste.com",
      birthDate: "1990-05-10",
      planId: plan.id,
      classSlotIds: [monday.slotId, friday.slotId, saturday.slotId],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("classSlotIds");
      // A recusa nomeia o limite do plano e a quantidade escolhida
      expect(result.error).toContain("horarios fixos");
      expect(result.error).toContain("foram escolhidos 3");
    }

    // Nada e criado: nem aluna, nem vinculos, e a experimental segue aprovada
    expect(await pg.db.select().from(students)).toHaveLength(0);
    expect(await pg.db.select().from(fixedEnrollments)).toHaveLength(0);
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id));
    expect(registro.status).toBe("APROVADA");
  });

  it("converte com horarios fixos dentro da frequencia do plano (PLIM-04)", async () => {
    const { sessionId } = await pastOccurrence();
    const experimental = await approvedExperimental(sessionId);
    const plan = await createPlan("ATIVO", 2);
    const monday = await futureOccurrence(8, 3);
    const friday = await futureOccurrence(8, 5);

    const result = await convertExperimental(pg.db, {
      experimentalId: experimental.id,
      email: "maria@teste.com",
      birthDate: "1990-05-10",
      planId: plan.id,
      classSlotIds: [monday.slotId, friday.slotId],
    });

    expect(result.ok).toBe(true);
    const enrollments = await pg.db.select().from(fixedEnrollments);
    expect(enrollments).toHaveLength(2);
  });
});
