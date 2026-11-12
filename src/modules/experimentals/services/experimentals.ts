// Servicos da experimental (PRD 8.1 a 8.5, 13, EXP-06 a EXP-40). O
// visitante escolhe uma ocorrencia concreta com vaga; o servidor revalida
// tudo antes de gravar a solicitacao pendente. A duplicidade e por telefone
// normalizado: a tentativa bloqueada fica gravada como DUPLICADA, ligada a
// solicitacao existente, e e somente leitura. A aprovacao ocupa a vaga da
// ocorrencia e a recusa libera o telefone.

import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  classSessions,
  classSlots,
  classTypes,
  experimentalReschedules,
  experimentals,
  students,
} from "../../../db/schema";
import {
  getComposition,
  getOccurrenceComposition,
} from "../../bookings/services/composition";
import {
  materializeSession,
  type DbClient,
} from "../../bookings/services/sessions";
import { listActiveSlots } from "../../classes/services/classes";
import {
  addDays,
  occurrenceDates,
  studioDateTimeToInstant,
  todayInStudio,
} from "../../classes/domain/occurrences";
import { isUniqueViolation } from "../../students/services/students";
import { normalizePhone } from "../domain/phone";
import {
  canCancel,
  canReschedule,
  cancellationKeepsRight,
} from "../domain/rules";
import {
  HEALTH_DECLARATION,
  validateExperimentalRequest,
  type ExperimentalPaymentStatus,
  type ExperimentalStatus,
} from "../domain/validators";

export type Experimental = typeof experimentals.$inferSelect;

export type ExperimentalRequestInput = {
  name: string;
  phone: string;
  classTypeId: string;
  classSlotId: string;
  date: string;
  declarationAccepted: boolean;
};

export type ExperimentalResult =
  | { ok: true; value: Experimental }
  | { ok: false; error: string; field?: string };

export type ExperimentalRequestResult = ExperimentalResult;

/** Os quatro status de pagamento do PRD 8.4 (EXP-25, EXP-33). */
const PAYMENT_STATUSES: readonly ExperimentalPaymentStatus[] = [
  "PENDENTE",
  "PAGO",
  "ISENTO",
  "REEMBOLSADO",
];

/** O valor recebido e um dos quatro status do PRD 8.4. */
function isPaymentStatus(value: string): value is ExperimentalPaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

const DUPLICATE_ERROR = "ja existe uma aula experimental para este telefone";

/**
 * A solicitacao canonica do telefone: a que bloqueia uma nova solicitacao.
 * O filtro e o mesmo do indice unico parcial - tentativas DUPLICADA e a
 * recusada ficam de fora (EXP-48).
 */
async function findCanonicalByPhone(
  db: DbClient,
  phoneNormalized: string,
): Promise<Experimental | undefined> {
  const [row] = await db
    .select()
    .from(experimentals)
    .where(
      and(
        eq(experimentals.phoneNormalized, phoneNormalized),
        ne(experimentals.status, "RECUSADA"),
        isNull(experimentals.duplicateOfId),
      ),
    )
    .limit(1);
  return row;
}

/** Grava a tentativa bloqueada, ligada a solicitacao existente (EXP-09). */
async function recordDuplicateAttempt(
  db: DbClient,
  input: {
    name: string;
    phone: string;
    phoneNormalized: string;
    classSessionId: string;
    existingId: string;
    now: Date;
  },
): Promise<void> {
  await db.insert(experimentals).values({
    name: input.name,
    phone: input.phone,
    phoneNormalized: input.phoneNormalized,
    classSessionId: input.classSessionId,
    status: "DUPLICADA",
    duplicateOfId: input.existingId,
    healthDeclaration: HEALTH_DECLARATION,
    requestedAt: input.now,
  });
}

