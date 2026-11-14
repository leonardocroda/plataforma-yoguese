"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../../modules/auth/actions";
import { Button, Field } from "../../modules/ui/components/kit";

// Formulario de login (AUTH-02, AUTH-04): email e senha no estilo de campo
// do guia, um unico botao preto "Entrar" e a mensagem generica de credencial
// invalida em texto puro no token de erro, sem apontar qual fator falhou.

const INITIAL_STATE: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Field label="E-mail" id="login-email">
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
        />
      </Field>

      <Field label="Senha" id="login-senha">
        <input
          id="login-senha"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </Field>

      {state.error ? (
        <p
          className="mt-2 text-[14.5px] font-medium text-[color:var(--erro)]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="prim" disabled={pending}>
        Entrar
      </Button>
    </form>
  );
}