"use server";

import type { BookingType } from "../bookings/services/bookings";
import { createBooking as createBookingService } from "../bookings/services/bookings";
import type { DbClient } from "../bookings/services/sessions";
import { requireAdminSession } from "../auth/services/session";
import {
  createEnrollment as createEnrollmentService,
  endEnrollment as endEnrollmentService,
} from "../students/services/enrollments";
import type { SlotData } from "./domain/validators";
import {
  createClassType as createClassTypeService,
  createSlot as createSlotService,
  deactivateSlot as deactivateSlotService,
  updateClassType as updateClassTypeService,
  updateSlot as updateSlotService,
} from "./services/classes";
import {
  createHoliday as createHolidayService,
  createStudioClosure as createStudioClosureService,
  deleteHoliday as deleteHolidayService,
  deleteStudioClosure as deleteStudioClosureService,
  updateHoliday as updateHolidayService,
  updateStudioClosure as updateStudioClosureService,
} from "./services/blocks";

/**
 * Server actions do admin (RES-03 Propagate, RES-14). Finas: chamam os
 * servicos e devolvem o resultado do servico (ok/value ou error/field) para
 * o caller. Toda action exige sessao de ADMIN no servidor (AUTH-01,
 * PRD 13.3): server action e endpoint POST alcancavel sem a pagina.
 */

/**
 * O client so e necessario em tempo de execucao. O import dinamico mantem o
 * build (`next build`) funcionando sem DATABASE_URL configurada.
 */
async function dbClient(): Promise<DbClient> {
  const { db } = await import("../../db");
  return db;
}

// ---- modalidades (RES-05) ----

export async function createClassTypeAction(input: { name: string }) {
  await requireAdminSession();
  return createClassTypeService(await dbClient(), input);
}

export async function updateClassTypeAction(
  id: string,
  patch: { name?: string; status?: "ATIVA" | "INATIVA" },
) {
  await requireAdminSession();
  return updateClassTypeService(await dbClient(), id, patch);
}

export async function deactivateClassTypeAction(id: string) {
  await requireAdminSession();
  return updateClassTypeService(await dbClient(), id, { status: "INATIVA" });
}

// ---- turmas (RES-01 a RES-04) ----

export async function createSlotAction(input: {
  classTypeId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity?: number;
}) {
  await requireAdminSession();
  return createSlotService(await dbClient(), input);
}

export async function updateSlotAction(
  id: string,
  patch: Partial<SlotData> & { status?: "ATIVA" | "INATIVA" },
) {
  await requireAdminSession();
  return updateSlotService(await dbClient(), id, patch);
}

export async function deactivateSlotAction(id: string) {
  await requireAdminSession();
  return deactivateSlotService(await dbClient(), id);
}

// ---- reservas (RES-14) ----

export async function createBookingAction(input: {
  studentId: string;
  classSlotId: string;
  date: string;
  type: BookingType;
  /** Credito da reposicao: obrigatorio quando o tipo e MAKEUP (CRD-18). */
  creditId?: string | null;
}) {
  await requireAdminSession();
  return createBookingService(await dbClient(), input);
}

// ---- horarios fixos (RES-20 a RES-24) ----

export async function createEnrollmentAction(input: {
  studentId: string;
  classSlotId: string;
  startDate: string;
}) {
  await requireAdminSession();
  return createEnrollmentService(await dbClient(), input);
}

export async function endEnrollmentAction(
  enrollmentId: string,
  input: { date?: string } = {},
) {
  await requireAdminSession();
  return endEnrollmentService(await dbClient(), enrollmentId, input);
}

// ---- feriados e recessos (FER-01 a FER-25) ----

export async function createHolidayAction(input: { date: string; name: string }) {
  await requireAdminSession();
  return createHolidayService(await dbClient(), input);
}

export async function updateHolidayAction(input: {
  id: string;
  date: string;
  name: string;
}) {
  await requireAdminSession();
  return updateHolidayService(await dbClient(), input);
}

export async function deleteHolidayAction(id: string) {
  await requireAdminSession();
  return deleteHolidayService(await dbClient(), { id });
}

export async function createStudioClosureAction(input: {
  startDate: string;
  endDate: string;
  reason: string;
}) {
  await requireAdminSession();
  return createStudioClosureService(await dbClient(), input);
}

export async function updateStudioClosureAction(input: {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  await requireAdminSession();
  return updateStudioClosureService(await dbClient(), input);
}

export async function deleteStudioClosureAction(id: string) {
  await requireAdminSession();
  return deleteStudioClosureService(await dbClient(), { id });
}