/**
 * Cria a solicitacao publica de experimental (EXP-06 a EXP-16).
 *
 * A solicitacao nasce PENDENTE e nao ocupa vaga: a ocupacao vem com a
 * aprovacao. A declaracao aceita e o texto do PRD, gravado pelo servidor,
 * e o `requested_at` e o instante do envio.
 *
 * O telefone normalizado identifica a pessoa: com uma solicitacao anterior
 * nao recusada, a nova e recusada e a tentativa fica gravada como
 * DUPLICADA. Duas submissoes do mesmo telefone ao mesmo tempo fecham uma
 * unica solicitacao: a outra vira DUPLICADA.
 */
export async function createExperimentalRequest(
  db: DbClient,
  input: ExperimentalRequestInput,
  now: Date = new Date(),
): Promise<ExperimentalRequestResult> {
  const validation = validateExperimentalRequest(input);
  if (!validation.ok) {
    const first = validation.errors[0];
    return {
      ok: false,
      error: `${first.field}: ${first.message}`,
      field: first.field,
    };
  }

  const phoneNormalized = normalizePhone(input.phone);
  const name = input.name.trim();
  const phone = input.phone.trim();

  // A turma escolhida: ela define a capacidade e a modalidade da
  // ocorrencia
  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, input.classSlotId));
  if (!slot) {
    return { ok: false, error: "turma nao encontrada", field: "classSlotId" };
  }
  if (slot.classTypeId !== input.classTypeId) {
    return {
      ok: false,
      error: "a ocorrencia nao pertence a modalidade escolhida",
      field: "classTypeId",
    };
  }

  // A ocorrencia precisa existir, ser futura e estar agendada
  const materialized = await materializeSession(
    db,
    { classSlotId: input.classSlotId, date: input.date },
    now,
  );
  if (!materialized.ok) {
    return {
      ok: false,
      error: materialized.error,
      field: materialized.field,
    };
  }
  const session = materialized.value;
  if (session.status !== "AGENDADA") {
    return {
      ok: false,
      error:
        session.status === "BLOQUEADA"
          ? "ocorrencia bloqueada por feriado/recesso"
          : "ocorrencia cancelada",
      field: "date",
    };
  }

  // Duplicidade: o telefone ja tem solicitacao, a nova e recusada e a
  // tentativa fica gravada para a consulta do admin
  const existing = await findCanonicalByPhone(db, phoneNormalized);
  if (existing) {
    await recordDuplicateAttempt(db, {
      name,
      phone,
      phoneNormalized,
      classSessionId: session.id,
      existingId: existing.id,
      now,
    });
    return { ok: false, error: DUPLICATE_ERROR, field: "phone" };
  }

  // Vaga: a composicao e a fonte unica da ocupacao (RES-27)
  const composition = await getOccurrenceComposition(db, {
    classSlotId: input.classSlotId,
    sessionId: session.id,
    date: session.sessionDate,
    capacity: slot.capacity,
  });
  if (composition.availableSpots <= 0) {
    return {
      ok: false,
      error: "sem vaga disponivel nesta ocorrencia",
      field: "date",
    };
  }

  try {
    const [created] = await db
      .insert(experimentals)
      .values({
        name,
        phone,
        phoneNormalized,
        classSessionId: session.id,
        healthDeclaration: HEALTH_DECLARATION,
        requestedAt: now,
      })
      .returning();

    if (created) return { ok: true, value: created };
    return { ok: false, error: "falha ao gravar a solicitacao" };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Perdeu a corrida: outra solicitacao do mesmo telefone foi gravada
    // antes. A tentativa vira DUPLICADA, ligada a vencedora.
    const winner = await findCanonicalByPhone(db, phoneNormalized);
    if (!winner) {
      return { ok: false, error: "falha ao gravar a solicitacao" };
    }
    await recordDuplicateAttempt(db, {
      name,
      phone,
      phoneNormalized,
      classSessionId: session.id,
      existingId: winner.id,
      now,
    });
    return { ok: false, error: DUPLICATE_ERROR, field: "phone" };
  }
}

