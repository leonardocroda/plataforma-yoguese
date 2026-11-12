import { describe, expect, it } from "vitest";
import { isValidDate, validateStudent } from "../validators";

// STUD-02, STUD-03: os campos obrigatorios do PRD 4.4 e os 4 status sao
// recusados/aceitos no servidor com erro por campo.

function studentData(
  overrides: Partial<Parameters<typeof validateStudent>[0]> = {},
) {
  return {
    name: "Maria Silva",
    phone: "11999990000",
    email: "maria@teste.com",
    birthDate: "1990-05-10",
    status: "ATIVO" as const,
    planId: "plan-uuid",
    ...overrides,
  };
}

describe("student validators", () => {
  it("aceita cadastro completo com plano", () => {
    expect(validateStudent(studentData())).toEqual({ ok: true });
  });

  it("recusa cada campo obrigatorio ausente com erro do campo (STUD-02)", () => {
    const missingName = validateStudent(studentData({ name: "   " }));
    const missingPhone = validateStudent(studentData({ phone: "" }));
    const missingEmail = validateStudent(studentData({ email: "" }));
    const missingBirth = validateStudent(studentData({ birthDate: "" }));

    for (const [result, field] of [
      [missingName, "name"],
      [missingPhone, "phone"],
      [missingEmail, "email"],
      [missingBirth, "birthDate"],
    ] as const) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe(field);
      }
    }
  });

  it("recusa e-mail em formato invalido (STUD-02)", () => {
    for (const email of ["nao-e-email", "maria@", "@teste.com", "a b@teste.com"]) {
      const result = validateStudent(studentData({ email }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe("email");
      }
    }
  });

  it("recusa data de nascimento invalida (formato e calendario)", () => {
    for (const birthDate of ["10/05/1990", "1990-13-01", "1990-02-31"]) {
      const result = validateStudent(studentData({ birthDate }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0].field).toBe("birthDate");
      }
    }
  });

  it("recusa aluna ATIVA sem plano (STUD-02)", () => {
    const result = validateStudent(studentData({ planId: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("planId");
    }
  });

  it("aceita os 4 status do PRD e plano so e exigido no ATIVO (STUD-03)", () => {
    const statuses = [
      "EXPERIMENTAL",
      "AGUARDANDO_MATRICULA",
      "ATIVO",
      "INATIVO",
    ] as const;

    for (const status of statuses) {
      const withoutPlan = studentData({ status, planId: null });
      if (status === "ATIVO") {
        expect(validateStudent(withoutPlan).ok).toBe(false);
        expect(validateStudent(studentData({ status })).ok).toBe(true);
      } else {
        expect(validateStudent(withoutPlan).ok).toBe(true);
      }
    }
  });

  it("recusa status fora dos 4 valores do PRD", () => {
    const result = validateStudent(
      studentData({ status: "PAUSADO" as never }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("status");
    }
  });

  it("recusa data de matricula invalida quando informada", () => {
    const result = validateStudent(
      studentData({ enrollmentDate: "2026-02-30" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("enrollmentDate");
    }
  });

  it("isValidDate aceita data real e recusa data inexistente", () => {
    expect(isValidDate("2026-11-12")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2023-02-29")).toBe(false);
    expect(isValidDate("12/11/2026")).toBe(false);
  });
});
