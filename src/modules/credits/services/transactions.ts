// Transacoes de credito (CRD-15, CRD-16): toda mudanca de estado de um
// credito passa por aqui. A funcao aplica o novo estado no credito e grava a
// transacao com o estado anterior, o novo estado, a acao, o motivo, o
// responsavel e a data.

import { eq } from "drizzle-orm";
import { creditTransactions, credits } from "../../../db/schema";
import type { DbClient } from "../../bookings/services/sessions";
import type { CreditStatus } from "../domain/credit-status";

export type { DbClient };

export type CreditTransaction = typeof creditTransactions.$inferSelect;

export type CreditTransactionResult =
  | { ok: true; value: CreditTransaction }
  | { ok: false; error: string; field?: string };

export type CreditTransactionInput = {
  creditId: string;
  /** Acao registrada: CONCESSAO, RESERVA, DEVOLUCAO, CANCELAMENTO, ... */
  action: string;
  /**
   * Estado anterior do credito. Null quando o credito acabou de ser criado:
   * nao havia estado anterior.
   */
  previousStatus: CreditStatus | null;
  newStatus: CreditStatus;
  reason: string;
  /** Responsavel pela alteracao (rotulo enquanto nao ha auth, AD-016). */
  adminLabel: string;
  adminUserId?: string | null;
  /**
   * Reserva que consome o credito. Null solta o vinculo com a reserva
   * anterior; undefined nao mexe no vinculo.
   */
  usedBookingId?: string | null;
  /**
   * Alteracao manual: exige motivo (CRD-16). As mudancas automaticas do
   * sistema marcam manual: false e trazem o proprio motivo.
   */
  manual?: boolean;
};

/**
 * Grava a transacao de mudanca de estado de um credito (CRD-15). Alteracao
 * manual sem motivo e recusada sem gravar nada (CRD-16).
 */
export async function recordCreditTransaction(
  db: DbClient,
  input: CreditTransactionInput,
  now: Date = new Date(),
): Promise<CreditTransactionResult> {
  const reason = input.reason.trim();
  if (input.manual !== false && reason === "") {
    return {
      ok: false,
      error: "motivo obrigatorio para alteracao manual",
      field: "reason",
    };
  }

  return db.transaction(async (tx): Promise<CreditTransactionResult> => {
    // Trava a linha do credito: duas alteracoes simultaneas nao se cruzam
    const [credit] = await tx
      .select({ id: credits.id })
      .from(credits)
      .where(eq(credits.id, input.creditId))
      .for("update");
    if (!credit) {
      return { ok: false, error: "credito nao encontrado", field: "creditId" };
    }

    // Estado anterior null = criacao: o credito ja nasce no novo estado
    if (input.previousStatus !== null) {
      const patch: { status: CreditStatus; usedBookingId?: string | null } = {
        status: input.newStatus,
      };
      if (input.usedBookingId !== undefined) {
        patch.usedBookingId = input.usedBookingId;
      }
      await tx.update(credits).set(patch).where(eq(credits.id, input.creditId));
    }

    const [recorded] = await tx
      .insert(creditTransactions)
      .values({
        creditId: input.creditId,
        action: input.action,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        reason,
        adminLabel: input.adminLabel,
        adminUserId: input.adminUserId ?? null,
        createdAt: now,
      })
      .returning();

    return recorded
      ? { ok: true, value: recorded }
      : { ok: false, error: "falha ao gravar transacao" };
  });
}
