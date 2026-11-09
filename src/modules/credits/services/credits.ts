// Ledger de creditos (CRD-11 a CRD-14, CRD-34 a CRD-38): conceder, devolver,
// cancelar, reservar, liquidar na leitura e listar. O servico mexe so em
// credits/credit_transactions: nao importa o modulo de reservas.

import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import {
  bookings,
  classSessions,
  classSlots,
  creditSourceEnum,
  creditTransactions,
  credits,
} from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import {
  effectiveCreditStatus,
  type CreditStatus,
} from "../domain/credit-status";
import { creditExpiresAt } from "../domain/credit-rules";
import { STUDIO_TIMEZONE, todayInStudio } from "../../classes/domain/occurrences";
import {
  recordCreditTransaction,
  type CreditTransaction,
} from "./transactions";

export type { DbClient };

export type Credit = typeof credits.$inferSelect;

export type CreditSource = (typeof creditSourceEnum.enumValues)[number];

export type CreditChange = {
  credit: Credit;
  transaction: CreditTransaction;
};

export type CreditResult =
  | { ok: true; value: CreditChange }
  | { ok: false; error: string; field?: string };

/** Credito que o admin pode devolver (AD-021). */
const RETURNABLE_STATUSES: CreditStatus[] = [
  "RESERVADO",
  "UTILIZADO",
  "CANCELADO",
];

/** Janela dos creditos proximos do vencimento (PRD 4.1). */
const EXPIRING_SOON_DAYS = 7;

const STUDIO_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: STUDIO_TIMEZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export type GrantCreditInput = {
  studentId: string;
  source: CreditSource;
  /** Reserva de origem: o registro pontual do fixo cancelado. */
  sourceBookingId?: string | null;
  /** Ocorrencia de origem: a aula cancelada. */
  sourceSessionId?: string | null;
  reason: string;
  /** Responsavel pela concessao (rotulo enquanto nao ha auth, AD-016). */
  adminLabel: string;
  adminUserId?: string | null;
  generatedAt?: Date;
};

/**
 * Concede um credito DISPONIVEL com vencimento 30 dias depois da geracao
 * (CRD-11, CRD-34) e registra a transacao da concessao (CRD-15). No maximo
 * um credito por origem: a duplicata e recusada (CRD-14).
 */
export async function grantCredit(
  db: DbClient,
  input: GrantCreditInput,
  now: Date = new Date(),
): Promise<CreditResult> {
  const reason = input.reason.trim();
  if (reason === "") {
    return { ok: false, error: "motivo obrigatorio", field: "reason" };
  }

  const generatedAt = input.generatedAt ?? now;
  const expiresAt = creditExpiresAt(generatedAt);

  return db.transaction(async (tx): Promise<CreditResult> => {
    const duplicate = await findCreditByOrigin(tx, input);
    if (duplicate) {
      return {
        ok: false,
        error: "ja existe credito para a mesma origem",
        field: "source",
      };
    }

    let created: Credit | undefined;
    try {
      // Savepoint: um conflito de origem nao aborta a transacao toda
      const rows = await tx.transaction(async (sp) =>
        sp
          .insert(credits)
          .values({
            studentId: input.studentId,
            source: input.source,
            sourceBookingId: input.sourceBookingId ?? null,
            sourceSessionId: input.sourceSessionId ?? null,
            generatedAt,
            expiresAt,
            status: "DISPONIVEL",
            adminUserId: input.adminUserId ?? null,
            adminLabel: input.adminLabel,
          })
          .returning(),
      );
      created = rows[0];
    } catch (error) {
      // Corrida entre duas concessoes da mesma origem: o indice unico decide
      if (isUniqueViolation(error)) {
        return {
          ok: false,
          error: "ja existe credito para a mesma origem",
          field: "source",
        };
      }
      throw error;
    }

    if (!created) return { ok: false, error: "falha ao gravar credito" };

    const recorded = await recordCreditTransaction(tx, {
      creditId: created.id,
      action: "CONCESSAO",
      previousStatus: null,
      newStatus: "DISPONIVEL",
      reason,
      adminLabel: input.adminLabel,
      adminUserId: input.adminUserId ?? null,
      manual: false,
    }, now);
    if (!recorded.ok) return recorded;

    return { ok: true, value: { credit: created, transaction: recorded.value } };
  });
}

export type ChangeCreditInput = {
  creditId: string;
  reason: string;
  adminLabel: string;
  adminUserId?: string | null;
};

/**
 * Devolve o credito a DISPONIVEL mantendo o vencimento original, a partir de
 * RESERVADO, UTILIZADO ou CANCELADO (AD-021, CRD-35).
 */