/** Opcao de ocorrencia oferecida ao visitante (EXP-04). */
export type OccurrenceOption = {
  classTypeId: string;
  classTypeName: string;
  classSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  availableSpots: number;
};

/** Janela da agenda do formulario publico: os proximos 30 dias. */
const OCCURRENCE_WINDOW_DAYS = 30;

/**
 * Ocorrencias que o visitante pode escolher (EXP-04, EXP-05, EXP-13,
 * EXP-15): futuras, de turma e modalidade ativas, agendadas e com pelo
 * menos uma vaga. A opcao publica carrega data, horario, modalidade e
 * vagas - nunca nome nem telefone de ninguem.
 */
export async function listExperimentalOccurrences(
  db: DbClient,
  input: { classTypeId?: string } = {},
  now: Date = new Date(),
): Promise<OccurrenceOption[]> {
  const today = todayInStudio(now);
  const to = addDays(today, OCCURRENCE_WINDOW_DAYS);

  const slots = await listActiveSlots(db);
  const options: OccurrenceOption[] = [];

  for (const slot of slots) {
    if (input.classTypeId && slot.classTypeId !== input.classTypeId) continue;

    for (const date of occurrenceDates(slot, today, to)) {
      const composition = await getComposition(db, {
        classSlotId: slot.id,
        date,
      });
      if (!composition.ok) continue;
      // Ocorrencia bloqueada por feriado/recesso ou cancelada nao aparece
      if (composition.value.sessionStatus !== "AGENDADA") continue;
      // Sem vaga, nao ha o que oferecer
      if (composition.value.availableSpots <= 0) continue;

      options.push({
        classTypeId: slot.classTypeId,
        classTypeName: slot.classTypeName,
        classSlotId: slot.id,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableSpots: composition.value.availableSpots,
      });
    }
  }

  options.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );

  return options;
}

// ---- operacao administrativa (PRD 8.3, 8.4, EXP-20 a EXP-29) ----

/**
 * A ocorrencia da experimental com a turma e a modalidade. A ocupacao e
 * conferida pela composicao (fonte unica, RES-27), que precisa da
 * capacidade da turma.
 */
async function loadOccurrence(
  db: DbClient,
  classSessionId: string,
): Promise<
  | {
      session: typeof classSessions.$inferSelect;
      slot: typeof classSlots.$inferSelect;
      classType: typeof classTypes.$inferSelect;
    }
  | undefined
> {
  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, classSessionId));
  if (!session) return undefined;

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, session.classSlotId));
  if (!slot) return undefined;

  const [classType] = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, slot.classTypeId));
  if (!classType) return undefined;

  return { session, slot, classType };
}

/**
 * Aprovacao (EXP-20 a EXP-22): a solicitacao pendente vira APROVADA e
 * ocupa a vaga da ocorrencia. A disponibilidade e revalidada dentro da
 * transacao, com a ocorrencia travada: duas aprovacoes concorrentes pela
 * ultima vaga confirmam exatamente uma.
 *
 * Sem vaga, ocorrencia bloqueada ou cancelada, ou turma/modalidade
 * inativa, a aprovacao e recusada e a solicitacao continua PENDENTE
 * (EXP-21).
 */
