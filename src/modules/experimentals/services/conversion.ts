// Conversao da experimental em aluna ativa (PRD 8.6, EXP-50 a EXP-61).
// A conversao cria a aluna com plano e horarios fixos, copia a declaracao de
// saude e marca a experimental como convertida - tudo numa transacao: a
// aluna, as matriculas fixas e o status da experimental gravam juntos ou nada
// e gravado.

import { and, eq } from "drizzle-orm";
import {
  classSessions,
  classSlots,
  classTypes,
  experimentals,
  fixedEnrollments,
  plans,
  students,
} from "../../../db/schema";
import { normalizeEmail } from "../../auth/services/credentials";
import { getOccurrenceComposition } from "../../bookings/services/composition";
import {
  materializeSession,
  type DbClient,
} from "../../bookings/services/sessions";
import {
  nextOccurrence,
  studioDateTimeToInstant,
  todayInStudio,
} from "../../classes/domain/occurrences";
import {
  activePlanExists,
  emailTaken,
  isUniqueViolation,
  planExists,
} from "../../students/services/students";
import { canConvert, occurrenceHasEnded } from "../domain/rules";
import { validateConversion } from "../domain/validators";

export type Student = typeof students.$inferSelect;
export type Experimental = typeof experimentals.$inferSelect;

/** A conversao pedida pelo admin (EXP-51): o nome e o telefone vem da solicitation. */
export type ConversionInput = {
  experimentalId: string;
  email: string;
  birthDate: string;
  planId: string;
  /** Horarios fixos escolhidos na conversao (EXP-51). */
  classSlotIds: string[];
};

export type ConversionResult =
  | { ok: true; value: { student: Student; experimental: Experimental } }
  | { ok: false; error: string; field?: string };

/** O horario fixo escolhido, com a turma e a modalidade (para a mensagem). */
type ChosenSlot = {
  id: string;
  weekday: number;
  startTime: string;
  capacity: number;
  classTypeName: string;
};

/**
 * Converte a experimental em aluna ativa (EXP-50 a EXP-61).
 *
 * A solicitacao precisa estar APROVADA e a aula ja ter terminado: a
 * conversao registra uma presenca (EXP-56). O e-mail precisa ser valido e
 * livre (EXP-52), o plano precisa existir e estar ativo (EXP-53) e cada
 * horario fixo escolhido precisa ter vaga na proxima ocorrencia da turma
 * (EXP-54).
 *
 * Tudo numa transacao: a aluna, as matriculas fixas e a experimental
 * convertida gravam juntas ou nada e gravado (EXP-55). A aluna criada nao
 * recebe acesso: nao ha login nesta versao (EXP-61).
 */
