import type { ReactNode } from "react";

// Kit base da marca: as quatro pecas que montam todas as telas, com as classes
// do guia (`captures/yogue-se-brand.html`, secao "Componentes") definidas em
// `globals.css` (AD-041). Se faltar uma variacao, derive destas - nao de um
// framework.

type ButtonVariant = "prim" | "sec" | "pes" | "txt";

export function Button({
  variant = "prim",
  small = false,
  disabled = false,
  type = "button",
  children,
}: {
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  const classes = ["btn", `btn-${variant}`, small ? "peq" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} type={type} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  id,
  help,
  error,
  children,
}: {
  label: string;
  id: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  const message = error ?? help;
  return (
    <div className={error ? "campo erro" : "campo"}>
      <label htmlFor={id}>{label}</label>
      {children}
      {message ? <span className="ajuda">{message}</span> : null}
    </div>
  );
}

type ChipVariant = "pes" | "cl" | "erro";

export function Chip({
  variant,
  children,
}: {
  variant?: ChipVariant;
  children: ReactNode;
}) {
  return (
    <span className={variant ? `chip ${variant}` : "chip"}>{children}</span>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <span className="toast" role="status">
      {children}
    </span>
  );
}
