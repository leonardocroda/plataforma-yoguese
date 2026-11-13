import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrato: guia (secoes "Tipografia" e "Identidade") + criterios BRAND-02 e
// BRAND-40. Outfit e a unica familia, servida por next/font no subconjunto
// latino, com a pilha de fallback do guia.
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("brand font", () => {
  it("serves Outfit as the latin subset with the guide fallback", () => {
    // Uma importacao de next/font, da familia Outfit, subconjunto latino
    const imports = [
      ...layout.matchAll(/import\s+\{[^}]*\}\s+from\s+"next\/font\/google"/g),
    ];
    expect(imports).toHaveLength(1);
    expect(layout).toMatch(/Outfit/);
    expect(layout).toMatch(/subsets:\s*\["latin"\]/);
    // Os quatro pesos do guia (400, 500, 600, 800)
    expect(layout).toMatch(/weight:\s*\["400", "500", "600", "800"\]/);
    // A variavel chega ao <html>
    expect(layout).toMatch(/<html[^>]*className=\{[^}]*\}/);
    // A pilha de fallback do guia continua no CSS
    expect(css).toContain('"Outfit", system-ui, -apple-system, "Segoe UI", sans-serif');
  });

  it("paints the body with papel and the paper texture", () => {
    // O fundo da pagina e o papel com manchinhas; a textura nao vaza para
    // campos, botoes ou chips (provado em brand-tokens.test.ts)
    expect(css).toMatch(/body\s*\{[^}]*background-color:\s*var\(--papel\)/);
    expect(css).toMatch(/body\s*\{[^}]*font-family:\s*var\(--f\)/);
    // O sprite do pontilhado (pato experimental) vive uma vez no documento
    expect(layout).toMatch(/pontilhado/);
  });
});
