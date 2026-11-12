"use server";

import { redirect } from "next/navigation";
import type { DbClient } from "../bookings/services/sessions";
import { verifyCredentials } from "./services/credentials";
import {
  clearSessionCookie,
  setSessionCookie,
} from "./services/session";

/**
 * Server actions de login e logout (AUTH-02 a AUTH-04, AUTH-06, AUTH-07).
 * Finas: a validacao de credencial fica no servico (falha generica, sem
 * dizer qual campo errou); o que sobra aqui e formato, cookie e redirect.
 */

/**
 * O client so e necessario em tempo de execucao. O import dinamico mantem o
 * build (`next build`) funcionando sem DATABASE_URL configurada.
 */
async function dbClient(): Promise<DbClient> {
  const { db } = await import("../../db");
  return db;
}

export type LoginState = { error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensagem unica de credencial invalida (AUTH-03). */
const INVALID_CREDENTIALS = "E-mail ou senha inválidos";

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // AUTH-04: vazio ou formato invalido e recusado no servidor, sem sessao
  if (!email.trim() || !password) {
    return { error: "Informe e-mail e senha" };
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return { error: "Informe um e-mail válido" };
  }

  const result = await verifyCredentials(await dbClient(), {
    email,
    password,
  });
  if (!result.ok) {
    return { error: INVALID_CREDENTIALS };
  }

  await setSessionCookie({ id: result.user.id, role: result.user.role });
  redirect("/grade");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
