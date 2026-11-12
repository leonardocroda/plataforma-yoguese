import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  classSessions,
  classSlots,
  experimentalReschedules,
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
  changeExperimentalOccurrence,
  createExperimentalRequest,
  refuseExperimental,
  registerPayment,
  registerWhatsAppContact,
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

  /** Turma com a modalidade e a ocorrencia do dia da semana informado. */
  async function occurrence(weekday = 3, capacity = 2) {
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
    const { classTypeId, slotId, date, sessionId } = await occurrence(3, 2);
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
    const { classTypeId, slotId, date, sessionId } = await occurrence(3, 1);

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
    const { classTypeId, slotId, date, sessionId } = await occurrence(3, 1);
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
    const { classTypeId, slotId, date } = await occurrence(3, 2);
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

  it("troca de data de pendente mantem pendente e de aprovada troca a vaga", async () => {
    const origem = await occurrence(3);
    const destino = await occurrence(4);

    // A pendente troca de ocorrencia e continua pendente
    const pendente = await pendingRequest({
      classTypeId: origem.classTypeId,
      classSlotId: origem.slotId,
      date: origem.date,
    });
    const trocaPendente = await changeExperimentalOccurrence(pg.db, {
      experimentalId: pendente.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });

    expect(trocaPendente.ok).toBe(true);
    if (!trocaPendente.ok) return;
    expect(trocaPendente.value.status).toBe("PENDENTE");
    expect(trocaPendente.value.classSessionId).toBe(destino.sessionId);
    expect(trocaPendente.value.approvedAt).toBeNull();

    // A aprovada troca a vaga ocupada de forma atomica
    const aprovada = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "APROVADA",
      phone: "(11) 97777-6666",
    });
    const trocaAprovada = await changeExperimentalOccurrence(pg.db, {
      experimentalId: aprovada.id,
      classSlotId: destino.slotId,
      date: destino.date,
    });

    expect(trocaAprovada.ok).toBe(true);
    if (!trocaAprovada.ok) return;
    expect(trocaAprovada.value.status).toBe("APROVADA");
    expect(trocaAprovada.value.classSessionId).toBe(destino.sessionId);

    // A vaga saiu da ocorrencia de origem e entrou na de destino
    const composicaoOrigem = await getOccurrenceComposition(pg.db, {
      classSlotId: origem.slotId,
      sessionId: origem.sessionId,
      date: origem.date,
      capacity: 2,
    });
    expect(composicaoOrigem.experimentalCount).toBe(0);
    expect(composicaoOrigem.availableSpots).toBe(2);

    const composicaoDestino = await getOccurrenceComposition(pg.db, {
      classSlotId: destino.slotId,
      sessionId: destino.sessionId,
      date: destino.date,
      capacity: 2,
    });
    expect(composicaoDestino.experimentalCount).toBe(1);
    expect(composicaoDestino.availableSpots).toBe(1);

    // A ocorrencia anterior fica no historico
    const history = await pg.db.select().from(experimentalReschedules);
    expect(history).toHaveLength(2);
    expect(history.every((row) => row.experimentalId === pendente.id || row.experimentalId === aprovada.id)).toBe(true);
  });

  it("troca sem vaga recusa e mantem a ocorrencia anterior", async () => {
    const origem = await occurrence(3);
    const lotada = await occurrence(5, 1);

    // A unica vaga da outra ocorrencia esta ocupada por uma aprovada
    await createExperimental(pg.db, {
      classSessionId: lotada.sessionId,
      status: "APROVADA",
      phone: "(11) 96666-5555",
    });

    const pendente = await createExperimental(pg.db, {
      classSessionId: origem.sessionId,
      status: "PENDENTE",
      phone: "(11) 98888-7777",
    });
    const resultado = await changeExperimentalOccurrence(pg.db, {
      experimentalId: pendente.id,
      classSlotId: lotada.slotId,
      date: lotada.date,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("sem vaga");
    }

    // A ocorrencia anterior foi mantida
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, pendente.id));
    expect(registro.classSessionId).toBe(origem.sessionId);
    expect(registro.status).toBe("PENDENTE");

    const history = await pg.db.select().from(experimentalReschedules);
    expect(history).toHaveLength(0);
  });

  it("registra pagamento nos quatro status", async () => {
    const { classTypeId, slotId, date } = await occurrence(3, 2);
    const request = await pendingRequest({ classTypeId, classSlotId: slotId, date });

    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, request.id));
    expect(registro.paymentStatus).toBe("PENDENTE");

    for (const paymentStatus of [
      "PAGO",
      "ISENTO",
      "REEMBOLSADO",
      "PENDENTE",
    ] as const) {
      const result = await registerPayment(pg.db, {
        experimentalId: request.id,
        paymentStatus,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.paymentStatus).toBe(paymentStatus);

      const [atual] = await pg.db
        .select()
        .from(experimentals)
        .where(eq(experimentals.id, request.id));
      expect(atual.paymentStatus).toBe(paymentStatus);
    }
  });

  it("registra contato via WhatsApp", async () => {
    const { classTypeId, slotId, date } = await occurrence(3, 2);
    const request = await pendingRequest({ classTypeId, classSlotId: slotId, date });
    const now = new Date();

    const result = await registerWhatsAppContact(
      pg.db,
      { experimentalId: request.id },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.whatsappContactedAt?.toISOString()).toBe(now.toISOString());

    const [atual] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, request.id));
    expect(atual.whatsappContactedAt?.toISOString()).toBe(now.toISOString());
  });
});
