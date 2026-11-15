import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedEnrollments } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { addDays, todayInStudio, nextOccurrence } from "../../../classes/domain/occurrences";
import { createBooking } from "../../../bookings/services/bookings";
import { getComposition } from "../../../bookings/services/composition";
import { createEnrollment, endEnrollment, listEnrollmentsByStudent } from "../enrollments";

describe("enrollments", () => {
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

  async function base(capacity: number) {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity });
    return { slotId, date: nextOccurrence({ weekday: 3 }, today) };
  }

  it("creates and counts from the start_date", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.startDate).toBe(date);
      expect(created.value.endDate).toBeNull();
      expect(created.value.status).toBe("ATIVA");
    }

    // O fixo ocupa vaga na propria data inicial: segundo fixo recusa
    const secondAttempt = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) {
      expect(secondAttempt.error).toContain("sem vaga");
    }
  });

  it("rejects a full class at the next occurrence", async () => {
    const { slotId, date } = await base(1);
    const [occupant, wantsFixed] = await createStudents(pg.db, 2);

    const booking = await createBooking(pg.db, {
      studentId: occupant,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, occupant),
    });
    expect(booking.ok).toBe(true);

    const result = await createEnrollment(pg.db, {
      studentId: wantsFixed,
      classSlotId: slotId,
      startDate: date,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(0);
  });

  it("capacity is checked before writing", async () => {
    const { slotId, date } = await base(2);
    const [fixed, occupant, third] = await createStudents(pg.db, 3);

    const first = await createEnrollment(pg.db, {
      studentId: fixed,
      classSlotId: slotId,
      startDate: date,
    });
    expect(first.ok).toBe(true);

    const booking = await createBooking(pg.db, {
      studentId: occupant,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, occupant),
    });
    expect(booking.ok).toBe(true);

    // segundo fixo estouraria a capacidade -> recusado sem estado parcial
    const excess = await createEnrollment(pg.db, {
      studentId: third,
      classSlotId: slotId,
      startDate: date,
    });
    expect(excess.ok).toBe(false);
    if (!excess.ok) {
      expect(excess.error).toContain("sem vaga");
    }

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(1);
  });

  it("counts an active enrollment as fixed and stops counting after it ends", async () => {
    const { slotId, date } = await base(8);
    const [a] = await createStudents(pg.db, 1);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);

    // Enrollment ativo conta como fixo e ocupa a vaga
    const active = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.value.fixedCount).toBe(1);
      expect(active.value.makeupCount).toBe(0);
      expect(active.value.total).toBe(1);
      expect(active.value.availableSpots).toBe(7);
    }

    // Enrollment encerrado deixa de contar na mesma data
    const ended = await endEnrollment(pg.db, created.ok ? created.value.id : "");
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.status).toBe("INATIVA");
    }

    const after = await getComposition(pg.db, { classSlotId: slotId, date });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value.fixedCount).toBe(0);
      expect(after.value.makeupCount).toBe(0);
      expect(after.value.total).toBe(0);
      expect(after.value.availableSpots).toBe(8);
    }
  });

  it("an ended enrollment leaves the date count", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);

    const ended = await endEnrollment(pg.db, created.ok ? created.value.id : "");
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.status).toBe("INATIVA");
    }

    // Com o fixo encerrado, a vaga volta: o proximo aluno cria
    const next = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(next.ok).toBe(true);
  });

  it("end_date removes the count after the end", async () => {
    const { slotId, date } = await base(1);
    const [a, b] = await createStudents(pg.db, 2);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);

    // end_date no proprio dia da proxima ocorrencia: a partir da data
    // encerrada o fixo deixa de contar (RES-23 AC4)
    const ended = await endEnrollment(
      pg.db,
      created.ok ? created.value.id : "",
      { date },
    );
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.endDate).toBe(date);
    }

    const next = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;

    // RES-23 tem dois lados: endDate futura AINDA ocupa a vaga ate a data
    // chegar, e a partir da data encerrada ela se libera
    const futureEnd = await endEnrollment(pg.db, next.value.id, {
      date: addDays(date, 7),
    });
    expect(futureEnd.ok).toBe(true);
    if (futureEnd.ok) {
      expect(futureEnd.value.endDate).toBe(addDays(date, 7));
    }

    const [c] = await createStudents(pg.db, 1);
    const blocked = await createEnrollment(pg.db, {
      studentId: c,
      classSlotId: slotId,
      startDate: date,
    });
    expect(blocked.ok).toBe(false);

    const freed = await createEnrollment(pg.db, {
      studentId: c,
      classSlotId: slotId,
      startDate: addDays(date, 7),
    });
    expect(freed.ok).toBe(true);

    const [total] = await pg.db
      .select({ total: count() })
      .from(fixedEnrollments);
    expect(Number(total?.total)).toBe(3);
  });

  it("refuses an end date before the start date", async () => {
    const { slotId, date } = await base(8);
    const [a] = await createStudents(pg.db, 1);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // FIX-03: data de encerramento anterior ao inicio recusa sem alterar
    const backdated = await endEnrollment(pg.db, created.value.id, {
      date: addDays(date, -1),
    });
    expect(backdated.ok).toBe(false);
    if (!backdated.ok) {
      expect(backdated.error).toContain("anterior");
    }

    const [row] = await pg.db
      .select()
      .from(fixedEnrollments)
      .where(eq(fixedEnrollments.id, created.value.id));
    expect(row?.endDate).toBeNull();
    expect(row?.status).toBe("ATIVA");

    // Borda aceita: encerrar no proprio dia de inicio
    const sameDay = await endEnrollment(pg.db, created.value.id, { date });
    expect(sameDay.ok).toBe(true);
    if (sameDay.ok) {
      expect(sameDay.value.endDate).toBe(date);
    }
  });

  it("refuses ending an already ended or missing enrollment", async () => {
    const { slotId, date } = await base(8);
    const [a] = await createStudents(pg.db, 1);

    const created = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: slotId,
      startDate: date,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await endEnrollment(pg.db, created.value.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // FIX-05, branch por status: re-encerrar um vinculo encerrado por
    // status recusa no servidor
    const again = await endEnrollment(pg.db, created.value.id);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error).toContain("ja encerrado");
    }

    // FIX-05, branch por data: um SEGUNDO vinculo encerrado POR DATA
    // recusa as duas re-tentativas, e a recusa cita a data gravada
    const [b] = await createStudents(pg.db, 1);
    const second = await createEnrollment(pg.db, {
      studentId: b,
      classSlotId: slotId,
      startDate: date,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const datedEnd = await endEnrollment(pg.db, second.value.id, { date });
    expect(datedEnd.ok).toBe(true);
    if (!datedEnd.ok) return;

    const reDated = await endEnrollment(pg.db, second.value.id, {
      date: addDays(date, 1),
    });
    expect(reDated.ok).toBe(false);
    if (!reDated.ok) {
      expect(reDated.error).toContain(`ja encerrado em ${date}`);
    }

    const reStatus = await endEnrollment(pg.db, second.value.id);
    expect(reStatus.ok).toBe(false);
    if (!reStatus.ok) {
      expect(reStatus.error).toContain(`ja encerrado em ${date}`);
    }

    const missing = await endEnrollment(
      pg.db,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).toContain("nao encontrado");
    }
  });

  it("student history", async () => {
    const classA = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const classB = await createTestClass(pg.db, { weekday: 5, capacity: 8 });
    const [a, lonely] = await createStudents(pg.db, 2);
    // A data de B e buscada depois da de A: a ordenacao do historico (por
    // startDate asc) nao pode depender do dia da semana em que a suite roda
    const dateA = nextOccurrence({ weekday: 3 }, today);
    const dateB = nextOccurrence({ weekday: 5 }, addDays(dateA, 1));

    const fixedA = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: classA.slotId,
      startDate: dateA,
    });
    expect(fixedA.ok).toBe(true);
    const fixedB = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: classB.slotId,
      startDate: dateB,
    });
    expect(fixedB.ok).toBe(true);
    if (fixedB.ok) {
      // Ativo e encerrado vazam no historico (RES-24)
      await endEnrollment(pg.db, fixedB.value.id);
    }

    const history = await listEnrollmentsByStudent(pg.db, a);
    expect(history).toHaveLength(2);
    expect(history[0].classSlotId).toBe(classA.slotId);
    expect(history[0].startDate).toBe(dateA);
    expect(history[0].status).toBe("ATIVA");
    expect(history[0].endDate).toBeNull();
    expect(history[1].classSlotId).toBe(classB.slotId);
    expect(history[1].startDate).toBe(dateB);
    expect(history[1].status).toBe("INATIVA");

    const empty = await listEnrollmentsByStudent(pg.db, lonely);
    expect(empty).toHaveLength(0);
  });

  it("allows exactly the plan frequency of active enrollments", async () => {
    // PLIM-01: plano de 2x/semana comporta 2 vinculos fixos ativos
    const [a] = await createStudents(pg.db, 1, {
      plan: { weeklyFrequency: 2 },
    });
    const monday = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const friday = await createTestClass(pg.db, { weekday: 5, capacity: 8 });

    const first = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: monday.slotId,
      startDate: nextOccurrence({ weekday: 3 }, today),
    });
    expect(first.ok).toBe(true);

    const second = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: friday.slotId,
      startDate: nextOccurrence({ weekday: 5 }, today),
    });
    expect(second.ok).toBe(true);

    const history = await listEnrollmentsByStudent(pg.db, a);
    expect(history).toHaveLength(2);
  });

  it("refuses the enrollment beyond the plan frequency naming the plan and the count", async () => {
    // PLIM-02: o 3o vinculo de um plano 2x recusa nomeando plano e contagem
    const [a] = await createStudents(pg.db, 1, {
      plan: { weeklyFrequency: 2 },
    });
    const monday = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const friday = await createTestClass(pg.db, { weekday: 5, capacity: 8 });
    const saturday = await createTestClass(pg.db, { weekday: 6, capacity: 8 });

    const first = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: monday.slotId,
      startDate: nextOccurrence({ weekday: 3 }, today),
    });
    expect(first.ok).toBe(true);
    const second = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: friday.slotId,
      startDate: nextOccurrence({ weekday: 5 }, today),
    });
    expect(second.ok).toBe(true);

    const third = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: saturday.slotId,
      startDate: nextOccurrence({ weekday: 6 }, today),
    });
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.error).toMatch(/Plano .+ 2x\/semana/);
      expect(third.error).toContain("ja esta fixa em 2 turmas");
    }

    const history = await listEnrollmentsByStudent(pg.db, a);
    expect(history).toHaveLength(2);
  });

  it("refuses a fixed enrollment for a student without a plan", async () => {
    // PLIM-03: sem plano nao ha vinculo fixo
    const [a] = await createStudents(pg.db, 1, { plan: false });
    const monday = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const result = await createEnrollment(pg.db, {
      studentId: a,
      classSlotId: monday.slotId,
      startDate: nextOccurrence({ weekday: 3 }, today),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sem plano");
      expect(result.field).toBe("planId");
    }

    const history = await listEnrollmentsByStudent(pg.db, a);
    expect(history).toHaveLength(0);
  });
});