export async function returnCredit(
  db: DbClient,
  input: ChangeCreditInput,
  now: Date = new Date(),
): Promise<CreditResult> {
  const reason = input.reason.trim();
  if (reason === "") {
    return { ok: false, error: "motivo obrigatorio", field: "reason" };
  }

  return db.transaction(async (tx): Promise<CreditResult> => {
    const [credit] = await tx
      .select()
      .from(credits)
      .where(eq(credits.id, input.creditId))
      .for("update");
    if (!credit) {
      return { ok: false, error: "credito nao encontrado", field: "creditId" };
    }
    if (!RETURNABLE_STATUSES.includes(credit.status)) {
      return {
        ok: false,
        error: "credito nao pode ser devolvido no status atual",
        field: "status",
      };
    }

    const recorded = await recordCreditTransaction(tx, {
      creditId: credit.id,
      action: "DEVOLUCAO",
      previousStatus: credit.status,
      newStatus: "DISPONIVEL",
      reason,
      adminLabel: input.adminLabel,
      adminUserId: input.adminUserId ?? null,
      // O credito volta a ficar livre: o vinculo com a reserva sai
      usedBookingId: null,
      manual: true,
    }, now);
    if (!recorded.ok) return recorded;

    const [stored] = await tx
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    return { ok: true, value: { credit: stored, transaction: recorded.value } };
  });
}

/**
 * Cancela o credito definitivamente e registra a transacao (CRD-36).
 */
export async function cancelCredit(
  db: DbClient,
  input: ChangeCreditInput,
  now: Date = new Date(),
): Promise<CreditResult> {
  const reason = input.reason.trim();
  if (reason === "") {
    return { ok: false, error: "motivo obrigatorio", field: "reason" };
  }

  return db.transaction(async (tx): Promise<CreditResult> => {
    const [credit] = await tx
      .select()
      .from(credits)
      .where(eq(credits.id, input.creditId))
      .for("update");
    if (!credit) {
      return { ok: false, error: "credito nao encontrado", field: "creditId" };
    }

    const recorded = await recordCreditTransaction(tx, {
      creditId: credit.id,
      action: "CANCELAMENTO",
      previousStatus: credit.status,
      newStatus: "CANCELADO",
      reason,
      adminLabel: input.adminLabel,
      adminUserId: input.adminUserId ?? null,
      manual: true,
    }, now);
    if (!recorded.ok) return recorded;

    const [stored] = await tx
      .select()
      .from(credits)
      .where(eq(credits.id, credit.id));
    return { ok: true, value: { credit: stored, transaction: recorded.value } };
  });
}

export type CreditLockInput = {
  creditId: string;
  studentId: string;
};

export type CreditLockResult =
  | { ok: true; value: Credit }
  | { ok: false; error: string; field?: string };

/**
 * Verifica e trava a linha do credito para uso: so um credito DISPONIVEL do
 * proprio aluno e utilizavel, e credito vencido nao vale (CRD-13, CRD-18).
 * A trava serializa duas reservas concorrentes com o mesmo credito (CRD-22).
 */
export async function lockCreditForUse(
  db: DbClient,
  input: CreditLockInput,
  now: Date = new Date(),
): Promise<CreditLockResult> {
  const [credit] = await db
    .select()
    .from(credits)
    .where(eq(credits.id, input.creditId))
    .for("update");
  if (!credit) {
    return { ok: false, error: "credito nao encontrado", field: "creditId" };
  }
  if (credit.studentId !== input.studentId) {
    return {
      ok: false,
      error: "credito pertence a outro aluno",
      field: "creditId",
    };
  }
  if (credit.status !== "DISPONIVEL") {
    return {
      ok: false,
      error: "credito indisponivel para uso",
      field: "creditId",
    };
  }
  if (now.getTime() > credit.expiresAt.getTime()) {
    return { ok: false, error: "credito vencido", field: "creditId" };
  }
  return { ok: true, value: credit };
}

export type ReserveCreditInput = CreditLockInput & {
  /** Reserva que consome o credito (CRD-17). */
  usedBookingId?: string | null;
  reason?: string;
  adminLabel?: string;
  adminUserId?: string | null;
};

/**
 * Reserva o credito: marca RESERVADO e vincula a reserva que o consome
 * (CRD-17). Credito vencido, indisponivel ou de outro aluno e recusado
 * (CRD-13, CRD-18).
 */
export async function reserveCredit(
  db: DbClient,
  input: ReserveCreditInput,
  now: Date = new Date(),
): Promise<CreditResult> {
  const reason = (input.reason ?? "Reserva de reposicao").trim();
  const adminLabel = input.adminLabel ?? "aluno";

  return db.transaction(async (tx): Promise<CreditResult> => {
    const locked = await lockCreditForUse(tx, input, now);
    if (!locked.ok) return locked;

    const recorded = await recordCreditTransaction(tx, {
      creditId: locked.value.id,
      action: "RESERVA",
      previousStatus: locked.value.status,
      newStatus: "RESERVADO",
      reason,
      adminLabel,
      adminUserId: input.adminUserId ?? null,
      usedBookingId: input.usedBookingId ?? null,
      manual: false,
    }, now);
    if (!recorded.ok) return recorded;

    const [stored] = await tx
      .select()
      .from(credits)
      .where(eq(credits.id, locked.value.id));
    return { ok: true, value: { credit: stored, transaction: recorded.value } };
  });
}