export async function approveExperimental(
  db: DbClient,
  input: { experimentalId: string },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (experimental.status !== "PENDENTE") {
    return {
      ok: false,
      error: "somente solicitacao pendente pode ser aprovada",
      field: "status",
    };
  }

  const occurrence = await loadOccurrence(db, experimental.classSessionId);
  if (!occurrence) {
    return { ok: false, error: "ocorrencia nao encontrada" };
  }
  const { session, slot, classType } = occurrence;

  if (session.status === "BLOQUEADA") {
    return { ok: false, error: "ocorrencia bloqueada por feriado/recesso" };
  }
  if (session.status === "CANCELADA") {
    return { ok: false, error: "ocorrencia cancelada" };
  }
  if (slot.status === "INATIVA") {
    return { ok: false, error: "turma inativa nao aceita experimentais" };
  }
  if (classType.status === "INATIVA") {
    return { ok: false, error: "modalidade inativa nao aceita experimentais" };
  }

  return db.transaction(async (tx): Promise<ExperimentalResult> => {
    // Trava a ocorrencia: a segunda aprovacao da ultima vaga ve a ocupacao
    // confirmada pela primeira
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, session.id))
      .for("update");

    const composition = await getOccurrenceComposition(tx, {
      classSlotId: slot.id,
      sessionId: session.id,
      date: session.sessionDate,
      capacity: slot.capacity,
    });
    if (composition.availableSpots <= 0) {
      return { ok: false, error: "sem vaga disponivel nesta ocorrencia" };
    }

    const [updated] = await tx
      .update(experimentals)
      .set({ status: "APROVADA", approvedAt: now, updatedAt: now })
      .where(eq(experimentals.id, experimental.id))
      .returning();
    if (!updated) {
      return { ok: false, error: "falha ao aprovar a solicitacao" };
    }
    return { ok: true, value: updated };
  });
}

/**
 * Recusa (EXP-23): a solicitacao vira RECUSADA, o registro continua
 * consultavel e o telefone volta a ficar livre para uma nova solicitacao -
 * o indice unico do telefone nao alcanca a recusada.
 */
export async function refuseExperimental(
  db: DbClient,
  input: { experimentalId: string },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (
    experimental.status !== "PENDENTE" &&
    experimental.status !== "APROVADA"
  ) {
    return {
      ok: false,
      error: "somente solicitacao pendente ou aprovada pode ser recusada",
      field: "status",
    };
  }

  const [updated] = await db
    .update(experimentals)
    .set({ status: "RECUSADA", updatedAt: now })
    .where(eq(experimentals.id, experimental.id))
    .returning();
  if (!updated) {
    return { ok: false, error: "falha ao recusar a solicitacao" };
  }
  return { ok: true, value: updated };
}

/** Nova ocorrencia escolhida pelo admin (data e horario). */
export type ChangeOccurrenceInput = {
  experimentalId: string;
  classSlotId: string;
  date: string;
};

/**
 * Materializa a ocorrencia escolhida e recusa a que nao vai acontecer:
 * data passada, ocorrencia bloqueada ou cancelada nao aceitam experimental
 * (EXP-24).
 */
async function resolveTargetOccurrence(
  db: DbClient,
  input: { classSlotId: string; date: string },
  now: Date,
): Promise<
  | { ok: true; value: typeof classSessions.$inferSelect }
  | { ok: false; error: string; field?: string }
> {
  const materialized = await materializeSession(
    db,
    { classSlotId: input.classSlotId, date: input.date },
    now,
  );
  if (!materialized.ok) {
    return { ok: false, error: materialized.error, field: materialized.field };
  }
  const session = materialized.value;
  if (session.status === "BLOQUEADA") {
    return { ok: false, error: "ocorrencia bloqueada por feriado/recesso" };
  }
  if (session.status === "CANCELADA") {
    return { ok: false, error: "ocorrencia cancelada" };
  }
  return { ok: true, value: session };
}

/**
 * Trava as duas ocorrencias de uma troca em ordem estavel: duas trocas
 * simultaneas nao se cruzam.
 */
async function lockOccurrences(tx: DbClient, sessionIds: string[]): Promise<void> {
  for (const id of [...new Set(sessionIds)].sort()) {
    await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, id))
      .for("update");
  }
}

/**
 * Troca de data/horario (EXP-24): a solicitacao pendente continua pendente
 * e a aprovada troca a vaga ocupada de forma atomica. A nova ocorrencia
 * precisa existir, estar agendada e ter vaga - sem vaga a troca e recusada e
 * a ocorrencia anterior e mantida.
 *
 * A ocorrencia anterior fica gravada no historico de reagendamentos.
 */
