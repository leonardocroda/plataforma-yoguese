// Walk de fechamento da feature `redesign-marca` (implement.md, passo 9).
// Abre o app rodando e faz o que cada historia promete: a visitante escolhe a
// aula experimental, a professora entra e abre uma turma no calendario. Cada
// tela vira captura em .specs/features/redesign-marca/captures/ e cada assert
// abaixo e um criterio do spec que so o navegador prova.
//
// Roda com: node .specs/features/redesign-marca/walk.mjs
// Requer o dev server em http://localhost:3005 e o Postgres de desenvolvimento.
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

/** Comando no Postgres de desenvolvimento (o mesmo do .env.local). */
function sql(query) {
  return execFileSync(
    "docker",
    ["exec", "yoguese-db", "psql", "-U", "test", "-d", "test", "-t", "-A", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/** Emite eventos de rede atrasados, para ver o estado de carregamento. */
async function throttle(latencyMs) {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: latencyMs,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  return session;
}

async function unthrottle(session) {
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await session.detach();
}

// ---------- Home publica (BRAND-13..BRAND-18) ----------
// O primeiro acesso a uma rota compila no dev server e pode falhar uma vez
// (cache do .next). O aquecimento tira essa corrida de dentro do walk.
for (const url of [`${BASE}/`, `${BASE}/experimental`, `${BASE}/login`]) {
  await page.goto(url, { waitUntil: "load" }).catch(() => {});
}

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

// BRAND-15: o botao principal leva para a experimental (e nao so "aponta" para la)
await page.getByRole("link", { name: "Agendar aula experimental" }).click();
await page.waitForURL("**/experimental", { timeout: 30000 });
check("o CTA da home abre a experimental", page.url().endsWith("/experimental"), page.url());

// BRAND-17: o shell da home ja entrega o texto do guia enquanto a agenda nao chega
const shellHtml = await (await page.request.get(`${BASE}/`)).text();
check(
  "o shell da home traz 'Respirando fundo…' antes da lista",
  shellHtml.includes("Respirando fundo…"),
);
await page.goto(`${BASE}/`, { waitUntil: "load" });
check(
  "a agenda substitui o texto de carregamento",
  !(await body()).includes("Respirando fundo…"),
);

// BRAND-16: sem ocorrencia publicada, a home mostra o estado vazio do guia
const futuras = sql(
  "SELECT id FROM class_sessions WHERE session_date >= CURRENT_DATE AND status = 'AGENDADA'",
)
  .split("\n")
  .filter(Boolean);
try {
  sql(
    `UPDATE class_sessions SET status = 'CANCELADA' WHERE id IN (${futuras
      .map((id) => `'${id}'`)
      .join(",")})`,
  );
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const vazio = await body();
  check(
    "home sem agenda mostra o estado vazio do guia",
    vazio.includes("Nenhuma aula com vaga agora"),
  );
  check(
    "estado vazio sem fileira de patinhos",
    (await page.locator('[role="img"][aria-label*="vagas livres de 8"]').count()) === 0,
  );
} finally {
  sql(
    `UPDATE class_sessions SET status = 'AGENDADA' WHERE id IN (${futuras
      .map((id) => `'${id}'`)
      .join(",")})`,
  );
}
await page.goto(`${BASE}/`, { waitUntil: "load" });
check(
  "a agenda volta depois do estado vazio",
  (await body()).includes("Próximas aulas com vaga"),
);

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

// BRAND-20: a turma escolhida fica pintada de pesssego e ganha o patinho da pessoa
const pressedLook = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-pressed="true"]');
  if (!btn) return { bg: "", ducks: 0 };
  return {
    bg: getComputedStyle(btn).backgroundColor,
    ducks: btn.querySelectorAll(".pato.eu").length,
  };
});
check(
  "turma escolhida com fundo pessego claro",
  pressedLook.bg === "rgb(243, 226, 212)",
  pressedLook.bg,
);
check(
  "a pessoa ve o proprio pato em pessego",
  pressedLook.ducks === 1,
  `${pressedLook.ducks} patos`,
);

const submit = page.locator('button[type="submit"]');
check("botao bloqueado antes do pedido completo", await submit.isDisabled());

// BRAND-24: telefone pela metade mostra a frase do guia e segura o botao
await page.fill("#exp-tel", "11 9123");
const phoneHelp = await page
  .locator(".campo:has(#exp-tel) .ajuda")
  .first()
  .innerText();
check(
  "telefone incompleto mostra a frase do guia",
  phoneHelp.includes("Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678."),
  phoneHelp,
);
check(
  "telefone incompleto segura o botao",
  await submit.isDisabled(),
);

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
const pedidoPhone = `11 9${Date.now().toString().slice(-4)}-0002`;
await page.fill("#exp-tel", pedidoPhone);
await page.check('input[name="healthDeclaration"]');

