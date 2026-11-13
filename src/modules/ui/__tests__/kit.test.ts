import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { Button, Chip, Field, Toast } from "../components/kit";

// Contrato: guia (secao "Componentes") + criterio BRAND-05 do spec. O teste
// afirma a forma que o guia define (pilula, borda preta 2px, 48px, anel de
// foco) - nunca copia o que a implementacao ja faz.
const css = readFileSync("src/app/globals.css", "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : "";
}

function renderButton(props: Record<string, unknown>, label: string) {
  return renderToStaticMarkup(
    createElement(Button, props, label),
  );
}

describe("Button", () => {
  it("renders the pill with the guide focus ring and the 48px minimum height", () => {
    const html = renderButton(
      { variant: "prim", children: undefined },
      "Agendar aula experimental",
    );
    expect(html).toContain("btn btn-prim");
    // Pilula com borda preta de 2px, altura minima 48px
    expect(rule(".btn")).toMatch(/border-radius:\s*var\(--r-pill\)/);
    expect(rule(".btn")).toMatch(/border:\s*2px solid var\(--preto\)/);
    expect(rule(".btn")).toMatch(/min-height:\s*48px/);
    // Anel de foco do guia
    expect(css).toMatch(/box-shadow:\s*var\(--foco\)/);
  });

  it("renders the secondary and peach variants plus the small and disabled states", () => {
    expect(renderButton({ variant: "sec" }, "Ver horários")).toContain(
      "btn btn-sec",
    );
    expect(renderButton({ variant: "pes" }, "Repor")).toContain("btn btn-pes");
    expect(rule(".btn-sec")).toMatch(/color:\s*var\(--preto\)/);
    expect(rule(".btn-pes")).toMatch(/background:\s*var\(--pessego\)/);
    const small = renderButton({ variant: "prim", small: true }, "Entrar");
    expect(small).toContain("peq");
    expect(rule(".btn.peq")).toMatch(/min-height:\s*38px/);
    const disabled = renderButton(
      { variant: "prim", disabled: true },
      "Pedir aula experimental",
    );
    expect(disabled).toContain("disabled");
    expect(rule(".btn[disabled]")).toMatch(/opacity:\s*0?\.35/);
  });
});

describe("Field", () => {
  it("shows the help text and turns to the error token on error", () => {
    const ok = renderToStaticMarkup(
      createElement(
        Field,
        { label: "Seu nome", id: "nome", help: "Como a professora vai te chamar." },
        createElement("input", { id: "nome", type: "text" }),
      ),
    );
    expect(ok).toContain("campo");
    expect(ok).toContain("Como a professora vai te chamar.");
    expect(ok).not.toContain("erro");
    const erro = renderToStaticMarkup(
      createElement(
        Field,
        {
          label: "Telefone",
          id: "tel",
          error: "Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678.",
        },
        createElement("input", { id: "tel", type: "tel" }),
      ),
    );
    expect(erro).toContain("campo erro");
    expect(erro).toContain(
      "Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678.",
    );
    // Campo e texto de ajuda nas cores do guia
    expect(rule(".campo.erro input")).toMatch(/border-color:\s*var\(--erro\)/);
    expect(rule(".campo.erro .ajuda")).toMatch(/color:\s*var\(--erro\)/);
  });
});

describe("Chip", () => {
  it("renders the four guide variants with the 1.5px black border", () => {
    const chip = renderToStaticMarkup(
      createElement(Chip, { variant: "pes" }, "Aguardando aprovação"),
    );
    expect(chip).toContain("chip pes");
    const claro = renderToStaticMarkup(
      createElement(Chip, { variant: "cl" }, "Aprovada"),
    );
    expect(claro).toContain("chip cl");
    const erro = renderToStaticMarkup(
      createElement(Chip, { variant: "erro" }, "Vence em 3 dias"),
    );
    expect(erro).toContain("chip erro");
    const base = renderToStaticMarkup(
      createElement(Chip, null, "Vence em 18 dez"),
    );
    expect(base).toContain("chip");
    expect(rule(".chip")).toMatch(/border:\s*1\.5px solid var\(--preto\)/);
    expect(rule(".chip")).toMatch(/border-radius:\s*var\(--r-pill\)/);
    expect(rule(".chip.erro")).toMatch(/color:\s*var\(--erro\)/);
  });
});

describe("Toast", () => {
  it("renders the black status pill", () => {
    const html = renderToStaticMarkup(
      createElement(Toast, null, "Reposição marcada para quinta, 19h."),
    );
    expect(html).toContain("toast");
    expect(html).toContain("role=\"status\"");
    expect(rule(".toast")).toMatch(/background:\s*var\(--preto\)/);
    expect(rule(".toast")).toMatch(/color:\s*var\(--papel\)/);
    expect(rule(".toast")).toMatch(/border-radius:\s*var\(--r-pill\)/);
  });
});