export async function changeExperimentalOccurrence(
  db: DbClient,
  input: ChangeOccurrenceInput,
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (
    experimental.status !== "PENDENTE" &&
    experimental.status !== "APROVADA"
  ) {
    return {
      ok: false,
      error: "somente solicitacao pendente ou aprovada troca de data/horario",
      field: "status",
    };
  }

  const target = await resolveTargetOccurrence(
    db,
    { classSlotId: input.classSlotId, date: input.date },
    now,
  );
  if (!target.ok) {
    return { ok: false, error: target.error, field: target.field };
  }
  const session = target.value;

  // Troca para a mesma ocorrencia nao muda nada
  if (session.id === experimental.classSessionId) {
    return { ok: true, value: experimental };
  }

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, session.classSlotId));
  if (!slot) {
    return { ok: false, error: "turma nao encontrada" };
  }

  return db.transaction(async (tx): Promise<ExperimentalResult> => {
    await lockOccurrences(tx, [experimental.classSessionId, session.id]);

    const composition = await getOccurrenceComposition(tx, {
      classSlotId: slot.id,
      sessionId: session.id,
      date: session.sessionDate,
      capacity: slot.capacity,
    });
    if (composition.availableSpots <= 0) {
      return { ok: false, error: "sem vaga disponivel na nova ocorrencia" };
    }

    const [updated] = await tx
      .update(experimentals)
      .set({ classSessionId: session.id, updatedAt: now })
      .where(eq(experimentals.id, experimental.id))
      .returning();
    if (!updated) {
      return { ok: false, error: "falha ao trocar a ocorrencia" };
    }

    await tx.insert(experimentalReschedules).values({
      experimentalId: experimental.id,
      fromSessionId: experimental.classSessionId,
      toSessionId: session.id,
      reason: "Troca de data/horario",
      rescheduledAt: now,
    });

    return { ok: true, value: updated };
  });
}

/**
 * Reagendamento (EXP-39, EXP-40): a cancelada com direito volta a
 * APROVADA em outra ocorrencia com vaga, na mesma transacao, e a ocorrencia
 * anterior fica gravada no historico. Sem vaga o reagendamento e recusado e
 * o status e o direito anteriores ficam como estavam.
 *
 * O direito so se exerce no mesmo registro (EXP-47): o telefone continua
 * bloqueado para uma nova solicitacao publica.
 */
