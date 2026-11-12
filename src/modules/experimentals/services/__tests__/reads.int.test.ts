import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { experimentals } from "../../../../db/schema";
import {
  createExperimental,
  createStudents,
  createTestClass,
  clearTables,
} from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import { nextOccurrence, todayInStudio } from "../../../classes/domain/occurrences";
import { materializeSession } from "../../../bookings/services/sessions";
import {
  approveExperimental,
  cancelExperimental,
  changeExperimentalOccurrence,
  createExperimentalRequest,
  getExperimental,
  listApprovedExperimentalsBySession,
  listExperimentals,
  refuseExperimental,
  registerPayment,
  registerWhatsAppContact,
  rescheduleExperimental,
} from "../experimentals";

// EXP-17, EXP-18, EXP-19, EXP-49, EXP-60: a listagem do admin mostra os
// dados da solicitacao com a ocorrencia, a busca por telefone traz todas
// as tentativas do telefone normalizado e o detalhe carrega a declaracao,
// os timestamps e a aluna convertida.

describe("experimental reads", () => {
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

  it("lista solicitacoes com dados da ocorrencia", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(3, 2);

    const result = await createExperimentalRequest(pg.db, {
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    if (!result.ok) throw new Error(result.error);

    const lista = await listExperimentals(pg.db);

    expect(lista).toHaveLength(1);
    const linha = lista[0];
    expect(linha.id).toBe(result.value.id);
    expect(linha.name).toBe("Maria Visitante");
    expect(linha.phone).toBe("(11) 98888-7777");
    expect(linha.status).toBe("PENDENTE");
    expect(linha.paymentStatus).toBe("PENDENTE");
    expect(linha.requestedAt.toISOString()).toBe(
      result.value.requestedAt.toISOString(),
    );

    // A ocorrencia vem com data, horario e modalidade
    expect(linha.occurrence.date).toBe(date);
    expect(linha.occurrence.startTime).toBe("19:00:00");
    expect(linha.occurrence.endTime).toBe("20:00:00");
    expect(linha.occurrence.classTypeName).toBeTruthy();
    expect(linha.occurrence.classSessionId).toBe(sessionId);

    // Sem solicitacao a lista vem vazia
    await pg.db.delete(experimentals);
    const vazia = await listExperimentals(pg.db);
    expect(vazia).toHaveLength(0);
  });

  it("busca por telefone devolve todas as tentativas", async () => {
    const { sessionId } = await occurrence(3, 2);

    // A solicitacao canonica do telefone: cancelada com direito
    const canonica = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "CANCELADA_COM_DIREITO",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
    });

    // A tentativa duplicada, gravada na outra submissao
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "DUPLICADA",
      phone: "11988887777",
      phoneNormalized: "11988887777",
      duplicateOfId: canonica.id,
    });

    // A solicitacao recusada de uma submissao anterior: o telefone
    // voltou a ficar livre
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "RECUSADA",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
    });

    // Uma convertida de outro telefone nao aparece na busca
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "CONVERTIDA",
      phone: "(11) 97777-6666",
      phoneNormalized: "11977776666",
    });

    // A busca normaliza o telefone digitado
    const busca = await listExperimentals(pg.db, { phone: "(11) 98888-7777" });

    expect(busca).toHaveLength(3);
    expect(busca.map((linha) => linha.status).sort()).toEqual([
      "CANCELADA_COM_DIREITO",
      "DUPLICADA",
      "RECUSADA",
    ]);
    expect(busca.every((linha) => linha.phoneNormalized === "11988887777")).toBe(
      true,
    );

    // A tentativa duplicada fica ligada a solicitacao canonica
    const duplicada = busca.find((linha) => linha.status === "DUPLICADA");
    expect(duplicada?.duplicateOfId).toBe(canonica.id);

    // A listagem sem busca mostra tudo
    const todas = await listExperimentals(pg.db);
    expect(todas).toHaveLength(4);
  });

  it("detalhe mostra os dados e a aluna convertida", async () => {
    const { sessionId, date } = await occurrence(3, 2);
    const [studentId] = await createStudents(pg.db, 1);

    const requestedAt = new Date("2026-03-02T10:00:00.000Z");
    const approvedAt = new Date("2026-03-03T10:00:00.000Z");
    const whatsappContactedAt = new Date("2026-03-03T11:00:00.000Z");
    const attendedAt = new Date("2026-03-10T21:00:00.000Z");

    const convertida = await createExperimental(pg.db, {
      classSessionId: sessionId,
      name: "Maria Convertida",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
      status: "CONVERTIDA",
      paymentStatus: "PAGO",
      healthDeclaration: "declaracao do PRD",
      requestedAt,
      approvedAt,
      whatsappContactedAt,
      attendedAt,
      convertedStudentId: studentId,
    });

    const detalhe = await getExperimental(pg.db, {
      experimentalId: convertida.id,
    });

    expect(detalhe.ok).toBe(true);
    if (!detalhe.ok) return;
    const valor = detalhe.value;

    expect(valor.experimental.id).toBe(convertida.id);
    expect(valor.experimental.name).toBe("Maria Convertida");
    expect(valor.experimental.phone).toBe("(11) 98888-7777");
    expect(valor.experimental.healthDeclaration).toBe("declaracao do PRD");
    expect(valor.experimental.status).toBe("CONVERTIDA");
    expect(valor.experimental.paymentStatus).toBe("PAGO");

    // Os timestamps do ciclo de vida
    expect(valor.experimental.requestedAt.toISOString()).toBe(
      requestedAt.toISOString(),
    );
    expect(valor.experimental.approvedAt?.toISOString()).toBe(
      approvedAt.toISOString(),
    );
    expect(valor.experimental.whatsappContactedAt?.toISOString()).toBe(
      whatsappContactedAt.toISOString(),
    );
    expect(valor.experimental.attendedAt?.toISOString()).toBe(
      attendedAt.toISOString(),
    );

    // A ocorrencia
    expect(valor.occurrence.date).toBe(date);
    expect(valor.occurrence.startTime).toBe("19:00:00");
    expect(valor.occurrence.classTypeName).toBeTruthy();

    // A aluna convertida
    expect(valor.convertedStudent?.id).toBe(studentId);
    expect(valor.convertedStudent?.name).toBeTruthy();
    expect(valor.convertedStudent?.email).toBeTruthy();

    // Uma solicitacao que ainda nao virou aluna nao tem aluna convertida
    const pendente = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 96666-5555",
    });
    const outro = await getExperimental(pg.db, {
      experimentalId: pendente.id,
    });
    expect(outro.ok).toBe(true);
    if (!outro.ok) return;
    expect(outro.value.convertedStudent).toBeNull();

    // Detalhe inexistente
    const inexistente = await getExperimental(pg.db, {
      experimentalId: "00000000-0000-0000-0000-000000000000",
    });
    expect(inexistente.ok).toBe(false);
  });

  it("tentativa duplicada aparece somente leitura", async () => {
    const { sessionId, slotId, date } = await occurrence(3, 2);

    const canonica = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 98888-7777",
      phoneNormalized: "11988887777",
    });

    const duplicada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "DUPLICADA",
      phone: "11988887777",
      phoneNormalized: "11988887777",
      duplicateOfId: canonica.id,
    });

    // A tentativa aparece na consulta do admin, com o status e a ligacao
    const lista = await listExperimentals(pg.db, { phone: "11988887777" });
    expect(lista).toHaveLength(2);
    const linha = lista.find((item) => item.id === duplicada.id);
    expect(linha?.status).toBe("DUPLICADA");
    expect(linha?.duplicateOfId).toBe(canonica.id);
    expect(linha?.occurrence.classTypeName).toBeTruthy();

    const detalhe = await getExperimental(pg.db, {
      experimentalId: duplicada.id,
    });
    expect(detalhe.ok).toBe(true);
    if (!detalhe.ok) return;
    expect(detalhe.value.experimental.status).toBe("DUPLICADA");
    expect(detalhe.value.experimental.duplicateOfId).toBe(canonica.id);

    // Nenhuma acao administrativa se aplica a ela (EXP-49)
    const recusas = await Promise.all([
      approveExperimental(pg.db, { experimentalId: duplicada.id }),
      refuseExperimental(pg.db, { experimentalId: duplicada.id }),
      changeExperimentalOccurrence(pg.db, {
        experimentalId: duplicada.id,
        classSlotId: slotId,
        date,
      }),
      rescheduleExperimental(pg.db, {
        experimentalId: duplicada.id,
        classSlotId: slotId,
        date,
      }),
      cancelExperimental(pg.db, { experimentalId: duplicada.id }),
      registerPayment(pg.db, {
        experimentalId: duplicada.id,
        paymentStatus: "PAGO",
      }),
      registerWhatsAppContact(pg.db, { experimentalId: duplicada.id }),
    ]);
    expect(recusas.every((resultado) => !resultado.ok)).toBe(true);
    for (const resultado of recusas) {
      if (!resultado.ok) {
        expect(resultado.error).toContain("somente leitura");
      }
    }

    // Nada mudou: a tentativa segue como estava
    const [registro] = await pg.db
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, duplicada.id));
    expect(registro.status).toBe("DUPLICADA");
    expect(registro.paymentStatus).toBe("PENDENTE");
    expect(registro.whatsappContactedAt).toBeNull();
    expect(registro.cancelledAt).toBeNull();
  });

  it("grade lista a aprovada como participante experimental", async () => {
    const { sessionId } = await occurrence(3, 2);
    const outra = await occurrence(4, 2);

    // A aprovada da primeira ocorrencia: entra na lista de participantes
    const aprovada = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "APROVADA",
      name: "Maria Aprovada",
      phone: "(11) 98888-7777",
    });

    // Os demais status nao entram: so a aprovada ocupa a vaga (EXP-42)
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      name: "Joana Pendente",
      phone: "(11) 97777-6666",
    });
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "CANCELADA_COM_DIREITO",
      name: "Ana Cancelada",
      phone: "(11) 96666-5555",
    });
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "FALTA",
      name: "Bruna Falta",
      phone: "(11) 95555-4444",
    });
    await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "CONVERTIDA",
      name: "Carla Convertida",
      phone: "(11) 94444-3333",
    });

    // Uma aprovada de outra ocorrencia: nao entra na lista da primeira
    await createExperimental(pg.db, {
      classSessionId: outra.sessionId,
      status: "APROVADA",
      name: "Daniela Otra",
      phone: "(11) 93333-2222",
    });

    const lista = await listApprovedExperimentalsBySession(pg.db, [sessionId]);

    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe(aprovada.id);
    expect(lista[0].name).toBe("Maria Aprovada");
    expect(lista[0].classSessionId).toBe(sessionId);

    // Sem ocorrencia nao ha nada a listar
    expect(await listApprovedExperimentalsBySession(pg.db, [])).toEqual([]);
  });
});
