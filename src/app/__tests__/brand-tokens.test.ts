import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrato da marca: `.specs/features/redesign-marca/captures/yogue-se-brand.html`
// (secoes "Tokens para copiar" e "Tipografia") e os criterios BRAND-01, BRAND-02,
// BRAND-03 e BRAND-06 do spec. Os testes leem o CSS entregue - nenhum valor e
// copiado da implementacao.

const css = readFileSync("src/app/globals.css", "utf8");

function token(name: string): string | null {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

function declarations(): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

describe("brand tokens", () => {
  it("exposes every guide token with the exact value", () => {
    const expected: Record<string, string> = {
      papel: "#F3F2F1",
      "papel-2": "#EAE9E7",
      pena: "#FFFBF9",
      preto: "#000",
      grafite: "#373737",
      cinza: "#6B6A68",
      linha: "#D9D7D4",
      pessego: "#FFC798",
      "pessego-claro": "#F3E2D4",
      "pessego-forte": "#F29A55",
      erro: "#B3261E",
      "erro-claro": "#F6DAD6",
      "r-pill": "999px",
      "r-lg": "28px",
      "r-md": "16px",
      "r-sm": "10px",
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(token(name)?.toLowerCase(), `--${name}`).toBe(value.toLowerCase());
    }
    // Anel de foco do guia: 3px papel + 5px preto
    expect(token("foco")).toBe("0 0 0 3px var(--papel), 0 0 0 5px var(--preto)");
    // Familia unica, com a pilha de fallback do guia
    expect(token("f")).toBe(
      '"Outfit", system-ui, -apple-system, "Segoe UI", sans-serif',
    );
    // Textura de papel definida como data-URI SVG (manchinhas)
    expect(token("manchinhas")).toContain("data:image/svg+xml");
  });

  it("serves Outfit as the only font family", () => {
    const families = [...css.matchAll(/font-family\s*:\s*([^;]+);/g)].map(
      (m) => m[1],
    );
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family).toContain("var(--f)");
    }
    // A fonte entra por next/font (T4); nenhum @import de webfont no CSS
    expect(css).not.toMatch(/@import[^;]*fonts\.(googleapis|gstatic)/);
    for (const other of ["Roboto", "Inter", "Geist", "Arial", "Helvetica"]) {
      expect(css).not.toContain(other);
    }
  });

  it("applies the paper texture only to page and panel backgrounds", () => {
    // A textura nunca aparece dentro de campo, botao, chip ou toast
    const forbidden =
      /input|button|textarea|select|\.btn|\.chip|\.toast|\.campo/i;
    for (const { selector, body } of declarations()) {
      if (body.includes("var(--manchinhas)")) {
        expect(forbidden.test(selector), selector).toBe(false);
      }
    }
    // ...e existe em algum fundo de pagina/panel
    const textured = declarations().filter((d) =>
      d.body.includes("var(--manchinhas)"),
    );
    expect(textured.length).toBeGreaterThan(0);
  });

  it("disables transitions under prefers-reduced-motion", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start).toBeGreaterThan(-1);
    // Captura o bloco inteiro, respeitando as chaves aninhadas
    const open = css.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    const block = css.slice(open, end);
    expect(block).toMatch(/transition\s*:\s*none/);
    expect(block).toMatch(/scroll-behavior\s*:\s*auto/);
  });
});