export type StudentCredit = {
  id: string;
  studentId: string;
  source: CreditSource;
  sourceBookingId: string | null;
  sourceSessionId: string | null;
  generatedAt: Date;
  expiresAt: Date;
  /** Status efetivo na leitura (AD-007). */
  status: CreditStatus;
  /** Status gravado no banco (cache). */
  persistedStatus: CreditStatus;
  usedBookingId: string | null;
  adminLabel: string | null;
  transactions: CreditTransaction[];
};

/**
 * Creditos do aluno com geracao, vencimento, status, origem e as transacoes
 * de cada um (CRD-37). Vencimento e uso sao resolvidos na leitura (AD-007).
 */
export async function listStudentCredits(
  db: DbClient,
  studentId: string,
  now: Date = new Date(),
): Promise<StudentCredit[]> {
  const rows = await db
    .select({
      credit: credits,
      sessionDate: classSessions.sessionDate,
      endTime: classSlots.endTime,
    })
    .from(credits)
    .leftJoin(bookings, eq(bookings.id, credits.usedBookingId))
    .leftJoin(classSessions, eq(classSessions.id, bookings.classSessionId))
    .leftJoin(classSlots, eq(classSlots.id, classSessions.classSlotId))
    .where(eq(credits.studentId, studentId))
    .orderBy(desc(credits.generatedAt));

  const creditIds = rows.map((row) => row.credit.id);
  const transactions = creditIds.length
    ? await db
        .select()
        .from(creditTransactions)
        .where(inArray(creditTransactions.creditId, creditIds))
        .orderBy(asc(creditTransactions.createdAt))
    : [];

  return rows.map((row) => ({
    id: row.credit.id,
    studentId: row.credit.studentId,
    source: row.credit.source,
    sourceBookingId: row.credit.sourceBookingId,
    sourceSessionId: row.credit.sourceSessionId,
    generatedAt: row.credit.generatedAt,
    expiresAt: row.credit.expiresAt,
    status: effectiveCreditStatus(
      row.credit,
      now,
      row.sessionDate && row.endTime
        ? occurrenceEnded(row.sessionDate, row.endTime, now)
        : false,
    ),
    persistedStatus: row.credit.status,
    usedBookingId: row.credit.usedBookingId,
    adminLabel: row.credit.adminLabel,
    transactions: transactions.filter((row2) => row2.creditId === row.credit.id),
  }));
}

/**
 * Creditos DISPONIVEL que vencem nos proximos 7 dias (CRD-38).
 */
export async function listCreditsExpiringSoon(
  db: DbClient,
  now: Date = new Date(),
  days: number = EXPIRING_SOON_DAYS,
): Promise<Credit[]> {
  const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(credits)
    .where(
      and(
        eq(credits.status, "DISPONIVEL"),
        gt(credits.expiresAt, now),
        lte(credits.expiresAt, limit),
      ),
    )
    .orderBy(asc(credits.expiresAt));
}

/** Credito do mesmo aluno com a mesma origem (CRD-14). */
async function findCreditByOrigin(
  db: DbClient,
  input: {
    studentId: string;
    source: CreditSource;
    sourceBookingId?: string | null;
    sourceSessionId?: string | null;
  },
): Promise<Credit | undefined> {
  if (input.sourceBookingId) {
    const [row] = await db
      .select()
      .from(credits)
      .where(
        and(
          eq(credits.studentId, input.studentId),
          eq(credits.source, input.source),
          eq(credits.sourceBookingId, input.sourceBookingId),
        ),
      )
      .limit(1);
    if (row) return row;
  }

  if (input.sourceSessionId) {
    const [row] = await db
      .select()
      .from(credits)
      .where(
        and(
          eq(credits.studentId, input.studentId),
          eq(credits.source, input.source),
          eq(credits.sourceSessionId, input.sourceSessionId),
        ),
      )
      .limit(1);
    if (row) return row;
  }

  return undefined;
}

/** A ocorrencia ja terminou? O fim da aula vira UTILIZADO (AD-018). */
function occurrenceEnded(
  sessionDate: string,
  endTime: string,
  now: Date,
): boolean {
  const today = todayInStudio(now);
  if (sessionDate < today) return true;
  if (sessionDate > today) return false;
  return STUDIO_TIME_FORMAT.format(now) > endTime;
}

/** O Drizzle embrulha o erro do Postgres: a mensagem original vem no cause. */
function isUniqueViolation(error: unknown): boolean {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages
    .join(" | ")
    .includes("duplicate key value violates unique constraint");
}