export async function convertExperimental(
  db: DbClient,
  input: ConversionInput,
  now: Date = new Date(),
): Promise<ConversionResult> {
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
  // So a APROVADA vira aluna: uma segunda conversao encontra a CONVERTIDA e
  // e recusada (EXP-59)
  if (!canConvert(experimental.status)) {
    return {
      ok: false,
      error: "somente experimental aprovada pode ser convertida",
      field: "status",
    };
  }

  const occurrence = await loadOccurrence(db, experimental.classSessionId);
  if (!occurrence) {
    return { ok: false, error: "ocorrencia nao encontrada" };
  }

  // A aula precisa ter terminado: a conversao registra a presenca (EXP-56)
  const endsAt = studioDateTimeToInstant(
    occurrence.session.sessionDate,
    occurrence.slot.endTime,
  );
  if (!occurrenceHasEnded(endsAt, now)) {
    return {
      ok: false,
      error: "a experimental ainda nao foi realizada",
      field: "status",
    };
  }

  // O mesmo validador de aluna do modulo de alunas, mais a exigencia de ao
  // menos um horario fixo (EXP-51)
  const validation = validateConversion({
    name: experimental.name,
    phone: experimental.phone,
    email: input.email,
    birthDate: input.birthDate,
    planId: input.planId,
    classSlotIds: input.classSlotIds,
  });
  if (!validation.ok) {
    const first = validation.errors[0];
    return {
      ok: false,
      error: `${first.field}: ${first.message}`,
      field: first.field,
    };
  }

  // O e-mail identifica a aluna: o mesmo e-mail em outra caixa e a mesma
  // pessoa e nao pode virar cadastro (EXP-52)
  const email = normalizeEmail(input.email);
  if (await emailTaken(db, email)) {
    return { ok: false, error: "e-mail ja cadastrado", field: "email" };
  }

  // O plano precisa existir e estar ativo (EXP-53)
  if (!(await planExists(db, input.planId))) {
    return {
      ok: false,
      error: "planId: plano nao encontrado",
      field: "planId",
    };
  }
  if (!(await activePlanExists(db, input.planId))) {
    return { ok: false, error: "planId: plano inativo", field: "planId" };
  }

  const slots = await loadChosenSlots(db, input.classSlotIds);
  if (!slots.ok) {
    return { ok: false, error: slots.error, field: "classSlotIds" };
  }

  // PLIM-04: a frequencia do plano escolhido limita os horarios fixos da
  // conversao (AD-037) - mais slots que a frequencia recusa antes de criar
  // aluna ou vinculos
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId));
  if (plan && slots.value.length > plan.weeklyFrequency) {
    const plural = plan.weeklyFrequency === 1 ? "horario fixo" : "horarios fixos";
    return {
      ok: false,
      error: `classSlotIds: o plano ${plan.name} ${plan.weeklyFrequency}x/semana permite no maximo ${plan.weeklyFrequency} ${plural} e foram escolhidos ${slots.value.length}`,
      field: "classSlotIds",
    };
  }

  // A ocorrencia de cada horario fixo: a proxima da turma (EXP-54)
  const today = todayInStudio(now);
  const occurrences: { slot: ChosenSlot; session: typeof classSessions.$inferSelect }[] =
    [];
  for (const slot of slots.value) {
    const date = nextOccurrence({ weekday: slot.weekday }, today);
    const materialized = await materializeSession(
      db,
      { classSlotId: slot.id, date },
      now,
    );
    if (!materialized.ok) {
      return { ok: false, error: materialized.error, field: "classSlotIds" };
    }
    occurrences.push({ slot, session: materialized.value });
  }

  return db.transaction(async (tx): Promise<ConversionResult> => {
    // Trava a experimental: duas conversoes simultaneas nao criam duas
    // alunas (EXP-59)
    const [locked] = await tx
      .select()
      .from(experimentals)
      .where(eq(experimentals.id, experimental.id))
      .for("update");
    if (!locked || !canConvert(locked.status)) {
      return {
        ok: false,
        error: "somente experimental aprovada pode ser convertida",
        field: "status",
      };
    }

    // O e-mail pode ter sido usado enquanto a conversao aguardava a transacao
    if (await emailTaken(tx, email)) {
      return { ok: false, error: "e-mail ja cadastrado", field: "email" };
    }

    // A vaga de cada horario fixo: a ocupacao vem da composicao, a fonte
    // unica do modulo (RES-27). Sem vaga em um deles, a conversao inteira e
    // recusada e nada e gravado (EXP-54, EXP-55)
    for (const { slot, session } of occurrences) {
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
        return {
          ok: false,
          error: `classSlotIds: sem vaga no horario ${slot.classTypeName} ${slot.startTime.slice(0, 5)}`,
          field: "classSlotIds",
        };
      }
    }

    // A aluna ativa: nome e telefone vem da solicitation, a declaracao de
    // saude e copiada e a matricula e de hoje (EXP-50)
    let student: Student | undefined;
    try {
      const [created] = await tx
        .insert(students)
        .values({
          name: experimental.name.trim(),
          phone: experimental.phone.trim(),
          email,
          birthDate: input.birthDate,
          enrollmentDate: today,
          planId: input.planId,
          status: "ATIVO",
          healthDeclaration: experimental.healthDeclaration,
          healthDeclarationAcceptedAt: experimental.requestedAt,
          // Sem user_id: a aluna convertida nao recebe acesso nesta versao
          // (EXP-61)
        })
        .returning();
      student = created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return { ok: false, error: "e-mail ja cadastrado", field: "email" };
    }
    if (!student) {
      return { ok: false, error: "falha ao gravar a aluna" };
    }

    // As matriculas fixas: um vinculo por horario escolhido, a partir de
    // hoje (EXP-50)
    for (const slot of slots.value) {
      await tx.insert(fixedEnrollments).values({
        studentId: student.id,
        classSlotId: slot.id,
        startDate: today,
        status: "ATIVA",
      });
    }

    // A experimental vira CONVERTIDA, com o vinculo da aluna e a presenca
    // registrada; o historico anterior permanece (EXP-57, EXP-60)
    const [converted] = await tx
      .update(experimentals)
      .set({
        status: "CONVERTIDA",
        convertedStudentId: student.id,
        attendedAt: experimental.attendedAt ?? endsAt,
        updatedAt: now,
      })
      .where(eq(experimentals.id, experimental.id))
      .returning();

    return {
      ok: true,
      value: { student, experimental: converted ?? experimental },
    };
  });
}

/** A ocorrencia da experimental, com a turma da aula. */
async function loadOccurrence(db: DbClient, classSessionId: string) {
  const [row] = await db
    .select({ session: classSessions, slot: classSlots })
    .from(classSessions)
    .innerJoin(classSlots, eq(classSlots.id, classSessions.classSlotId))
    .where(eq(classSessions.id, classSessionId));
  return row;
}

/**
 * Os horarios fixos escolhidos: precisam existir e estar ativos, com a
 * modalidade para a mensagem de falta de vaga (EXP-51, EXP-54).
 */
async function loadChosenSlots(
  db: DbClient,
  classSlotIds: string[],
): Promise<
  | { ok: true; value: ChosenSlot[] }
  | { ok: false; error: string }
> {
  const unique = [...new Set(classSlotIds)];
  const rows = await db
    .select({ slot: classSlots, classTypeName: classTypes.name })
    .from(classSlots)
    .innerJoin(classTypes, eq(classTypes.id, classSlots.classTypeId))
    .where(and(eq(classSlots.status, "ATIVA"), eq(classTypes.status, "ATIVA")));

  const chosen: ChosenSlot[] = [];
  for (const id of unique) {
    const row = rows.find((item) => item.slot.id === id);
    if (!row) {
      return { ok: false, error: "classSlotIds: turma nao encontrada ou inativa" };
    }
    chosen.push({
      id: row.slot.id,
      weekday: row.slot.weekday,
      startTime: row.slot.startTime,
      capacity: row.slot.capacity,
      classTypeName: row.classTypeName,
    });
  }
  return { ok: true, value: chosen };
}
