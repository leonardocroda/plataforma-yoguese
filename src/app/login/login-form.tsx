"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../../modules/auth/actions";

const INITIAL_STATE: LoginState = {};

const inputClass =
  "mt-1 w-full rounded border border-[var(--yoguese-bege)] bg-white px-2 py-1 text-sm text-[var(--yoguese-cinza)]";
const buttonClass =
  "mt-3 w-full rounded bg-[var(--yoguese-salvia)] px-3 py-1 text-sm text-white disabled:opacity-60";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="mt-4">
      <label className="block text-xs">
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          className={inputClass}
        />
      </label>
      <label className="mt-2 block text-xs">
        Senha
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      {state.error ? (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass}>
        Entrar
      </button>
    </form>
  );
}
