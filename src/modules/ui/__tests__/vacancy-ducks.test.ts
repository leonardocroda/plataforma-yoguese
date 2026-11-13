import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { VacancyDucks } from "../components/vacancy-ducks";

// Contrato: guia (secao "Vagas sao patinhos") + criterios BRAND-07..BRAND-12.
// Cada turma tem 8 vagas (PRD); cada vaga e um patinho nos cinco estados do
// guia. Nenhum "N/8" em texto puro, nenhuma barra de progresso.
const css = readFileSync("src/app/globals.css", "utf8");

function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(VacancyDucks, props));
}

function ducks(html: string, state: string): number {
  return html.split(`pato ${state}`).length - 1;
}

describe("VacancyDucks", () => {
  it("renders eight ducks for one turma", () => {
    const html = render({ fixed: 5, makeup: 1, experimental: 1 });
    // 8 patos na fila, nem um a mais (ultima vaga livre)
    const total = [...html.matchAll(/class="pato /g)].length;
    expect(total).toBe(8);
    expect(ducks(html, "fixo")).toBe(5);
    expect(ducks(html, "rep")).toBe(1);
    expect(ducks(html, "exp")).toBe(1);
    expect(ducks(html, "livre")).toBe(1);
  });

  it("paints the five guide states", () => {
    const html = render({ fixed: 1, makeup: 1, experimental: 1, own: true });
    expect(ducks(html, "fixo")).toBe(1);
    expect(ducks(html, "rep")).toBe(1);
    expect(ducks(html, "exp")).toBe(1);
    expect(ducks(html, "eu")).toBe(1);
    expect(ducks(html, "livre")).toBe(4);
    // Preenchimentos do guia
    expect(css).toMatch(/\.pato\.fixo\s*\{[^}]*--d-fill:\s*var\(--preto\)/);
    expect(css).toMatch(/\.pato\.rep\s*\{[^}]*--d-fill:\s*var\(--pena\)/);
    expect(css).toMatch(/\.pato\.exp\s*\{[^}]*--d-over:\s*url\(#pontilhado\)/);
    expect(css).toMatch(/\.pato\.eu\s*\{[^}]*--d-fill:\s*var\(--pessego\)/);
    expect(css).toMatch(/\.pato\.livre\s*\{[^}]*--d-stroke:\s*#8c8a87/);
  });

  it("announces the free-count label without visible text", () => {
    const html = render({ fixed: 5, makeup: 1, experimental: 1 });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="1 vaga livre de 8"');
    // Nenhum texto visivel duplicando a contagem
    expect(html).not.toContain("1/8");
    expect(html).not.toContain("1 vaga livre de 8</");
    const cheio = render({ fixed: 8 });
    expect(cheio).toContain('aria-label="0 vagas livres de 8"');
    const vazio = render({});
    expect(vazio).toContain('aria-label="8 vagas livres de 8"');
  });

  it("renders the xs, sm, md and lg sizes", () => {
    for (const size of ["xs", "sm", "md", "lg"]) {
      expect(render({ fixed: 3, size })).toContain(`vagas ${size}`);
    }
    expect(css).toMatch(/\.vagas\.xs \.pato\s*\{[^}]*width:\s*12px/);
    expect(css).toMatch(/\.vagas\.md \.pato\s*\{[^}]*width:\s*28px/);
    expect(css).toMatch(/\.vagas\.md \.pato\s*\{[^}]*height:\s*36px/);
    expect(css).toMatch(/\.vagas\.lg \.pato\s*\{[^}]*width:\s*40px/);
  });

  it("keeps every kind visible when the class holds more than eight", () => {
    // BRAND-41: uma turma lotada demais nao esconde o pato de ninguem.
    const html = render({ fixed: 8, makeup: 1 });
    const total = [...html.matchAll(/class="pato /g)].length;
    expect(total).toBe(8);
    expect(ducks(html, "rep")).toBe(1);
    expect(ducks(html, "livre")).toBe(0);
    expect(html).toContain('aria-label="0 vagas livres de 8"');
  });

  it("renders the 4x2 mini grid for the admin calendar", () => {
    const html = render({ fixed: 2, makeup: 1, experimental: 1, size: "sm" });
    expect(html).toContain('class="vagas sm"');
    // A versao miniatura sao bolinhas em grade 4x2 (8 no total)
    const dots = [...html.matchAll(/class="dot /g)].length;
    expect(dots).toBe(8);
    expect(ducks(html, "fixo")).toBe(0);
  });

  it("paints only the person's own duck solid peach", () => {
    const html = render({ fixed: 4, own: true });
    expect(ducks(html, "eu")).toBe(1);
    expect(ducks(html, "fixo")).toBe(4);
    expect(ducks(html, "livre")).toBe(3);
    // O pato da propria pessoa e sempre o ultimo ocupado, antes das livres
    const order = [...html.matchAll(/class="pato (fixo|rep|exp|eu|livre)"/g)].map(
      (m) => m[1],
    );
    expect(order).toEqual([
      "fixo",
      "fixo",
      "fixo",
      "fixo",
      "eu",
      "livre",
      "livre",
      "livre",
    ]);
  });
});
