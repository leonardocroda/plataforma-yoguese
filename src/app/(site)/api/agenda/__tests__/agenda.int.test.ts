import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { classSlots, classTypes, holidays, students } from "../../../../../db/schema";
import { createTestClass, clearTables } from "../../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../../../modules/classes/domain/occurrences";
import { createBooking } from "../../../../../modules/bookings/services/bookings";
import { GET } from "../route";

describe("agenda", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
    // A rota usa o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    const { db } = await import("../../../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
    await pg.pool.end();
    await pg.container.stop();
  });

  it("returns the period without personal data", async () => {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity: 8,
    });
    const [classType] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, classTypeId));
    const date = nextOccurrence({ weekday: 3 }, today);

    // Um aluno com reserva ocupa uma vaga: a agenda mostra 7, sem dizer quem
    const [student] = await pg.db
      .insert(students)
      .values({ name: "Ana Ribeiro" })
      .returning();
    const booking = await createBooking(pg.db, {
      studentId: student.id,
      classSlotId: slotId,
      date,
      type: "MAKEUP",
    });
    expect(booking.ok).toBe(true);

    const response = await GET(
      new Request(`http://localhost/api/agenda?from=${date}&to=${date}`),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.from).toBe(date);
    expect(body.to).toBe(date);
    expect(body.occurrences).toHaveLength(1);
    expect(body.occurrences[0]).toEqual({
      date,
      startTime: "19:00:00",
      endTime: "20:00:00",
      classTypeName: classType.name,
      availableSpots: 7,
    });

    // Nenhum nome ou dado pessoal de aluno na leitura publica
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("Ana Ribeiro");
    expect(raw).not.toContain(student.id);
    expect(raw.toLowerCase()).not.toContain("student");
    expect(raw.toLowerCase()).not.toContain("aluno");
  });

  it("omits an inactive slot from the list", async () => {
    const active = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const inactive = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const [activeType] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, active.classTypeId));
    const [inactiveType] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, inactive.classTypeId));

    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, inactive.slotId));

    const date = nextOccurrence({ weekday: 3 }, today);
    const response = await GET(
      new Request(`http://localhost/api/agenda?from=${date}&to=${date}`),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.occurrences).toHaveLength(1);
    expect(body.occurrences[0].classTypeName).toBe(activeType.name);

    const raw = JSON.stringify(body);
    expect(raw).not.toContain(inactiveType.name);
  });

  it("omits a blocked occurrence from the list", async () => {
    await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const date = nextOccurrence({ weekday: 3 }, today);
    await pg.db.insert(holidays).values({ date, name: "Feriado Municipal" });

    const response = await GET(
      new Request(`http://localhost/api/agenda?from=${date}&to=${date}`),
    );
    expect(response.status).toBe(200);

    // A ocorrencia bloqueada nao e publicada: o servidor recusa reserva nela
    const body = await response.json();
    expect(body.occurrences).toHaveLength(0);
  });

  it("omits a class with an inactive class type from the list", async () => {
    const inactiveType = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const active = await createTestClass(pg.db, { weekday: 3, capacity: 8 });
    const [activeType] = await pg.db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, active.classTypeId));

    await pg.db
      .update(classTypes)
      .set({ status: "INATIVA" })
      .where(eq(classTypes.id, inactiveType.classTypeId));

    const date = nextOccurrence({ weekday: 3 }, today);
    const response = await GET(
      new Request(`http://localhost/api/agenda?from=${date}&to=${date}`),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.occurrences).toHaveLength(1);
    expect(body.occurrences[0].classTypeName).toBe(activeType.name);
  });

  it("rejects an invalid period with 400", async () => {
    const missing = await GET(new Request("http://localhost/api/agenda"));
    expect(missing.status).toBe(400);
    const missingBody = await missing.json();
    expect(missingBody.error).toContain("periodo invalido");

    const malformed = await GET(
      new Request("http://localhost/api/agenda?from=10-11-2026&to=12-11-2026"),
    );
    expect(malformed.status).toBe(400);

    const inverted = await GET(
      new Request("http://localhost/api/agenda?from=2026-12-01&to=2026-11-01"),
    );
    expect(inverted.status).toBe(400);
    const invertedBody = await inverted.json();
    expect(invertedBody.error).toContain("periodo invalido");
  });
});
