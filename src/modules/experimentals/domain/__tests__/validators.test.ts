import { describe, expect, it } from "vitest";
import { validateStudent } from "../../../students/domain/validators";
import {
  EXPERIMENTAL_PRICE_CENTS,
  EXPERIMENTAL_STATUS_LABELS,
  HEALTH_DECLARATION,
  PAYMENT_STATUS_LABELS,
  validateConversion,
  validateExperimentalRequest,
  type ConversionInput,
  type ExperimentalRequestInput,
} from "../validators";

// EXP-02, EXP-03, EXP-06, EXP-07, EXP-27, EXP-32, EXP-33, EXP-51, EXP-52:
// os textos fixos do PRD, os campos obrigatorios da solicitacao e as
// exigencias da conversao em aluna.

function requestData(
  overrides: Partial<ExperimentalRequestInput> = {},
): ExperimentalRequestInput {
  return {
    name: "Maria Silva",
    phone: "(11) 98888-7777",
    classTypeId: "modalidade-uuid",
    classSlotId: "turma-uuid",
    date: "2026-12-02",
    declarationAccepted: true,
    ...overrides,
  };
}

function conversionData(
  overrides: Partial<ConversionInput> = {},
): ConversionInput {
  return {
    name: "Maria Silva",
    phone: "11988887777",
    email: "maria@teste.com",
    birthDate: "1990-05-10",
    planId: "plano-uuid",
    classSlotIds: ["turma-uuid"],
    ...overrides,
  };
}

describe("experimental validators", () => {
  it("aceita nome, telefone e declaracao marcada", () => {
    expect(validateExperimentalRequest(requestData())).toEqual({ ok: true });
  });

  it("recusa nome vazio, telefone invalido e declaracao nao aceita", () => {
    const semNome = validateExperimentalRequest(requestData({ name: "   " }));
    const telefoneInvalido = validateExperimentalRequest(
      requestData({ phone: "123" }),
    );
    const semDeclaracao = validateExperimentalRequest(
      requestData({ declarationAccepted: false }),
    );
    // EXP-07: a ocorrencia escolhida tambem e obrigatoria. O servidor
    // devolve errors[0].field como `field` da recusa, e o formulario
    // mostra o erro no lugar certo.
    const semModalidade = validateExperimentalRequest(
      requestData({ classTypeId: "  " }),
    );
    const semTurma = validateExperimentalRequest(
      requestData({ classSlotId: "" }),
    );
    const semData = validateExperimentalRequest(requestData({ date: " " }));

    for (const [result, field] of [
      [semNome, "name"],
      [telefoneInvalido, "phone"],
      [semDeclaracao, "healthDeclaration"],
      [semModalidade, "classTypeId"],
      [semTurma, "classSlotId"],
      [semData, "date"],
    ] as const) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe(field);
      }
    }
  });

  it("declaracao e preco sao os textos fixos do PRD", () => {
    expect(HEALTH_DECLARATION).toBe(
      "Declaro estar em condições de saúde aptas à prática de yoga e me comprometo a informar à professora qualquer condição ou limitação relevante para a realização das atividades.",
    );
    expect(EXPERIMENTAL_PRICE_CENTS).toBe(4500);
  });

  it("conversao exige email, nascimento, plano e ao menos um horario", () => {
    expect(validateConversion(conversionData())).toEqual({ ok: true });

    const semEmail = validateConversion(conversionData({ email: "" }));
    const semNascimento = validateConversion(conversionData({ birthDate: "" }));
    const semPlano = validateConversion(conversionData({ planId: "" }));
    const semHorario = validateConversion(conversionData({ classSlotIds: [] }));

    for (const [result, field] of [
      [semEmail, "email"],
      [semNascimento, "birthDate"],
      [semPlano, "planId"],
      [semHorario, "classSlotIds"],
    ] as const) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe(field);
      }
    }
  });

  it("termos de status e pagamento sao os do PRD", () => {
    expect(EXPERIMENTAL_STATUS_LABELS).toEqual({
      PENDENTE: "Pendente de aprovação",
      APROVADA: "Aprovada",
      RECUSADA: "Recusada",
      CANCELADA_COM_DIREITO: "Cancelada com direito a reagendamento",
      CANCELADA_SEM_DIREITO: "Cancelada sem direito a reagendamento",
      FALTA: "Falta",
      CONVERTIDA: "Convertida em aluna",
      DUPLICADA: "Tentativa duplicada",
    });

    expect(PAYMENT_STATUS_LABELS).toEqual({
      PENDENTE: "Pendente",
      PAGO: "Pago",
      ISENTO: "Isento",
      REEMBOLSADO: "Reembolsado",
    });
  });

  it("email invalido na conversao e recusado pelo validador de aluna", () => {
    const result = validateConversion(
      conversionData({ email: "nao-e-email" }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // O mesmo erro que o validador de aluna devolve: a conversao nao tem
    // regra propria de e-mail (EXP-52)
    const student = validateStudent({
      name: "Maria Silva",
      phone: "11988887777",
      email: "nao-e-email",
      birthDate: "1990-05-10",
      status: "ATIVO",
      planId: "plano-uuid",
    });
    expect(student.ok).toBe(false);
    if (student.ok) return;
    expect(result.errors[0]).toEqual(student.errors[0]);
    expect(result.errors[0].field).toBe("email");
  });
});
