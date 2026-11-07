"use server";

import type { BookingType } from "../bookings/services/bookings";
import { createBooking as createBookingService } from "../bookings/services/bookings";
import type { DbClient } from "../bookings/services/sessions";
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

/**
 * Server actions do admin (RES-03 Propagate, RES-14). Finas: chamam os
 * servicos e devolvem o resultado do servico (ok/value ou error/field) para
 * o caller, sem auth nesta slice (spec: "UI administrativa minima sem auth").
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
  return createClassTypeService(await dbClient(), input);
}

export async function updateClassTypeAction(
  id: string,
  patch: { name?: string; status?: "ATIVA" | "INATIVA" },
) {
  return updateClassTypeService(await dbClient(), id, patch);
}

export async function deactivateClassTypeAction(id: string) {
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
  return createSlotService(await dbClient(), input);
}

export async function updateSlotAction(
  id: string,
  patch: Partial<SlotData> & { status?: "ATIVA" | "INATIVA" },
) {
  return updateSlotService(await dbClient(), id, patch);
}

export async function deactivateSlotAction(id: string) {
  return deactivateSlotService(await dbClient(), id);
}

// ---- reservas (RES-14) ----

export async function createBookingAction(input: {
  studentId: string;
  classSlotId: string;
  date: string;
  type: BookingType;
}) {
  return createBookingService(await dbClient(), input);
}

// ---- horarios fixos (RES-20 a RES-24) ----

export async function createEnrollmentAction(input: {
  studentId: string;
  classSlotId: string;
  startDate: string;
}) {
  return createEnrollmentService(await dbClient(), input);
}

export async function endEnrollmentAction(
  enrollmentId: string,
  input: { date?: string } = {},
) {
  return endEnrollmentService(await dbClient(), enrollmentId, input);
}
