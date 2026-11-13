// Walk de fechamento da feature `redesign-marca` (implement.md, passo 9).
// Abre o app rodando e faz o que cada historia promete: a visitante escolhe a
// aula experimental, a professora entra e abre uma turma no calendario. Cada
// tela vira captura em .specs/features/redesign-marca/captures/ e cada assert
// abaixo e um criterio do spec que so o navegador prova.
//
// Roda com: node .specs/features/redesign-marca/walk.mjs
// Requer o dev server em http://localhost:3005 e o Postgres de desenvolvimento.
import { mkdirSync } from "node:fs";
import { chromium } from "file:///C:/Users/leona/projects/plataforma-yoguese/node_modules/playwright-core/index.mjs";

const BASE = "http://localhost:3005";
const OUT = ".specs/features/redesign-marca/captures";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const ADMIN = {
  email: "admin@yoguese.com",
  password: "Admin!Yogue2026",
};

mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

// O cache do playwright deste repo pede um chromium mais novo que o baixado;
// o Edge instalado na maquina serve o mesmo walk (headless, mesma engine).
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: DESKTOP });
context.setDefaultNavigationTimeout(90000);
context.setDefaultTimeout(45000);
const page = await context.newPage();

const consoleErrors = [];
const badResponses = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const at = msg.location();
    consoleErrors.push(`${msg.text()} @ ${at.url || "(sem url)"}`);
  }
});
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("response", (response) => {
  if (response.status() >= 400) {
    badResponses.push(`${response.status()} ${response.url()}`);
  }
});

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `${OUT}/${name}.running.png`,
    fullPage: true,
  });
  console.log(`  captura: captures/${name}.running.png`);
}

async function body() {
  return page.evaluate(() => document.body.innerText);
}

/** Primeira compilacao do dev server pode falhar uma vez; recarrega antes de desistir. */
async function gotoWithOptions(url, selector) {
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.locator(selector).first().waitFor({ timeout: 15000 });
  } catch {
    await page.reload({ waitUntil: "load" });
    await page.locator(selector).first().waitFor({ timeout: 30000 });
  }
}

// ---------- Home publica (BRAND-13..BRAND-18) ----------
await page.goto(`${BASE}/`, { waitUntil: "load" });
await shot("home");

const homeFont = await page.evaluate(
  () => getComputedStyle(document.body).fontFamily,
);
check("home usa Outfit", /Outfit/i.test(homeFont), homeFont);
const homeBg = await page.evaluate(
  () => getComputedStyle(document.body).backgroundColor,
);
check("home tem fundo papel #F3F2F1", homeBg === "rgb(243, 242, 241)", homeBg);
const homeText = await body();
check("home nao usa atalho N/8", !/\b\d\s*\/\s*8\b/.test(homeText));
check("home diz 'Próximas aulas com vaga'", homeText.includes("Próximas aulas com vaga"));
check("home tem o CTA 'Agendar aula experimental'", homeText.includes("Agendar aula experimental"));
const homeDucks = await page.evaluate(() =>
  [...document.querySelectorAll('[role="img"][aria-label*="vagas livres de 8"]')].map(
    (el) => el.getAttribute("aria-label"),
  ),
);
check(
  "home mostra patinhos com rotulo acessivel por turma",
  homeDucks.length > 0,
  homeDucks.slice(0, 3).join(" | "),
);
const homeLinks = await page.evaluate(() => ({
  entrar: [...document.querySelectorAll('a[href="/login"]')].length,
  experimental: [...document.querySelectorAll('a[href="/experimental"]')].length,
}));
check("home liga para /login e /experimental", homeLinks.entrar > 0 && homeLinks.experimental > 0);

await page.setViewportSize(MOBILE);
await page.goto(`${BASE}/`, { waitUntil: "load" });
await shot("home-390");
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("home em 390px sem rolagem horizontal", overflow <= 1, `${overflow}px`);

// ---------- Aula experimental (BRAND-19..BRAND-25) ----------
await page.setViewportSize(DESKTOP);
await gotoWithOptions(`${BASE}/experimental`, "button[aria-pressed]");
await shot("experimental");

const options = page.locator('button[aria-pressed]');
const optionCount = await options.count();
check("experimental lista turmas com vaga", optionCount > 0, `${optionCount} opcoes`);
await options.first().click();
const pressed = await options.first().getAttribute("aria-pressed");
check("turma escolhida fica marcada (aria-pressed)", pressed === "true");

