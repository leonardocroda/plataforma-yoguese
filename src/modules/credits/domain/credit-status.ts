// Status efetivo do credito na leitura (CRD-13, CRD-44). Expiracao e uso
// sao calculados na leitura; o status persistido e cache (AD-007).

import { creditStatusEnum } from "../../../db/schema/credits";

export type CreditStatus = (typeof creditStatusEnum.enumValues)[number];

export type CreditForStatus = {
  status: CreditStatus;
  expiresAt: Date;
};

/**
 * Status efetivo do credito, na ordem do spec: CANCELADO > UTILIZADO
 * persistido > RESERVADO com a ocorrencia encerrada > VENCIDO (agora depois
 * do vencimento) > status persistido.
 */
export function effectiveCreditStatus(
  credit: CreditForStatus,
  now: Date,
  occurrenceEnded = false,
): CreditStatus {
  if (credit.status === "CANCELADO") return "CANCELADO";
  if (credit.status === "UTILIZADO") return "UTILIZADO";
  if (credit.status === "RESERVADO" && occurrenceEnded) return "UTILIZADO";
  if (now.getTime() > credit.expiresAt.getTime()) return "VENCIDO";
  return credit.status;
}
