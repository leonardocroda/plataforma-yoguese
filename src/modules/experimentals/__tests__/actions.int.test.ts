import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { classSessions, experimentals } from "../../../db/schema";
import {
  createExperimental,
  createTestClass,
  clearTables,
} from "../../../test/fixtures";
import {
  authTestState,
  nextHeadersMock,
  resetAuthTestState,
  TEST_AUTH_SECRET,
} from "../../../test/auth";
import { PostgresTestInstance, startPostgres } from "../../../test/postgres";
import { addDays, nextOccurrence, todayInStudio } from "../../classes/domain/occurrences";
import { materializeSession } from "../../bookings/services/sessions";
import { setSessionCookie } from "../../auth/services/session";
import {
  approveExperimentalAction,
  cancelExperimentalAction,
  changeExperimentalOccurrenceAction,
  convertExperimentalAction,
  refuseExperimentalAction,
  registerNoShowAction,
  registerPaymentAction,
  registerWhatsAppContactAction,
  requestExperimentalAction,
  rescheduleExperimentalAction,
} from "../actions";

// EXP-06, EXP-28, EXP-29: a solicitacao publica nao exige sessao - a action
// funciona sem cookie e devolve o erro do servico para a tela. Toda action
// administrativa exige sessao de ADMIN no servidor.

vi.mock("next/headers", () => nextHeadersMock());