export async function rescheduleExperimental(
  db: DbClient,
  input: ChangeOccurrenceInput,
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (!canReschedule(experimental.status)) {
    return {
      ok: false,
      error: "somente cancelada com direito pode ser reagendada",
      field: "status",
    };
  }

  const target = await resolveTargetOccurrence(
    db,
    { classSlotId: input.classSlotId, date: input.date },
    now,
  );
  if (!target.ok) {
    return { ok: false, error: target.error, field: target.field };
  }
  const session = target.value;

  const [slot] = await db
    .select()
    .from(classSlots)
    .where(eq(classSlots.id, session.classSlotId));
  if (!slot) {
    return { ok: false, error: "turma nao encontrada" };
  }

  return db.transaction(async (tx): Promise<ExperimentalResult> => {
    await lockOccurrences(tx, [experimental.classSessionId, session.id]);

    const composition = await getOccurrenceComposition(tx, {
      classSlotId: slot.id,
      sessionId: session.id,
      date: session.sessionDate,
      capacity: slot.capacity,
    });
    if (composition.availableSpots <= 0) {
      return { ok: false, error: "sem vaga disponivel na nova ocorrencia" };
    }

    const [updated] = await tx
      .update(experimentals)
      .set({
        classSessionId: session.id,
        status: "APROVADA",
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(experimentals.id, experimental.id))
      .returning();
    if (!updated) {
      return { ok: false, error: "falha ao reagendar a solicitacao" };
    }

    await tx.insert(experimentalReschedules).values({
      experimentalId: experimental.id,
      fromSessionId: experimental.classSessionId,
      toSessionId: session.id,
      reason: "Reagendamento apos cancelamento com direito",
      rescheduledAt: now,
    });

    return { ok: true, value: updated };
  });
}

/** Antecedencia em horas entre o instante dado e o inicio da ocorrencia. */
const MS_PER_HOUR = 3_600_000;

/**
 * Cancelamento (EXP-34, EXP-35, EXP-37, EXP-38): com 24 horas ou mais de
 * antecedencia o cancelamento mantem o direito ao reagendamento; com menos,
 * o direito acaba. A vaga volta nos dois casos, porque so a aprovada
 * ocupa.
 *
 * Depois do inicio da ocorrencia o cancelamento e recusado e o caminho
 * indicado e o registro de falta (EXP-37).
 */
export async function cancelExperimental(
  db: DbClient,
  input: { experimentalId: string },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (!canCancel(experimental.status)) {
    return {
      ok: false,
      error: "status nao aceita cancelamento",
      field: "status",
    };
  }

  const occurrence = await loadOccurrence(db, experimental.classSessionId);
  if (!occurrence) {
    return { ok: false, error: "ocorrencia nao encontrada" };
  }
  const { session, slot } = occurrence;

  const start = studioDateTimeToInstant(session.sessionDate, slot.startTime);
  if (now.getTime() >= start.getTime()) {
    return {
      ok: false,
      error: "cancelamento apos o inicio da ocorrencia: registre a falta",
      field: "status",
    };
  }

  const hoursBeforeStart = (start.getTime() - now.getTime()) / MS_PER_HOUR;
  const status = cancellationKeepsRight(hoursBeforeStart)
    ? "CANCELADA_COM_DIREITO"
    : "CANCELADA_SEM_DIREITO";

  const [updated] = await db
    .update(experimentals)
    .set({ status, cancelledAt: now, updatedAt: now })
    .where(eq(experimentals.id, experimental.id))
    .returning();
  if (!updated) {
    return { ok: false, error: "falha ao cancelar a solicitacao" };
  }
  return { ok: true, value: updated };
}

/**
 * Falta (EXP-36): so depois do inicio da ocorrencia. A falta libera a
 * vaga e encerra o direito ao reagendamento.
 */
export async function registerNoShow(
  db: DbClient,
  input: { experimentalId: string },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }
  if (!canCancel(experimental.status)) {
    return {
      ok: false,
      error: "status nao aceita registro de falta",
      field: "status",
    };
  }

  const occurrence = await loadOccurrence(db, experimental.classSessionId);
  if (!occurrence) {
    return { ok: false, error: "ocorrencia nao encontrada" };
  }
  const { session, slot } = occurrence;

  const start = studioDateTimeToInstant(session.sessionDate, slot.startTime);
  if (now.getTime() < start.getTime()) {
    return {
      ok: false,
      error: "falta so pode ser registrada depois do inicio da ocorrencia",
      field: "status",
    };
  }

  const [updated] = await db
    .update(experimentals)
    .set({ status: "FALTA", noShowAt: now, updatedAt: now })
    .where(eq(experimentals.id, experimental.id))
    .returning();
  if (!updated) {
    return { ok: false, error: "falha ao registrar a falta" };
  }
  return { ok: true, value: updated };
}

/**
 * Pagamento manual (EXP-25): o admin grava um dos quatro status do PRD
 * 8.4 - Pendente, Pago, Isento ou Reembolsado. O pagamento nao bloqueia
 * aprovacao nem conversao.
 */
export async function registerPayment(
  db: DbClient,
  input: {
    experimentalId: string;
    paymentStatus: string;
  },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  if (!isPaymentStatus(input.paymentStatus)) {
    return {
      ok: false,
      error: "status de pagamento invalido",
      field: "paymentStatus",
    };
  }

  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }

  const [updated] = await db
    .update(experimentals)
    .set({ paymentStatus: input.paymentStatus, updatedAt: now })
    .where(eq(experimentals.id, experimental.id))
    .returning();
  if (!updated) {
    return { ok: false, error: "falha ao registrar o pagamento" };
  }
  return { ok: true, value: updated };
}

