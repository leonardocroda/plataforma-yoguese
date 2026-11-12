import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  classSlots,
  experimentals,
} from "../../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { getOccurrenceComposition } from "../../../bookings/services/composition";
import { materializeSession } from "../../../bookings/services/sessions";
import {
  approveExperimental,
  createExperimentalRequest,
  refuseExperimental,
} from "../experimentals";

// EXP-20 a EXP-23: a aprovacao revalida a vaga, ocupa a ocorrencia e duas
// aprovacoes concorrentes pela ultima vaga confirmam uma. A recusa mantem o
// registro e libera o telefone.

describe("experimental approval", () => {
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

  /** Turma com a modalidade e a ocorrencia do proximo dia da semana. */
  async function occurrence(capacity = 2) {
    const { classTypeId, slotId } = await createTestClass(pg.db, {
      weekday: 3,
      capacity,
    });
    const date = nextOccurrence({ weekday: 3 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: slotId,
      date,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    return { classTypeId, slotId, date, sessionId: materialized.value.id };
  }

  /** Solicitacao publica pendente na ocorrencia informada. */
  async function pendingRequest(input: {
    classTypeId: string;
    classSlotId: string;
    date: string;
    phone?: string;
  }) {
    const result = await createExperimentalRequest(pg.db, {
      name: "Maria Visitante",
      phone: input.phone ?? "(11) 98888-7777",
      classTypeId: input.classTypeId,
      classSlotId: input.classSlotId,
      date: input.date,
      declarationAccepted: true,
    });
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  it("aprova com vaga e ocupa a ocorrencia", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(2);
    const request = await pendingRequest({ classTypeId, classSlotId: slotId, date });
    const now = new Date();

    const result = await approveExperimental(
      pg.db,
      { experimentalId: request.id },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("APROVADA");
    expect(result.value.approvedAt?.toISOString()).toBe(now.toISOString());

    // A aprovada ocupa a vaga da ocorrencia (EXP-20)
    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 2,
    });
    expect(composition.experimentalCount).toBe(1);
    expect(composition.availableSpots).toBe(1);
  });

  it("recusa aprovacao sem vaga, bloqueada ou cancelada e mantem pendente", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(1);

    // A unica vaga ja esta ocupada por uma aprovada
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
    });
    // As pendentes sao gravadas direto: com a vaga ocupada, o formulario
    // publico recusaria a solicitacao.
    const semVaga = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 97777-6666",
    });

    const semVagaResult = await approveExperimental(pg.db, {
      experimentalId: semVaga.id,
    });
    expect(semVagaResult.ok).toBe(false);
    if (!semVagaResult.ok) {
      expect(semVagaResult.error).toContain("sem vaga");
    }

    // Ocorrencia bloqueada por feriado/recesso
    await pg.db
      .update(classSessions)
      .set({ status: "BLOQUEADA" })
      .where(eq(classSessions.id, sessionId));
    const bloqueada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 96666-5555",
    });
    const bloqueadaResult = await approveExperimental(pg.db, {
      experimentalId: bloqueada.id,
    });
    expect(bloqueadaResult.ok).toBe(false);
    if (!bloqueadaResult.ok) {
      expect(bloqueadaResult.error).toContain("bloqueada");
    }

    // Ocorrencia cancelada pelo estudio
    await pg.db
      .update(classSessions)
      .set({ status: "CANCELADA" })
      .where(eq(classSessions.id, sessionId));
    const cancelada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 95555-4444",
    });
    const canceladaResult = await approveExperimental(pg.db, {
      experimentalId: cancelada.id,
    });
    expect(canceladaResult.ok).toBe(false);
    if (!canceladaResult.ok) {
      expect(canceladaResult.error).toContain("cancelada");
    }

    // Turma inativa
    await pg.db
      .update(classSessions)
      .set({ status: "AGENDADA" })
      .where(eq(classSessions.id, sessionId));
    await pg.db
      .update(classSlots)
      .set({ status: "INATIVA" })
      .where(eq(classSlots.id, slotId));
    const inativa = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 94444-3333",
    });
    const inativaResult = await approveExperimental(pg.db, {
      experimentalId: inativa.id,
    });
    expect(inativaResult.ok).toBe(false);
    if (!inativaResult.ok) {
      expect(inativaResult.error).toContain("inativa");
    }

    // Todas as solicitacoes continuam pendentes (EXP-21)
    const rows = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.status, "PENDENTE"));
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.approvedAt === null)).toBe(true);
  });

  it("duas aprovacoes concorrentes na ultima vaga confirmam uma", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(1);
    const primeira = await pendingRequest({
      classTypeId,
      classSlotId: slotId,
      date,
      phone: "(11) 98888-7777",
    });
    const segunda = await pendingRequest({
      classTypeId,
      classSlotId: slotId,
      date,
      phone: "(11) 97777-6666",
    });

    const results = await Promise.all([
      approveExperimental(pg.db, { experimentalId: primeira.id }),
      approveExperimental(pg.db, { experimentalId: segunda.id }),
    ]);

    const ok = results.filter((result) => result.ok);
    const recusadas = results.filter((result) => !result.ok);
    expect(ok).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    if (!recusadas[0].ok) {
      expect(recusadas[0].error).toContain("sem vaga");
    }

    // Exatamente uma aprovada no banco, e a vaga ficou ocupada
    const rows = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.status, "APROVADA"));
    expect(rows).toHaveLength(1);

    const composition = await getOccurrenceComposition(pg.db, {
      classSlotId: slotId,
      sessionId,
      date,
      capacity: 1,
    });
    expect(composition.experimentalCount).toBe(1);
    expect(composition.availableSpots).toBe(0);
  });

  it("recusa libera o telefone e mantem o registro", async () => {
    const { classTypeId, slotId, date } = await occurrence(2);
    const request = await pendingRequest({ classTypeId, classSlotId: slotId, date });

    const result = await refuseExperimental(pg.db, {
      experimentalId: request.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("RECUSADA");

    // O registro continua consultavel
    const rows = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, request.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("RECUSADA");
    expect(rows[0].name).toBe("Maria Visitante");

    // O telefone volta a ficar livre: a recusada fica fora do indice
    const nova = await createExperimentalRequest(pg.db, {
      name: "Maria de novo",
      phone: "11988887777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(nova.ok).toBe(true);
    if (nova.ok) {
      expect(nova.value.status).toBe("PENDENTE");
      expect(nova.value.id).not.toBe(request.id);
    }
  });
});
