import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, classSessions, classSlots, classTypes, credits, holidays } from "../../../../db/schema";
import { createStudents, createTestClass, clearTables, grantTestCredit } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { todayInStudio, nextOccurrence } from "../../domain/occurrences";
import { createEnrollment } from "../../../students/services/enrollments";
import { createBooking } from "../../../bookings/services/bookings";
import { materializeSession } from "../../../bookings/services/sessions";
import { getComposition } from "../../../bookings/services/composition";
import {
  createClassType,
  createSlot,
  deactivateSlot,
  listActiveSlots,
  listAllClassTypes,
  listAllSlots,
  updateClassType,
  updateSlot,
} from "../classes";

describe("classes", () => {
  let pg: PostgresTestInstance;
  let today: string;
  let day: string; // proxima data de terca do slot 19h (futura)
  let nextDay: string; // terca da semana seguinte

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
    day = nextOccurrence({ weekday: 3 }, today);
    nextDay = nextOccurrence({ weekday: 3 }, next(day));
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  function next(date: string): string {
    return nextOccurrence({ weekday: 3 }, addDays(date, 1));
  }

  it("default capacity is eight", async () => {
    const { classTypeId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const withoutCapacity = await createSlot(pg.db, {
      classTypeId,
      weekday: 5,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(withoutCapacity.ok).toBe(true);
    if (withoutCapacity.ok) {
      expect(withoutCapacity.value.capacity).toBe(8);
      expect(withoutCapacity.value.status).toBe("ATIVA");
      expect(withoutCapacity.value.classTypeId).toBe(classTypeId);
    }

    // Capacidade informada e respeitada e pode ser alterada depois (RES-02)
    const withCapacity = await createSlot(pg.db, {
      classTypeId,
      weekday: 6,
      startTime: "09:00:00",
      endTime: "10:00:00",
      capacity: 5,
    });
    expect(withCapacity.ok).toBe(true);
    if (withCapacity.ok) {
      expect(withCapacity.value.capacity).toBe(5);
      const changed = await updateSlot(pg.db, withCapacity.value.id, { capacity: 12 });
      expect(changed.ok).toBe(true);
      if (changed.ok) expect(changed.value.capacity).toBe(12);
    }
  });

  it("rejects an invalid slot on the server", async () => {
    const { classTypeId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const equalEnd = await createSlot(pg.db, {
      classTypeId,
      weekday: 3,
      startTime: "19:00:00",
      endTime: "19:00:00",
    });
    expect(equalEnd.ok).toBe(false);
    if (!equalEnd.ok) {
      expect(equalEnd.field).toBe("endTime");
      expect(equalEnd.error).toContain("endTime");
    }

    const earlierEnd = await createSlot(pg.db, {
      classTypeId,
      weekday: 3,
      startTime: "20:00:00",
      endTime: "19:00:00",
    });
    expect(earlierEnd.ok).toBe(false);

    const weekdayOut = await createSlot(pg.db, {
      classTypeId,
      weekday: 8,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(weekdayOut.ok).toBe(false);
    if (!weekdayOut.ok) expect(weekdayOut.field).toBe("weekday");

    // Campo obrigatorio vazio: hoje passava pelo validador (NaN na comparacao)
    const emptyStart = await createSlot(pg.db, {
      classTypeId,
      weekday: 3,
      startTime: "",
      endTime: "20:00:00",
    });
    expect(emptyStart.ok).toBe(false);
    if (!emptyStart.ok) expect(emptyStart.field).toBe("startTime");

    const emptyEnd = await createSlot(pg.db, {
      classTypeId,
      weekday: 3,
      startTime: "19:00:00",
      endTime: "",
    });
    expect(emptyEnd.ok).toBe(false);
    if (!emptyEnd.ok) expect(emptyEnd.field).toBe("endTime");

    const emptyWeekday = await createSlot(pg.db, {
      classTypeId,
      weekday: Number.NaN,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(emptyWeekday.ok).toBe(false);
    if (!emptyWeekday.ok) expect(emptyWeekday.field).toBe("weekday");

    // Nenhuma das recusas gravou: segue existindo apenas a turma do fixture
    const classes = await pg.db.select().from(classSlots);
    expect(classes).toHaveLength(1);
    expect(classes[0].weekday).toBe(3);
  });

  it("refuses a blank modality name on the server", async () => {
    const blank = await createClassType(pg.db, { name: "   " });
    expect(blank.ok).toBe(false);
    if (!blank.ok) {
      expect(blank.field).toBe("name");
      expect(blank.error).toContain("name");
    }

    // O nome gravado e o nome sem espacos das pontas
    const created = await createClassType(pg.db, { name: "  Superioga Fluide  " });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.name).toBe("Superioga Fluide");

    const renamed = await updateClassType(pg.db, created.value.id, { name: " " });
    expect(renamed.ok).toBe(false);
    if (!renamed.ok) expect(renamed.field).toBe("name");

    const types = await pg.db.select().from(classTypes);
    expect(types).toHaveLength(1);
    expect(types[0].name).toBe("Superioga Fluide");
  });

  it("refuses a slot whose class type does not exist with a field error", async () => {
    const slot = await createSlot(pg.db, {
      classTypeId: "00000000-0000-0000-0000-000000000000",
      weekday: 3,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(slot.ok).toBe(false);
    if (!slot.ok) {
      expect(slot.field).toBe("classTypeId");
      expect(slot.error).toContain("classTypeId");
    }

    const slots = await pg.db.select().from(classSlots);
    expect(slots).toHaveLength(0);
  });

  it("refuses a slot under an inactive class type", async () => {
    const created = await createClassType(pg.db, { name: "Superioga Clássico" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deactivated = await updateClassType(pg.db, created.value.id, {
      status: "INATIVA",
    });
    expect(deactivated.ok).toBe(true);

    const slot = await createSlot(pg.db, {
      classTypeId: created.value.id,
      weekday: 3,
      startTime: "19:00:00",
      endTime: "20:00:00",
    });
    expect(slot.ok).toBe(false);
    if (!slot.ok) {
      expect(slot.field).toBe("classTypeId");
      expect(slot.error).toContain("classTypeId");
    }

    const slots = await pg.db.select().from(classSlots);
    expect(slots).toHaveLength(0);
  });

  it("creates an active slot with the submitted data", async () => {
    const created = await createClassType(pg.db, { name: "Superioga Intenso" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const slot = await createSlot(pg.db, {
      classTypeId: created.value.id,
      weekday: 5,
      startTime: "07:00:00",
      endTime: "08:00:00",
      capacity: 4,
    });
    expect(slot.ok).toBe(true);
    if (slot.ok) {
      expect(slot.value.status).toBe("ATIVA");
      expect(slot.value.classTypeId).toBe(created.value.id);
      expect(slot.value.weekday).toBe(5);
      expect(slot.value.startTime).toBe("07:00:00");
      expect(slot.value.endTime).toBe("08:00:00");
      expect(slot.value.capacity).toBe(4);
    }
  });

  it("lists active and inactive class types and slots with status", async () => {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });

    const created = await createSlot(pg.db, {
      classTypeId,
      weekday: 5,
      startTime: "07:00:00",
      endTime: "08:00:00",
      capacity: 6,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const deactivated = await deactivateSlot(pg.db, created.value.id);
    expect(deactivated.ok).toBe(true);

    const inactiveType = await createClassType(pg.db, { name: "Superioga Leve" });
    expect(inactiveType.ok).toBe(true);
    if (!inactiveType.ok) return;
    const deactivatedType = await updateClassType(pg.db, inactiveType.value.id, {
      status: "INATIVA",
    });
    expect(deactivatedType.ok).toBe(true);

    // As duas modalidades na listagem, com o status de cada uma
    const types = await listAllClassTypes(pg.db);
    expect(types).toHaveLength(2);
    expect(types.find((type) => type.id === classTypeId)?.status).toBe("ATIVA");
    expect(types.find((type) => type.id === inactiveType.value.id)?.status).toBe(
      "INATIVA",
    );

    // As duas turmas na listagem, com status e dados completos
    const slots = await listAllSlots(pg.db);
    expect(slots).toHaveLength(2);
    const active = slots.find((slot) => slot.id === slotId);
    expect(active?.status).toBe("ATIVA");
    expect(active?.classTypeStatus).toBe("ATIVA");
    expect(active?.weekday).toBe(3);
    expect(active?.startTime).toBe("19:00:00");
    expect(active?.endTime).toBe("20:00:00");
    expect(active?.capacity).toBe(8);
    expect(active?.classTypeName).toContain("Superioga Teste");

    const inactive = slots.find((slot) => slot.id === created.value.id);
    expect(inactive?.status).toBe("INATIVA");
    expect(inactive?.weekday).toBe(5);
    expect(inactive?.capacity).toBe(6);

    // A listagem da grade continua mostrando so as turmas ativas
    const activeOnly = await listActiveSlots(pg.db);
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe(slotId);
  });

  it("creates, edits and deactivates a class type", async () => {
    const created = await createClassType(pg.db, { name: "Superioga Fluide" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe("ATIVA");

    const edited = await updateClassType(pg.db, created.value.id, { name: "Superioga Fluide 2" });
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.value.name).toBe("Superioga Fluide 2");

    const deactivated = await updateClassType(pg.db, created.value.id, { status: "INATIVA" });
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) expect(deactivated.value.status).toBe("INATIVA");

    const [row] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, created.value.id));
    expect(row.name).toBe("Superioga Fluide 2");
    expect(row.status).toBe("INATIVA");
  });

  it("an inactive class type hides its classes and refuses bookings", async () => {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    const students = await createStudents(pg.db, 1);
    const date = nextOccurrence({ weekday: 3 }, today);

    const deactivated = await updateClassType(pg.db, classTypeId, { status: "INATIVA" });
    expect(deactivated.ok).toBe(true);

    // A grade do painel e a agenda publica listam turmas ativas
    const slots = await listActiveSlots(pg.db);
    expect(slots).toHaveLength(0);

    const booking = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(booking.ok).toBe(false);
    if (!booking.ok) {
      expect(booking.error).toContain("modalidade inativa");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);
  });

  it("editing or deactivating a class affects future occurrences", async () => {
    const students = await createStudents(pg.db, 1);

    // --- desativar ---
    const deactivatedClass = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });

    // Ocorrencia futura existente continua com composicao legivel
    const before = await getComposition(pg.db, {
      classSlotId: deactivatedClass.slotId,
      date: day,
    });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.sessionStatus).toBe("AGENDADA");

    const deactivated = await deactivateSlot(pg.db, deactivatedClass.slotId);
    expect(deactivated.ok).toBe(true);

    // A partir da alteracao, novas ocorrencias futuras nao sao geradas
    const after = await getComposition(pg.db, {
      classSlotId: deactivatedClass.slotId,
      date: nextDay,
    });
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.error).toContain("inativa");
    }

    // A ocorrencia que ja existia nao aceita mais reserva
    const booking = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: deactivatedClass.slotId,
      date: day,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(booking.ok).toBe(false);
    if (!booking.ok) {
      expect(booking.error).toContain("inativa");
    }
    const created = await pg.db.select().from(bookings);
    expect(created).toHaveLength(0);

    // --- editar o dia ---
    const editedClass = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const existing = await getComposition(pg.db, {
      classSlotId: editedClass.slotId,
      date: day,
    });
    expect(existing.ok).toBe(true);

    const edited = await updateSlot(pg.db, editedClass.slotId, {
      weekday: 4,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(edited.ok).toBe(true);

    // A ocorrencia futura da grade antiga e cancelada
    const [cancelled] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, editedClass.slotId));
    expect(cancelled.status).toBe("CANCELADA");

    // E a nova grade materializa na data da nova weekday
    const newDay = nextOccurrence({ weekday: 4 }, today);
    const newReading = await getComposition(pg.db, {
      classSlotId: editedClass.slotId,
      date: newDay,
    });
    expect(newReading.ok).toBe(true);
    if (newReading.ok) {
      expect(newReading.value.sessionStatus).toBe("AGENDADA");
    }
  });

  it("schedule edit summary reports the cancelled occurrences and the granted credits", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 2);
    for (const student of students) {
      const fixed = await createEnrollment(pg.db, {
        studentId: student,
        classSlotId: slotId,
        startDate: today,
      });
      expect(fixed.ok).toBe(true);
    }

    // Duas ocorrencias futuras materializadas da grade antiga
    for (const date of [day, nextDay]) {
      const composition = await getComposition(pg.db, {
        classSlotId: slotId,
        date,
      });
      expect(composition.ok).toBe(true);
    }

    const edited = await updateSlot(pg.db, slotId, {
      weekday: 4,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    // 2 ocorrencias canceladas x 2 alunas fixas = 4 creditos de estudio
    expect(edited.value.scheduleEdit?.cancelledOccurrences).toBe(2);
    expect(edited.value.scheduleEdit?.grantedCredits).toBe(4);

    const studioCredits = await pg.db.select().from(credits);
    expect(studioCredits).toHaveLength(4);
    expect(
      studioCredits.every((credit) => credit.source === "CANCELAMENTO_ESTUDIO"),
    ).toBe(true);
  });

  it("schedule edit closes the blocked future occurrence of the old schedule without studio credits", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    // A proxima terca e feriado: a ocorrencia da grade antiga nasce BLOQUEADA
    await pg.db.insert(holidays).values({ date: day, name: "Feriado Teste" });
    const blocked = await getComposition(pg.db, {
      classSlotId: slotId,
      date: day,
    });
    expect(blocked.ok).toBe(true);
    if (blocked.ok) expect(blocked.value.sessionStatus).toBe("BLOQUEADA");

    const edited = await updateSlot(pg.db, slotId, { weekday: 4 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    // A ocorrencia bloqueada da grade antiga fecha junto com a grade: sem
    // isso ela voltaria sozinha quando o bloqueio fosse removido (AD-027)
    const [session] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(session.status).toBe("CANCELADA");
    expect(edited.value.scheduleEdit?.cancelledOccurrences).toBe(1);

    // E nao gera credito de estudio: a data esta de feriado (PRD 7.1)
    expect(edited.value.scheduleEdit?.grantedCredits).toBe(0);
    const studioCredits = await pg.db.select().from(credits);
    expect(studioCredits).toHaveLength(0);
  });

  it("keeps the schedule edit summary absent when the schedule does not change", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const edited = await updateSlot(pg.db, slotId, { capacity: 10 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.capacity).toBe(10);
    expect(edited.value.scheduleEdit).toBeUndefined();
  });

  it("deactivating keeps the slot row and stops future occurrences", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const before = await getComposition(pg.db, {
      classSlotId: slotId,
      date: day,
    });
    expect(before.ok).toBe(true);

    const deactivated = await deactivateSlot(pg.db, slotId);
    expect(deactivated.ok).toBe(true);

    // A linha da turma continua no banco, com status INATIVA
    const [row] = await pg.db
      .select()
      .from(classSlots)
      .where(eq(classSlots.id, slotId));
    expect(row.status).toBe("INATIVA");
    expect(row.weekday).toBe(3);

    // A ocorrencia materializada continua no historico
    const sessions = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionDate).toBe(day);

    // Nenhuma ocorrencia nova e gerada a partir da desativacao
    const after = await getComposition(pg.db, {
      classSlotId: slotId,
      date: nextDay,
    });
    expect(after.ok).toBe(false);
  });

  it("reactivating brings back future occurrences and never resurrects cancelled ones", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    // Uma ocorrencia futura materializada e depois cancelada pela grade antiga
    const before = await getComposition(pg.db, {
      classSlotId: slotId,
      date: day,
    });
    expect(before.ok).toBe(true);
    const edited = await updateSlot(pg.db, slotId, { weekday: 4 });
    expect(edited.ok).toBe(true);

    const deactivated = await deactivateSlot(pg.db, slotId);
    expect(deactivated.ok).toBe(true);

    const reactivated = await updateSlot(pg.db, slotId, { status: "ATIVA" });
    expect(reactivated.ok).toBe(true);
    if (!reactivated.ok) return;
    expect(reactivated.value.status).toBe("ATIVA");

    // A ocorrencia cancelada continua cancelada: reativar nao ressuscita
    const sessions = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.classSlotId, slotId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("CANCELADA");

    // E a turma reativada volta a gerar ocorrencia na nova grade
    const newDay = nextOccurrence({ weekday: 4 }, today);
    const after = await getComposition(pg.db, {
      classSlotId: slotId,
      date: newDay,
    });
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.value.sessionStatus).toBe("AGENDADA");
  });

  it("rejects a capacity below the occupancy of a future occurrence", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 5);
    for (const student of students) {
      const fixed = await createEnrollment(pg.db, {
        studentId: student,
        classSlotId: slotId,
        startDate: day,
      });
      expect(fixed.ok).toBe(true);
    }

    const rejected = await updateSlot(pg.db, slotId, { capacity: 4 });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.field).toBe("capacity");
      expect(rejected.error).toContain("ocupacao 5");
      expect(rejected.error).toContain(day); // informa a ocorrencia mais afetada
    }

    // Recusa sem estado parcial: a capacidade continua 8
    const [row] = await pg.db
      .select()
      .from(classSlots)
      .where(eq(classSlots.id, slotId));
    expect(row.capacity).toBe(8);

    // Aumento e permitido
    const enlarged = await updateSlot(pg.db, slotId, { capacity: 10 });
    expect(enlarged.ok).toBe(true);
  });

  it("accepts editing valid required class data", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const edited = await updateSlot(pg.db, slotId, {
      weekday: 5,
      startTime: "18:00:00",
      endTime: "19:00:00",
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.value.weekday).toBe(5);
      expect(edited.value.startTime).toBe("18:00:00");
      expect(edited.value.endTime).toBe("19:00:00");
    }
  });

  it("editing the weekday cancels the old future occurrences and their bookings", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const students = await createStudents(pg.db, 1);
    const oldDate = nextOccurrence({ weekday: 3 }, today);

    const booking = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date: oldDate,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(booking.ok).toBe(true);

    const edited = await updateSlot(pg.db, slotId, {
      weekday: 4,
      startTime: "07:00:00",
      endTime: "08:00:00",
    });
    expect(edited.ok).toBe(true);

    // A ocorrencia da grade antiga e cancelada e a reserva liberada (AD-013)
    const [oldSession] = await pg.db
      .select()
      .from(classSessions)
      .where(eq(classSessions.sessionDate, oldDate));
    expect(oldSession.status).toBe("CANCELADA");

    const [oldBooking] = await pg.db.select().from(bookings);
    expect(oldBooking.status).toBe("CANCELADA");

    // A leitura da ocorrencia cancelada nao conta mais a reserva
    const oldReading = await getComposition(pg.db, {
      classSlotId: slotId,
      date: oldDate,
    });
    expect(oldReading.ok).toBe(true);
    if (oldReading.ok) {
      expect(oldReading.value.sessionStatus).toBe("CANCELADA");
      expect(oldReading.value.makeupCount).toBe(0);
      expect(oldReading.value.total).toBe(0);
      expect(oldReading.value.availableSpots).toBe(8);
    }

    // A ocorrencia cancelada nao aceita reserva nova
    const [other] = await createStudents(pg.db, 1);
    const refused = await createBooking(pg.db, {
      studentId: other,
      classSlotId: slotId,
      date: oldDate,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, other),
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toContain("cancelada");
    }

    // A nova grade materializa na nova data, com a vaga liberada
    const newDate = nextOccurrence({ weekday: 4 }, today);
    const newReading = await getComposition(pg.db, {
      classSlotId: slotId,
      date: newDate,
    });
    expect(newReading.ok).toBe(true);
    if (newReading.ok) {
      expect(newReading.value.sessionStatus).toBe("AGENDADA");
      expect(newReading.value.availableSpots).toBe(8);
    }
  });
});

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("composition", () => {
  let pg: PostgresTestInstance;
  let today: string;
  let day: string;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
    day = nextOccurrence({ weekday: 3 }, today);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("PRD example 5+2+1 cap 8 with zero spots left", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const fixed = await createStudents(pg.db, 5);
    for (const student of fixed) {
      const enrollment = await createEnrollment(pg.db, {
        studentId: student,
        classSlotId: slotId,
        startDate: day,
      });
      expect(enrollment.ok).toBe(true);
    }

    // 2 posicoes de reposicao e 1 de experimentais criadas como bookings
    const casual = await createStudents(pg.db, 3);
    for (let i = 0; i < 2; i++) {
      const booking = await createBooking(pg.db, {
        studentId: casual[i],
        classSlotId: slotId,
        date: day,
        type: "MAKEUP",
        creditId: await grantTestCredit(pg.db, casual[i]),
      });
      expect(booking.ok).toBe(true);
    }
    const experimental = await createBooking(pg.db, {
      studentId: casual[2],
      classSlotId: slotId,
      date: day,
      type: "EXPERIMENTAL",
    });
    expect(experimental.ok).toBe(true);

    const reading = await getComposition(pg.db, { classSlotId: slotId, date: day });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.fixedCount).toBe(5);
      expect(reading.value.makeupCount).toBe(2);
      expect(reading.value.experimentalCount).toBe(1);
      expect(reading.value.total).toBe(8);
      expect(reading.value.availableSpots).toBe(0);
      expect(reading.value.classSlotId).toBe(slotId);
      expect(reading.value.date).toBe(day);
      expect(reading.value.sessionId).toBeTruthy();
      expect(reading.value.sessionStatus).toBe("AGENDADA");
    }
  });

  it("an occurrence with no data returns zero total and every spot", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    const reading = await getComposition(pg.db, { classSlotId: slotId, date: day });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.fixedCount).toBe(0);
      expect(reading.value.makeupCount).toBe(0);
      expect(reading.value.experimentalCount).toBe(0);
      expect(reading.value.total).toBe(0);
      expect(reading.value.availableSpots).toBe(8);
    }
  });

  it("reads a materialized past occurrence and refuses creating a new one", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const pastDate = "2024-01-02"; // terca ja passada
    const students = await createStudents(pg.db, 1);

    // Ocorrencia materializada no passado: a leitura e liberada
    const [session] = await pg.db
      .insert(classSessions)
      .values({
        classSlotId: slotId,
        sessionDate: pastDate,
        status: "AGENDADA",
      })
      .returning();
    await pg.db.insert(bookings).values({
      studentId: students[0],
      classSessionId: session.id,
      bookingType: "MAKEUP",
      status: "ATIVA",
    });

    const reading = await getComposition(pg.db, {
      classSlotId: slotId,
      date: pastDate,
    });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.sessionStatus).toBe("AGENDADA");
      expect(reading.value.makeupCount).toBe(1);
      expect(reading.value.total).toBe(1);
      expect(reading.value.availableSpots).toBe(7);
    }

    // Data passada nova: nem materializa nem aceita reserva
    const newPastDate = "2024-01-09"; // outra terca ja passada
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date: newPastDate,
    });
    expect(materialized.ok).toBe(false);
    if (!materialized.ok) {
      expect(materialized.error).toContain("data passada");
      expect(materialized.field).toBe("date");
    }

    const booking = await createBooking(pg.db, {
      studentId: students[0],
      classSlotId: slotId,
      date: newPastDate,
      type: "MAKEUP",
      creditId: await grantTestCredit(pg.db, students[0]),
    });
    expect(booking.ok).toBe(false);
    if (!booking.ok) {
      expect(booking.error).toContain("data passada");
      expect(booking.field).toBe("date");
    }

    // Nenhuma ocorrencia nova no passado
    const sessions = await pg.db.select().from(classSessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionDate).toBe(pastDate);
  });

  it("reading a past date does not materialize", async () => {
    const { slotId } = await createTestClass(pg.db, { weekday: 3, capacity: 8 });

    // Materializa a futura primeiro
    const future = await getComposition(pg.db, { classSlotId: slotId, date: day });
    expect(future.ok).toBe(true);

    const past = await getComposition(pg.db, {
      classSlotId: slotId,
      date: "2024-01-02", // terca ja passada
    });
    expect(past.ok).toBe(false);
    if (!past.ok) {
      expect(past.error).toContain("passada");
    }

    // Nada foi materializado alem da ocorrencia futura
    const rows = await pg.db.select().from(classSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionDate).toBe(day);
  });
});