/**
 * Contato via WhatsApp (EXP-26): o admin registra o instante do contato,
 * que aparece no detalhe da solicitacao.
 */
export async function registerWhatsAppContact(
  db: DbClient,
  input: { experimentalId: string },
  now: Date = new Date(),
): Promise<ExperimentalResult> {
  const [experimental] = await db
    .select()
    .from(experimentals)
    .where(eq(experimentals.id, input.experimentalId));
  if (!experimental) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }
  if (experimental.status === "DUPLICADA") {
    return { ok: false, error: "tentativa duplicada e somente leitura" };
  }

  const [updated] = await db
    .update(experimentals)
    .set({ whatsappContactedAt: now, updatedAt: now })
    .where(eq(experimentals.id, experimental.id))
    .returning();
  if (!updated) {
    return { ok: false, error: "falha ao registrar o contato" };
  }
  return { ok: true, value: updated };
}

// ---- leitura das aprovadas por sessao (EXP-43) ----

/** A experimental aprovada de uma ocorrencia, como a grade a lista. */
export type ApprovedExperimental = {
  id: string;
  name: string;
  classSessionId: string;
};

/**
 * As experimentais aprovadas das ocorrencias informadas (EXP-43): a grade
 * lista cada uma como participante experimental, com o nome da pessoa. So a
 * APROVADA ocupa a vaga e aparece na lista de participantes; os demais
 * status nao contam na ocupacao (EXP-42).
 */
export async function listApprovedExperimentalsBySession(
  db: DbClient,
  classSessionIds: string[],
): Promise<ApprovedExperimental[]> {
  if (classSessionIds.length === 0) return [];

  return db
    .select({
      id: experimentals.id,
      name: experimentals.name,
      classSessionId: experimentals.classSessionId,
    })
    .from(experimentals)
    .where(
      and(
        inArray(experimentals.classSessionId, classSessionIds),
        eq(experimentals.status, "APROVADA"),
      ),
    );
}


/** A ocorrencia da experimental, com a turma e a modalidade (EXP-17). */
export type ExperimentalOccurrence = {
  classSessionId: string;
  classSlotId: string;
  classTypeId: string;
  classTypeName: string;
  date: string;
  startTime: string;
  endTime: string;
};

/** Linha da listagem do admin (EXP-17, EXP-18). */
export type ExperimentalListItem = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  status: ExperimentalStatus;
  paymentStatus: ExperimentalPaymentStatus;
  requestedAt: Date;
  duplicateOfId: string | null;
  occurrence: ExperimentalOccurrence;
};

/** A aluna criada na conversao (EXP-19, EXP-60). */
export type ConvertedStudent = {
  id: string;
  name: string;
  email: string;
  status: string;
};

/** Historico de reagendamentos da solicitacao (PRD 8.5). */
export type ExperimentalRescheduleEntry = {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  reason: string;
  rescheduledAt: Date;
};

/** Detalhe da solicitacao (EXP-19, EXP-60). */
export type ExperimentalDetail = {
  experimental: Experimental;
  occurrence: ExperimentalOccurrence;
  convertedStudent: ConvertedStudent | null;
  reschedules: ExperimentalRescheduleEntry[];
};

export type ExperimentalDetailResult =
  | { ok: true; value: ExperimentalDetail }
  | { ok: false; error: string; field?: string };

/** Projecao da listagem: a solicitacao com a sua ocorrencia. */
const LIST_PROJECTION = {
  id: experimentals.id,
  name: experimentals.name,
  phone: experimentals.phone,
  phoneNormalized: experimentals.phoneNormalized,
  status: experimentals.status,
  paymentStatus: experimentals.paymentStatus,
  requestedAt: experimentals.requestedAt,
  duplicateOfId: experimentals.duplicateOfId,
  classSessionId: classSessions.id,
  classSlotId: classSlots.id,
  classTypeId: classTypes.id,
  classTypeName: classTypes.name,
  date: classSessions.sessionDate,
  startTime: classSlots.startTime,
  endTime: classSlots.endTime,
};