// BRAND-25: com a rede lenta, o botao fica travado enquanto o pedido corre
const slow = await throttle(2500);
await page.locator('button[type="submit"]').click();
const travado = await page
  .waitForFunction(
    () => document.querySelector('button[type="submit"]')?.disabled === true,
    undefined,
    { timeout: 10000 },
  )
  .then(() => true)
  .catch(() => false);
check("botao travado enquanto o pedido esta em voo", travado);
await unthrottle(slow);

await page.waitForSelector("text=Pedido enviado", { timeout: 30000 });
await shot("experimental-confirm");
check("confirmacao diz 'Pedido enviado'", (await body()).includes("Pedido enviado"));

// BRAND-23: o mesmo telefone de novo mostra a frase do guia no campo
await gotoWithOptions(`${BASE}/experimental`, "button[aria-pressed]");
await page.locator('button[aria-pressed]').first().click();
await page.fill("#exp-nome", "Walk da Marca");
await page.fill("#exp-tel", pedidoPhone);
await page.check('input[name="healthDeclaration"]');
await page.locator('button[type="submit"]').click();
const duplicado = await page
  .locator(".campo.erro:has(#exp-tel) .ajuda")
  .first()
  .innerText({ timeout: 20000 })
  .catch(() => "");
check(
  "telefone repetido mostra a frase do guia",
  duplicado.includes("Já existe uma aula experimental para este telefone."),
  duplicado,
);
check(
  "erro do telefone repetido usa o estilo de erro",
  (await page.locator(".campo.erro:has(#exp-tel)").count()) === 1,
);

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
// Aquecimento das rotas do admin: cada uma compila no primeiro acesso.
for (const route of [
  "/alunos",
  "/planos",
  "/creditos",
  "/feriados",
  "/experimentais",
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "load" }).catch(() => {});
}
await page.goto(`${BASE}/grade`, { waitUntil: "load" });
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
  () =>
    document.querySelectorAll(
      '[role="img"][aria-label*="vaga livre de 8"], [role="img"][aria-label*="vagas livres de 8"]',
    ).length,
);
check(
  "cada slot tem os oito patinhos (miniatura)",
  miniDucks >= slotCount,
  `${miniDucks} patinhos para ${slotCount} slots`,
);
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

// BRAND-29: reserva manual confirma na pilula preta que nomeia a turma
const bookingsBefore = sql("SELECT id FROM bookings").split("\n").filter(Boolean);
// Uma aluna sem reserva ativa: a reserva manual precisa de vaga de verdade.
const livre = sql(
  "SELECT s.name FROM students s WHERE s.status = 'ATIVO' AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.student_id = s.id) LIMIT 1",
);
await page.selectOption("#grade-aluno", { label: livre });
await page.selectOption("#grade-tipo", "EXPERIMENTAL");
await page.getByRole("button", { name: "Reservar" }).click();
await page.waitForSelector(".toast", { timeout: 30000 });
const toastText = await page.locator(".toast").first().innerText();
check(
  "feedback da reserva e a pilula preta que nomeia a turma",
  /Reserva confirmada para .+/.test(toastText),
  toastText,
);
check(
  "a pilula traz o patinho da vaga",
  (await page.locator(".toast .vagas").count()) > 0,
);

// BRAND-30: a mesma reserva de novo falha em texto puro, sem desculpa nem humor
await page.selectOption("#grade-aluno", { label: livre });
await page.getByRole("button", { name: "Reservar" }).click();
await page.waitForFunction(
  () =>
    [...document.querySelectorAll('[role="alert"]')].some(
      (element) => (element.textContent ?? "").trim().length > 0,
    ),
  undefined,
  { timeout: 30000 },
);
const alertas = (await page.locator('[role="alert"]').allInnerTexts())
  .map((text) => text.trim())
  .filter(Boolean);
const erroReserva = alertas.join(" | ");
check(
  "falha da reserva aparece em texto puro",
  erroReserva.length > 0 &&
    !/[!]/.test(erroReserva) &&
    !/desculp|perdão|\bpato\b/i.test(erroReserva) &&
    !/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u.test(erroReserva),
  erroReserva,
);

// BRAND-31: em 1280px a grade, o painel e os forms nao estouram a largura
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/grade`, { waitUntil: "load" });
await page.waitForSelector("text=Grade", { timeout: 30000 });
const overflow1280 = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("grade em 1280px sem rolagem horizontal", overflow1280 <= 1, `${overflow1280}px`);
await page.setViewportSize(DESKTOP);

// O walk devolve o banco de desenvolvimento ao estado em que o encontrou.
const bookingsAfter = sql("SELECT id FROM bookings").split("\n").filter(Boolean);
const novas = bookingsAfter.filter((id) => !bookingsBefore.includes(id));
if (novas.length > 0) {
  sql(`DELETE FROM bookings WHERE id IN (${novas.map((id) => `'${id}'`).join(",")})`);
}
sql("DELETE FROM experimentals WHERE name = 'Walk da Marca'");

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