describe("experimental actions", () => {
  let pg: PostgresTestInstance;
  let today: string;

  beforeAll(async () => {
    pg = await startPostgres();
    // As actions usam o client de src/db: o env aponta para o banco de teste
    process.env.DATABASE_URL = pg.container.getConnectionUri();
    vi.resetModules();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
    resetAuthTestState();
    today = todayInStudio(new Date());
  });

  afterAll(async () => {
    const { db } = await import("../../../db");
    await db.$client.end();
    delete process.env.DATABASE_URL;
    await pg.pool.end();
    await pg.container.stop();
  });

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

  /** Sessao de admin no cookie mockado (AUTH-02). */
  async function adminSession() {
    await setSessionCookie({ id: "admin-de-teste", role: "ADMIN" });
  }

  /**
   * redirect() lanca o erro do Next: o caminho vem no digest. Capturar a
   * rejeicao e o jeito de provar o destino sem um browser.
   */
  async function digestOf(run: Promise<unknown>): Promise<string> {
    const error = await run.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    return (error as { digest?: string }).digest ?? "";
  }

  it("action publica cria solicitacao sem sessao", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(2);

    // Sem cookie de sessao: a solicitacao e do visitante
    authTestState.jar.clear();
    expect(authTestState.jar.size).toBe(0);

    const result = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDENTE");
    expect(result.value.paymentStatus).toBe("PENDENTE");
    expect(result.value.classSessionId).toBe(sessionId);
    expect(result.value.phoneNormalized).toBe("11988887777");

    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.value.id);
  });

  it("action devolve o erro do servico para a tela", async () => {
    const { classTypeId, slotId, date, sessionId } = await occurrence(2);

    const semNome = await requestExperimentalAction({
      name: "  ",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(semNome.ok).toBe(false);
    if (!semNome.ok) {
      expect(semNome.field).toBe("name");
      expect(semNome.error).toContain("nome obrigatorio");
    }

    const semDeclaracao = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: false,
    });
    expect(semDeclaracao.ok).toBe(false);
    if (!semDeclaracao.ok) {
      expect(semDeclaracao.field).toBe("healthDeclaration");
    }

    // O telefone repetido volta com a mensagem de experimental existente
    const primeira = await requestExperimentalAction({
      name: "Maria Visitante",
      phone: "(11) 98888-7777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(primeira.ok).toBe(true);

    const duplicada = await requestExperimentalAction({
      name: "Outra Maria",
      phone: "11988887777",
      classTypeId,
      classSlotId: slotId,
      date,
      declarationAccepted: true,
    });
    expect(duplicada.ok).toBe(false);
    if (!duplicada.ok) {
      expect(duplicada.field).toBe("phone");
      expect(duplicada.error).toContain("ja existe uma aula experimental");
    }

    // As actions administrativas devolvem o erro do servico tambem
    await adminSession();

    // Uma ocorrencia lotada: a aprovacao nao passa
    const lotada = await createTestClass(pg.db, {
      weekday: 4,
      capacity: 1,
    });
    const dataLotada = nextOccurrence({ weekday: 4 }, today);
    const materialized = await materializeSession(pg.db, {
      classSlotId: lotada.slotId,
      date: dataLotada,
    });
    if (!materialized.ok) throw new Error(materialized.error);
    await createExperimental(pg.db, {
      classSessionId: materialized.value.id,
      status: "APROVADA",
      phone: "(11) 97777-6666",
    });
    const semVaga = await createExperimental(pg.db, {
      classSessionId: materialized.value.id,
      status: "PENDENTE",
      phone: "(11) 94444-3333",
    });

    const recusa = await approveExperimentalAction({
      experimentalId: semVaga.id,
    });
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) {
      expect(recusa.error).toContain("sem vaga");
    }

    // O pagamento invalido devolve o erro do campo
    const pagamento = await registerPaymentAction({
      experimentalId: semVaga.id,
      paymentStatus: "PIX",
    });
    expect(pagamento.ok).toBe(false);
    if (!pagamento.ok) {
      expect(pagamento.field).toBe("paymentStatus");
      expect(pagamento.error).toContain("status de pagamento invalido");
    }

    // A solicitacao inexistente tambem volta como erro
    const inexistente = await approveExperimentalAction({
      experimentalId: "00000000-0000-0000-0000-000000000000",
    });
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) {
      expect(inexistente.error).toContain("solicitacao nao encontrada");
    }

    // A conversao devolve o erro do campo para a tela: uma experimental
    // aprovada cuja aula ja acabou chega na validacao do e-mail
    const passada = await createTestClass(pg.db, {
      weekday: 5,
      capacity: 2,
    });
    const [sessionPassada] = await pg.db
      .insert(classSessions)
      .values({
        classSlotId: passada.slotId,
        sessionDate: addDays(today, -7),
        status: "AGENDADA",
      })
      .returning();
    const convertivel = await createExperimental(pg.db, {
      classSessionId: sessionPassada.id,
      status: "APROVADA",
      phone: "(11) 93333-2222",
    });

    const conversao = await convertExperimentalAction({
      experimentalId: convertivel.id,
      email: "nao-e-email",
      birthDate: "1990-05-10",
      planId: "00000000-0000-0000-0000-000000000000",
      classSlotIds: [slotId],
    });
    expect(conversao.ok).toBe(false);
    if (!conversao.ok) {
      expect(conversao.field).toBe("email");
    }

    // Com sessao de admin, a acao aplica e devolve o registro
    const pendente = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 95555-4444",
    });
    const aprovada = await approveExperimentalAction({
      experimentalId: pendente.id,
    });
    expect(aprovada.ok).toBe(true);
    if (!aprovada.ok) return;
    expect(aprovada.value.status).toBe("APROVADA");
  });

  it("toda action admin exige sessao de ADMIN", async () => {
    const { slotId, date, sessionId } = await occurrence(2);
    const experimental = await createExperimental(pg.db, {
      classSessionId: sessionId,
      status: "PENDENTE",
      phone: "(11) 98888-7777",
    });

    // Sem cookie de sessao: o guard manda para o login antes de tocar o
    // servico, uma action por vez
    const actions: Array<[string, Promise<unknown>]> = [
      ["aprovar", approveExperimentalAction({ experimentalId: experimental.id })],
      ["recusar", refuseExperimentalAction({ experimentalId: experimental.id })],
      [
        "trocar ocorrencia",
        changeExperimentalOccurrenceAction({
          experimentalId: experimental.id,
          classSlotId: slotId,
          date,
        }),
      ],
      [
        "reagendar",
        rescheduleExperimentalAction({
          experimentalId: experimental.id,
          classSlotId: slotId,
          date,
        }),
      ],
      ["cancelar", cancelExperimentalAction({ experimentalId: experimental.id })],
      ["falta", registerNoShowAction({ experimentalId: experimental.id })],
      [
        "pagamento",
        registerPaymentAction({
          experimentalId: experimental.id,
          paymentStatus: "PAGO",
        }),
      ],
      [
        "contato",
        registerWhatsAppContactAction({ experimentalId: experimental.id }),
      ],
      [
        "converter",
        convertExperimentalAction({
          experimentalId: experimental.id,
          email: "maria@teste.com",
          birthDate: "1990-05-10",
          planId: "00000000-0000-0000-0000-000000000000",
          classSlotIds: [slotId],
        }),
      ],
    ];

    for (const [nome, promise] of actions) {
      const digest = await digestOf(promise);
      expect(digest, nome).toContain("/login");
    }

    // Nada foi gravado: a recusa vem antes do servico
    const rows = await pg.db.select().from(experimentals);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDENTE");
    expect(rows[0].paymentStatus).toBe("PENDENTE");
    expect(rows[0].whatsappContactedAt).toBeNull();
    expect(rows[0].cancelledAt).toBeNull();
  });
});

// Segredo do ambiente de teste: o jar de cookies do mock usa ele
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