/**
 * Listagem do admin (EXP-17, EXP-18): nome, telefone, data/horario,
 * modalidade, status, pagamento e a data da solicitacao. Com telefone
 * informado, a busca traz todas as tentativas daquele telefone
 * normalizado - inclusive a duplicada, a recusada, a cancelada, a falta
 * e a convertida.
 */
export async function listExperimentals(
  db: DbClient,
  input: { phone?: string } = {},
): Promise<ExperimentalListItem[]> {
  const phoneNormalized =
    input.phone === undefined ? null : normalizePhone(input.phone);

  const rows = await db
    .select(LIST_PROJECTION)
    .from(experimentals)
    .innerJoin(classSessions, eq(experimentals.classSessionId, classSessions.id))
    .innerJoin(classSlots, eq(classSessions.classSlotId, classSlots.id))
    .innerJoin(classTypes, eq(classSlots.classTypeId, classTypes.id))
    .where(
      phoneNormalized === null
        ? undefined
        : eq(experimentals.phoneNormalized, phoneNormalized),
    )
    .orderBy(desc(experimentals.requestedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneNormalized: row.phoneNormalized,
    status: row.status,
    paymentStatus: row.paymentStatus,
    requestedAt: row.requestedAt,
    duplicateOfId: row.duplicateOfId,
    occurrence: {
      classSessionId: row.classSessionId,
      classSlotId: row.classSlotId,
      classTypeId: row.classTypeId,
      classTypeName: row.classTypeName,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    },
  }));
}

/**
 * Detalhe da solicitacao (EXP-19, EXP-60): a declaracao, os timestamps do
 * ciclo de vida, a ocorrencia, o historico de reagendamentos e a aluna
 * convertida, quando houver.
 */
export async function getExperimental(
  db: DbClient,
  input: { experimentalId: string },
): Promise<ExperimentalDetailResult> {
  const [row] = await db
    .select({
      experimental: experimentals,
      date: classSessions.sessionDate,
      classSlotId: classSlots.id,
      classTypeId: classTypes.id,
      classTypeName: classTypes.name,
      startTime: classSlots.startTime,
      endTime: classSlots.endTime,
    })
    .from(experimentals)
    .innerJoin(classSessions, eq(experimentals.classSessionId, classSessions.id))
    .innerJoin(classSlots, eq(classSessions.classSlotId, classSlots.id))
    .innerJoin(classTypes, eq(classSlots.classTypeId, classTypes.id))
    .where(eq(experimentals.id, input.experimentalId));

  if (!row) {
    return {
      ok: false,
      error: "solicitacao nao encontrada",
      field: "experimentalId",
    };
  }

  let convertedStudent: ConvertedStudent | null = null;
  if (row.experimental.convertedStudentId) {
    const [student] = await db
      .select({
        id: students.id,
        name: students.name,
        email: students.email,
        status: students.status,
      })
      .from(students)
      .where(eq(students.id, row.experimental.convertedStudentId));
    convertedStudent = student ?? null;
  }

  const history = await db
    .select({
      id: experimentalReschedules.id,
      fromSessionId: experimentalReschedules.fromSessionId,
      toSessionId: experimentalReschedules.toSessionId,
      reason: experimentalReschedules.reason,
      rescheduledAt: experimentalReschedules.rescheduledAt,
    })
    .from(experimentalReschedules)
    .where(eq(experimentalReschedules.experimentalId, row.experimental.id))
    .orderBy(desc(experimentalReschedules.rescheduledAt));

  return {
    ok: true,
    value: {
      experimental: row.experimental,
      occurrence: {
        classSessionId: row.experimental.classSessionId,
        classSlotId: row.classSlotId,
        classTypeId: row.classTypeId,
        classTypeName: row.classTypeName,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
      },
      convertedStudent,
      reschedules: history,
    },
  };
}

