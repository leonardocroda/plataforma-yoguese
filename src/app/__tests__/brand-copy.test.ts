import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Contrato da voz: guia (secao "Voz e vocabulario") + criterios BRAND-04,
// BRAND-08, BRAND-35, BRAND-36, BRAND-37 e BRAND-38. Os testes leem a copia
// entregue nas telas tocadas por esta feature e varrem `src/` atras do
// vocabulario proibido e de restos da paleta antiga.

/** Telas tocadas pelo redesign, na ordem em que foram reescritas. */
const TOUCHED = [
  "src/app/(site)/page.tsx",
  "src/app/(site)/experimental/page.tsx",
  "src/app/(site)/experimental/experimental-form.tsx",
  "src/app/login/page.tsx",
  "src/app/login/login-form.tsx",
  "src/app/(admin)/layout.tsx",
  "src/app/(admin)/grade/page.tsx",
  "src/app/(admin)/grade/booking-forms.tsx",
  "src/app/(admin)/alunos/page.tsx",
  "src/app/(admin)/alunos/[id]/page.tsx",
  "src/app/(admin)/alunos/student-forms.tsx",
  "src/app/(admin)/planos/page.tsx",
  "src/app/(admin)/planos/plan-forms.tsx",
  "src/app/(admin)/creditos/page.tsx",
  "src/app/(admin)/creditos/credit-forms.tsx",
  "src/app/(admin)/feriados/page.tsx",
  "src/app/(admin)/feriados/feriados-forms.tsx",
  "src/app/(admin)/experimentais/page.tsx",
  "src/app/(admin)/experimentais/[id]/page.tsx",
  "src/app/(admin)/experimentais/[id]/experimental-forms.tsx",
];

/**
 * Copia visivel de um arquivo: textos de JSX e strings literais, sem
 * comentarios, imports e classes. Assim o teste olha o que a pessoa le, e
 * nao nomes de props como `classSlotId`.
 */
function copyOf(source: string): string {
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/^\s*import[\s\S]*?from\s*["'][^"']+["'];?/gm, " ")
    .replace(
      /className\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\}|\{[^{}]*\})/g,
      " ",
    );

  const parts: string[] = [];
  for (const match of text.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)) {
    parts.push(match[1] ?? match[2] ?? "");
  }
  for (const match of text.matchAll(/>([^<>{}"=;()]+)</g)) {
    parts.push(match[1]);
  }
  return parts.join("\n");
}

const files = TOUCHED.map((path) => ({
  path,
  copy: copyOf(readFileSync(path, "utf8")),
}));
const copy = files.map((file) => file.copy).join("\n");

/** Copia limitada a erros e prazos, onde o guia nao admite graca. */
const ERROR_OR_DEADLINE =
  /erro|inválid|obrigat|não (foi|é) possível|escolha|prazo|vence|faltam|24 horas|telefone incompleto|limite/i;

/** Marcas de humor, desculpa ou emoji que nunca entram em erro/prazo. */
const HUMOR_IN_ERROR =
  /!|respire fundo|\bpato\b|quack|haha|rsrs|piada|desculp|perdão|\bops\b|\bopa\b/i;

function find(term: RegExp): string[] {
  return files
    .filter((file) => term.test(file.copy))
    .map((file) => file.path);
}

function walk(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("voice", () => {
  it("uses the fixed vocabulary of the guide", () => {
    // O vocabulario fixo aparece nas telas, sempre no genero certo.
    for (const term of [
      /turma/i,
      /vaga/i,
      /aula fixa/i,
      /reposição/i,
      /crédito de reposição/i,
      /aula experimental/i,
      /Avisar que não vou/,
    ]) {
      expect(find(term), `vocabulário ausente: ${term}`).not.toHaveLength(0);
    }
  });

  it("bans the forbidden vocabulary", () => {
    // Termos do PRD que a marca nao usa, nem em botao nem em texto.
    for (const term of [
      /(^|[^\p{L}\p{N}_])slot([^\p{L}\p{N}_]|$)/iu,
      /(^|[^\p{L}\p{N}_])booking([^\p{L}\p{N}_]|$)/iu,
      /sess(ã|a)o/i,
      /agendamento recorrente/i,
      /(^|[^\p{L}\p{N}_])Submit([^\p{L}\p{N}_]|$)/u,
      /(^|[^\p{L}\p{N}_])Enviar([^\p{L}\p{N}_]|$)/u,
      /(^|[^\p{L}\p{N}_])OK([^\p{L}\p{N}_]|$)/u,
      /Ocorreu um erro inesperado/i,
    ]) {
      expect(find(term), `vocabulário proibido: ${term}`).toHaveLength(0);
    }
  });

  it("bans the vacancy shortcuts", () => {
    // Vaga e sempre "N vagas livres de 8", nunca "N/8" nem barra de progresso.
    for (const term of [
      /\b\d+\s*\/\s*8\b/,
      /role="progressbar"/,
      /<progress/i,
    ]) {
      expect(find(term), `atalho de vaga: ${term}`).toHaveLength(0);
    }
  });

  it("keeps humor out of error and deadline copy", () => {
    // Erros e prazos dizem o que fazer, sem piada, desculpa ou exclamação.
    const offenses: string[] = [];
    for (const file of files) {
      for (const line of file.copy.split("\n")) {
        const text = line.trim();
        if (text && ERROR_OR_DEADLINE.test(text) && HUMOR_IN_ERROR.test(text)) {
          offenses.push(`${file.path}: ${text}`);
        }
      }
    }
    expect(offenses).toEqual([]);
  });

  it("writes Brazilian Portuguese without emojis", () => {
    // A copia tem acento e concordancia do portugues, e nenhum emoji.
    expect(copy).toMatch(/não/i);
    expect(copy).toMatch(/[áàâãéêíóôõúç]/i);
    expect(
      copy.match(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu) ?? [],
    ).toEqual([]);
  });
});

describe("sweep", () => {
  it("keeps zero PRD palette variables or hex literals in src", () => {
    // C4: a paleta antiga e as cores soltas nao sobrevivem em lugar nenhum.
    const paths = walk("src");
    expect(paths.length).toBeGreaterThan(100);

    const palette = /-{2}yoguese-/;
    const hexUtility =
      /\b(?:bg|text|border|fill|stroke|from|via|to|ring|divide|outline|decoration|accent|caret|shadow)-\[#[0-9a-fA-F]{3,8}\]/;

    const offenses = paths
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return palette.test(source) || hexUtility.test(source);
      })
      .map((path) => relative(".", path));

    expect(offenses).toEqual([]);
  });
});