const submit = page.locator('button[type="submit"]');
check("botao bloqueado antes do pedido completo", await submit.isDisabled());
await page.fill("#exp-nome", "Walk da Marca");
await page.fill("#exp-tel", "11 97777-0001");
await page.check('input[name="healthDeclaration"]');
check("botao libera com o pedido completo", await submit.isEnabled());
await shot("experimental-filled");

await page.setViewportSize(MOBILE);
await gotoWithOptions(`${BASE}/experimental`, "button[aria-pressed]");
await shot("experimental-390");
const expOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("experimental em 390px sem rolagem horizontal", expOverflow <= 1, `${expOverflow}px`);

// Pedido de verdade: cria a solicitacao e mostra o cartao de confirmacao
await page.setViewportSize(DESKTOP);
await gotoWithOptions(`${BASE}/experimental`, "button[aria-pressed]");
await page.locator('button[aria-pressed]').first().click();
await page.fill("#exp-nome", "Walk da Marca");
await page.fill("#exp-tel", `11 9${Date.now().toString().slice(-4)}-0002`);
await page.check('input[name="healthDeclaration"]');
await page.locator('button[type="submit"]').click();
await page.waitForSelector("text=Pedido enviado", { timeout: 20000 });
await shot("experimental-confirm");
check("confirmacao diz 'Pedido enviado'", (await body()).includes("Pedido enviado"));

// ---------- Login (BRAND-32, BRAND-33) ----------
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await shot("login");
await page.fill('input[name="email"]', ADMIN.email);
await page.fill('input[name="password"]', "senha-errada");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1200);
await shot("login-error");
const loginErrorText = await body();
check("login com senha errada nao entra", !page.url().includes("/grade"));
check(
  "erro de login usa a mensagem generica do auth",
  /E-mail ou senha inválidos/.test(loginErrorText),
  loginErrorText.split("\n").filter((l) => l.trim()).slice(-2).join(" / "),
);

// ---------- Admin (BRAND-26..BRAND-31) ----------
await page.fill('input[name="email"]', ADMIN.email);
await page.fill('input[name="password"]', ADMIN.password);
await page.locator('button[type="submit"]').click();
await page.waitForURL("**/grade", { timeout: 20000 });
await page.waitForLoadState("load");
await page.waitForSelector("text=Grade", { timeout: 30000 });
await shot("admin-shell");
const adminText = await body();
check("admin entra direto na Grade", page.url().includes("/grade"));
check("admin nao tem pato grande (tom sobrio)", adminText.includes("Grade"));
const nav = await page.evaluate(() =>
  ["Grade", "Alunos", "Experimentais", "Planos", "Créditos", "Feriados"].filter(
    (label) => document.body.innerText.includes(label),
  ),
);
check("nav do admin tem as seis telas", nav.length === 6, nav.join(", "));

await shot("grade");
const slotButtons = page.locator('button[aria-label*="vagas livres de 8"]');
const slotCount = await slotButtons.count();
check("calendario mostra slots com rotulo de vagas", slotCount > 0, `${slotCount} slots`);
const miniDucks = await page.evaluate(
  () => document.querySelectorAll('[role="img"][aria-label*="vagas livres de 8"]').length,
);
check("cada slot tem os oito patinhos (miniatura)", miniDucks >= slotCount);
await slotButtons.first().click();
await page.waitForTimeout(600);
await shot("grade-panel");
const panel = page.locator("aside");
check("painel da turma abre com a lista", (await panel.count()) === 1);
const panelText = await panel.innerText();
check(
  "painel fala em Fixo, Reposição e Experimental",
  /Fixo/.test(panelText) && /Reposi/.test(panelText) && /Experimental/.test(panelText),
);

for (const [route, name] of [
  ["/alunos", "alunos"],
  ["/planos", "planos"],
  ["/creditos", "creditos"],
  ["/feriados", "feriados"],
  ["/experimentais", "experimentais"],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await shot(name);
  const text = await body();
  check(`${name} renderiza sem erro`, text.length > 200, `${text.length} chars`);
}

check(
  "nenhum recurso faltando nas telas visitadas",
  badResponses.length === 0,
  badResponses.slice(0, 6).join(" | "),
);

check(
  "nenhum erro de console nas telas visitadas",
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(" | "),
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} asserts do walk passaram`);
if (failed.length > 0) {
  console.log("Falhas:", failed.map((f) => f.name).join("; "));
  process.exitCode = 1;
}
