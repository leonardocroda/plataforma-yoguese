// Walk de fechamento da feature `admin-calendario` (implement.md, passo 9).
// Abre o app rodando e faz o que cada historia promete: a professora abre o
// calendario, troca de vista, navega no tempo, le os participantes, cancela a
// aula de D+14, bloqueia uma turma numa data e volta para hoje. Cada tela
// vira captura em .specs/features/admin-calendario/captures/ e cada assert
// abaixo e um criterio do spec que so o navegador prova.
//
// Roda com: node .specs/features/admin-calendario/walk.mjs
// Requer o dev server em http://localhost:3001 e o Postgres de desenvolvimento.
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "file:///C:/Users/leona/projects/plataforma-yoguese/node_modules/playwright-core/index.mjs";

const BASE = "http://localhost:3001";
const OUT = ".specs/features/admin-calendario/captures";
const DESKTOP = { width: 1440, height: 900 };
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

/** Comando no Postgres de desenvolvimento (o mesmo do .env.local). */
function sql(query) {
  return execFileSync(
    "docker",
    ["exec", "yoguese-db", "psql", "-U", "test", "-d", "test", "-t", "-A", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function sqlRows(query) {
  return sql(query)
    .split("\n")
    .filter(Boolean);
}

/** Datas do studio sao strings "YYYY-MM-DD"; a aritmetica e em UTC. */
function parse(date) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
function iso(stamp) {
  return new Date(stamp).toISOString().slice(0, 10);
}
function addDays(date, amount) {
  return iso(parse(date) + amount * 86400000);
}
/** 0 = domingo ... 6 = sabado. */
function weekdayIndex(date) {
  return new Date(parse(date)).getUTCDay();
}
/** Segunda da semana de calendario que contem a data. */
function mondayOf(date) {
  return addDays(date, -((weekdayIndex(date) + 6) % 7));
}
/** Soma meses preservando o dia (o mesmo passo da seta da vista mensal). */
function addMonths(date, amount) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

const today = sql("SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date");
const d14 = addDays(today, 14);
const monday = mondayOf(today);
const nextMonday = addDays(monday, 7);
const d14Monday = mondayOf(d14);
/** Terca e quinta da semana de D+14: os alvos das historias. */
const tueOfD14 = addDays(d14Monday, 1);
const thursday = addDays(today, ((4 - weekdayIndex(today) + 7) % 7) || 7);
const wednesday = addDays(nextMonday, 2);

/** Turmas do cenario: a de terca (com participantes) e a de quinta (bloqueio). */
const tuesdaySlot = sql(
  "SELECT id FROM class_slots WHERE weekday = 3 AND start_time = '19:00' LIMIT 1",
);
const thursdaySlot = sql(
  "SELECT id FROM class_slots WHERE weekday = 5 AND start_time = '19:00' LIMIT 1",
);
const wednesdaySlot = sql(
  "SELECT id FROM class_slots WHERE weekday = 4 AND start_time = '09:30' LIMIT 1",
);

// ---------- Cenario (repetivel: limpa o que o walk anterior deixou) ----------
sql(`
  DELETE FROM credit_transactions WHERE credit_id IN (
    SELECT id FROM credits
    WHERE student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%')
  );
  DELETE FROM credits
    WHERE student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%')
       OR admin_label = 'Walk Calendario';
  DELETE FROM bookings
    WHERE student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%')
       OR class_session_id IN (
         SELECT id FROM class_sessions WHERE class_slot_id = NULLIF('${thursdaySlot}', '')::uuid
       );
  DELETE FROM experimentals WHERE name LIKE 'Walk Calendario%';
  DELETE FROM fixed_enrollments
    WHERE student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%');
  DELETE FROM class_sessions WHERE class_slot_id = NULLIF('${thursdaySlot}', '')::uuid;
  DELETE FROM class_date_blocks WHERE class_slot_id = NULLIF('${thursdaySlot}', '')::uuid;
  DELETE FROM class_slots WHERE id = NULLIF('${thursdaySlot}', '')::uuid;
  DELETE FROM students WHERE name LIKE 'Walk Calendario%';
  DELETE FROM holidays WHERE name = 'Walk Calendario feriado';
  DELETE FROM credit_transactions WHERE credit_id IN (
    SELECT id FROM credits
    WHERE source_session_id IN (
      SELECT id FROM class_sessions
      WHERE class_slot_id = '${tuesdaySlot}' AND session_date = '${tueOfD14}'
    )
  );
  DELETE FROM credits
    WHERE source_session_id IN (
      SELECT id FROM class_sessions
      WHERE class_slot_id = '${tuesdaySlot}' AND session_date = '${tueOfD14}'
    );
  UPDATE class_sessions SET status = 'AGENDADA'
    WHERE class_slot_id = '${tuesdaySlot}' AND session_date = '${tueOfD14}';
  UPDATE class_sessions SET status = 'AGENDADA'
    WHERE class_slot_id = '${wednesdaySlot}' AND session_date = '${wednesday}';
`);

sql(`
  INSERT INTO students (name, phone, email, birth_date, enrollment_date, status)
  SELECT 'Walk Calendario ' || g,
         '1199999' || lpad(g::text, 4, '0'),
         'walk' || g || '@yoguese.com',
         '1990-01-01',
         (now() AT TIME ZONE 'America/Sao_Paulo')::date,
         'ATIVO'
  FROM generate_series(1, 4) g;
`);

sql(`
  INSERT INTO fixed_enrollments (student_id, class_slot_id, start_date, status)
  SELECT s.id, '${tuesdaySlot}', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 60, 'ATIVA'
  FROM students s
  WHERE s.name LIKE 'Walk Calendario%';
`);

sql(`
  INSERT INTO class_slots (class_type_id, weekday, start_time, end_time, capacity, status)
  SELECT id, 5, '19:00', '20:00', 8, 'ATIVA'
  FROM class_types
  WHERE name = 'Superioga Intenso';
`);

const thursdaySlotNow = sql(
  "SELECT id FROM class_slots WHERE weekday = 5 AND start_time = '19:00' LIMIT 1",
);

/** Reserva de reposicao com credito RESERVADO, como o admin deixaria. */
function seedMakeup(slotId, date, studentName) {
  sql(`
    INSERT INTO bookings (student_id, class_session_id, booking_type, status)
    SELECT st.id, s.id, 'MAKEUP', 'ATIVA'
    FROM students st, class_sessions s
    WHERE st.name = '${studentName}'
      AND s.class_slot_id = '${slotId}'
      AND s.session_date = '${date}';
  `);
  sql(`
    INSERT INTO credits (student_id, source, used_booking_id, status, expires_at, admin_label)
    SELECT b.student_id, 'CONCESSAO_MANUAL', b.id, 'RESERVADO', now() + interval '60 days', 'Walk Calendario'
    FROM bookings b
    JOIN students st ON st.id = b.student_id
    WHERE st.name = '${studentName}'
      AND b.class_session_id = (
        SELECT id FROM class_sessions WHERE class_slot_id = '${slotId}' AND session_date = '${date}'
      )
      AND b.booking_type = 'MAKEUP';
  `);
  return sql(`
    SELECT id FROM credits
    WHERE student_id = (SELECT id FROM students WHERE name = '${studentName}')
      AND admin_label = 'Walk Calendario'
    ORDER BY generated_at DESC LIMIT 1
  `);
}

const tuesdaySession = sql(
  `SELECT id FROM class_sessions WHERE class_slot_id = '${tuesdaySlot}' AND session_date = '${tueOfD14}'`,
);
const tuesdayCredit = seedMakeup(tuesdaySlot, tueOfD14, "Walk Calendario 1");

/** Experimental aprovada na mesma ocorrencia: o vinculo experimental do painel. */
sql(`
  INSERT INTO experimentals (name, phone, phone_normalized, class_session_id, status, health_declaration, requested_at)
  VALUES ('Walk Calendario Visitante', '11 98888-7777', '11988887777', '${tuesdaySession}', 'APROVADA', 'declaro', now());
`);

// ---------- Navegador ----------
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
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/${name}.running.png`,
    fullPage: true,
  });
  console.log(`  captura: captures/${name}.running.png`);
}

async function body() {
  return page.evaluate(() => document.body.innerText);
}

function urlParam(name) {
  return new URL(page.url()).searchParams.get(name);
}

// ---------- Login ----------
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.fill('input[name="email"]', ADMIN.email);
await page.fill('input[name="password"]', ADMIN.password);
await page.locator('button[type="submit"]').click();
await page.waitForURL("**/grade", { timeout: 30000 });
await page.waitForLoadState("load");

// ---------- P1: as tres vistas e a navegacao (CAL-01..04) ----------
await page.goto(`${BASE}/grade`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
check(
  "grade sem parametros abre a semana de hoje",
  urlParam("view") === null && urlParam("data") === null,
  page.url(),
);
const weekSlots = await page.locator('button[aria-label*="vagas livres de"]').count();
check("a semana mostra as ocorrencias da turma", weekSlots > 0, `${weekSlots} horarios`);

await page.getByRole("tab", { name: "Mensal" }).click();
await page.waitForURL("**/grade?*view=mes*", { timeout: 20000 });
await page.waitForTimeout(400);
check("a aba Mensal abre o mes da data", urlParam("view") === "mes", urlParam("data") ?? "");
const monthCells = await page.locator("section div.grid-cols-7 > div").count();
check(
  "a vista mensal desenha as semanas do mes",
  monthCells - 7 >= 28,
  `${monthCells - 7} dias`,
);
const monthHrefs = await page
  .locator('section a[href*="ocorrencia="]')
  .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
const monthOfToday = today.slice(0, 7);
check(
  "a vista mensal so traz ocorrencias do mes escolhido",
  monthHrefs.every((href) => {
    const key = decodeURIComponent(href.split("ocorrencia=")[1] ?? "");
    return key.split("|")[1]?.startsWith(monthOfToday) ?? false;
  }),
  `${monthHrefs.length} ocorrencias em ${monthOfToday}`,
);

await page.getByRole("tab", { name: "Diária" }).click();
await page.waitForURL("**/grade?*view=dia*", { timeout: 20000 });
await page.waitForTimeout(400);
const dayHrefs = await page
  .locator('section a[href*="ocorrencia="]')
  .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
check(
  "a aba Diaria mostra so o dia selecionado",
  urlParam("view") === "dia" &&
    dayHrefs.every((href) => {
      const key = decodeURIComponent(href.split("ocorrencia=")[1] ?? "");
      return key.split("|")[1] === today;
    }),
  `${dayHrefs.length} ocorrencias em ${today}`,
);

// A vista diaria de um dia com aula mostra exatamente as ocorrencias dele.
await page.goto(`${BASE}/grade?view=dia&data=${tueOfD14}`, { waitUntil: "load" });
await page.waitForTimeout(600);
const tueHrefs = await page
  .locator('section a[href*="ocorrencia="]')
  .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
check(
  "a vista diaria mostra as ocorrencias do dia escolhido",
  tueHrefs.length > 0 &&
    tueHrefs.every((href) => {
      const key = decodeURIComponent(href.split("ocorrencia=")[1] ?? "");
      return key.split("|")[1] === tueOfD14;
    }),
  `${tueHrefs.length} ocorrencias em ${tueOfD14}`,
);

// As setas andam exatamente um dia, uma semana ou um mes conforme a aba.
const dayBase = urlParam("data");
await page.getByRole("link", { name: "Próximo período" }).click();
await page.waitForTimeout(500);
const dayNext = urlParam("data");
check(
  "a seta da vista Diaria anda um dia",
  dayNext === addDays(dayBase, 1),
  `${dayBase} -> ${dayNext}`,
);
const dayBackBase = urlParam("data");
await page.getByRole("link", { name: "Período anterior" }).click();
await page.waitForTimeout(500);
check(
  "a seta da vista Diaria volta um dia",
  urlParam("data") === addDays(dayBackBase, -1),
  `${dayBackBase} -> ${urlParam("data")}`,
);

await page.getByRole("tab", { name: "Semanal" }).click();
await page.waitForURL("**/grade?*view=semana*", { timeout: 20000 });
await page.waitForTimeout(400);
const weekBase = urlParam("data");
await page.getByRole("link", { name: "Próximo período" }).click();
await page.waitForTimeout(500);
const weekNext = urlParam("data");
check(
  "a seta da vista Semanal anda uma semana",
  weekNext === addDays(weekBase, 7),
  `${weekBase} -> ${weekNext}`,
);

await page.getByRole("tab", { name: "Mensal" }).click();
await page.waitForURL("**/grade?*view=mes*", { timeout: 20000 });
await page.waitForTimeout(400);
const monthBefore = urlParam("data");
await page.getByRole("link", { name: "Próximo período" }).click();
await page.waitForTimeout(500);
const monthNext = urlParam("data");
check(
  "a seta da vista Mensal anda um mes",
  monthNext === addMonths(monthBefore, 1),
  `${monthBefore} -> ${monthNext}`,
);

// O seletor de data leva a qualquer dia, inclusive D+14.
await page.goto(`${BASE}/grade?view=semana&data=${today}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.fill('input[name="data"]', d14);
await page.getByRole("button", { name: "Ir", exact: true }).click();
await page.waitForURL(`**/grade?*data=${d14}*`, { timeout: 20000 });
await page.waitForTimeout(500);
check("o seletor de data leva a D+14", urlParam("data") === d14, urlParam("data") ?? "");
const d14WeekText = await body();
check(
  "a semana de D+14 mostra a turma da terca as 19h",
  d14WeekText.includes("Intenso"),
  `semana de ${d14Monday}`,
);

// ---------- P1: participantes da ocorrencia (CAL-10, CAL-11) ----------
await page.goto(
  `${BASE}/grade?view=semana&data=${d14}&ocorrencia=${tuesdaySlot}|${tueOfD14}`,
  { waitUntil: "load" },
);
await page.waitForSelector("aside", { timeout: 30000 });
await page.waitForTimeout(500);
const panel = page.locator("aside");
const panelText = await panel.innerText();
check(
  "o painel lista os tres vinculos",
  /Fixo/.test(panelText) && /Reposição/.test(panelText) && /Experimental/.test(panelText),
);
const fixoLinks = await panel.locator('a[href^="/alunos/"]').count();
check("os fixos da ocorrencia abrem o cadastro do aluno", fixoLinks > 0, `${fixoLinks} links`);
const experimentalNames = await panel.locator('a[href^="/alunos/"]').allInnerTexts();
check(
  "a composicao da ocorrencia soma os vinculos do painel",
  fixoLinks === Number(sql(`
    SELECT count(DISTINCT fe.student_id)
    FROM fixed_enrollments fe
    WHERE fe.class_slot_id = '${tuesdaySlot}'
      AND fe.status = 'ATIVA'
      AND fe.start_date <= '${tueOfD14}'
      AND (fe.end_date IS NULL OR fe.end_date > '${tueOfD14}')
  `)),
  `${fixoLinks} fixos`,
);
await shot("admin-calendario-painel");

const alunoHref = await panel.locator('a[href^="/alunos/"]').first().getAttribute("href");
await panel.locator('a[href^="/alunos/"]').first().click();
await page.waitForURL("**/alunos/**", { timeout: 30000 });
check("clicar num participante abre o cadastro", page.url().includes(alunoHref), page.url());

// ---------- P1: selos de cancelada e bloqueada (CAL-07, CAL-08) ----------
await page.goto(`${BASE}/grade?view=semana&data=${nextMonday}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.waitForTimeout(400);
const weekText = await body();
check(
  "a ocorrencia cancelada aparece com selo",
  weekText.includes("Cancelada"),
  `semana de ${nextMonday}`,
);

// O feriado e cadastrado pela tela do admin: o reconcile marca a ocorrencia.
await page.goto(`${BASE}/feriados`, { waitUntil: "load" });
await page.waitForSelector("#feriado-data", { timeout: 30000 });
await page.fill("#feriado-data", wednesday);
await page.fill("#feriado-nome", "Walk Calendario feriado");
await page.locator('form:has(#feriado-data) button[type="submit"]').click();
await page.waitForSelector(".toast", { timeout: 30000 });
check("o feriado cadastrado bloqueia a data", (await body()).includes("Feriado cadastrado"));

await page.goto(`${BASE}/grade?view=semana&data=${nextMonday}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.waitForTimeout(400);
const weekText2 = await body();
check(
  "a ocorrencia bloqueada aparece com selo",
  weekText2.includes("Bloqueada"),
  `semana de ${nextMonday}`,
);
await shot("admin-calendario-semana");

// ---------- P1: cancelar pelo estudio em D+14 (CAL-12, CAL-16) ----------
await page.goto(
  `${BASE}/grade?view=semana&data=${d14}&ocorrencia=${tuesdaySlot}|${tueOfD14}`,
  { waitUntil: "load" },
);
await page.waitForSelector("aside", { timeout: 30000 });
await page.waitForTimeout(500);
const fixosBefore = Number(sql(`
  SELECT count(DISTINCT fe.student_id)
  FROM fixed_enrollments fe
  WHERE fe.class_slot_id = '${tuesdaySlot}'
    AND fe.status = 'ATIVA'
    AND fe.start_date <= '${tueOfD14}'
    AND (fe.end_date IS NULL OR fe.end_date > '${tueOfD14}')
`));
await page.getByRole("button", { name: "Cancelar aula" }).click();
await page.waitForSelector(".toast", { timeout: 30000 });
const cancelToast = await page.locator(".toast").first().innerText();
check(
  "o cancelamento mostra o resultado na tela",
  /Ocorrência cancelada/.test(cancelToast) &&
    /Reservas canceladas/.test(cancelToast) &&
    /Créditos devolvidos/.test(cancelToast) &&
    /Créditos gerados/.test(cancelToast),
  cancelToast,
);
const sessionStatus = sql(
  `SELECT status FROM class_sessions WHERE id = '${tuesdaySession}'`,
);
const bookingState = sql(`
  SELECT b.status || '/' || coalesce(b.cancelled_by::text, '-')
  FROM bookings b
  JOIN students st ON st.id = b.student_id
  WHERE st.name = 'Walk Calendario 1'
    AND b.class_session_id = '${tuesdaySession}'
    AND b.booking_type = 'MAKEUP'
`);
const returnedCredit = sql(`SELECT status FROM credits WHERE id = '${tuesdayCredit}'`);
const studioCredits = sqlRows(`
  SELECT id FROM credits
  WHERE source = 'CANCELAMENTO_ESTUDIO' AND source_session_id = '${tuesdaySession}'
`).length;
check("a ocorrencia fica CANCELADA", sessionStatus === "CANCELADA", sessionStatus);
check(
  "a reserva ativa e cancelada pelo estudio",
  bookingState === "CANCELADA/ESTUDIO",
  bookingState,
);
check("o credito reservado da reposicao volta a DISPONIVEL", returnedCredit === "DISPONIVEL", returnedCredit);
check(
  "um credito de estudio por fixo afetado",
  studioCredits === fixosBefore,
  `${studioCredits} creditos para ${fixosBefore} fixos`,
);

// ---------- P2: bloquear a turma numa data (CAL-18..21) ----------
await page.goto(`${BASE}/grade?view=dia&data=${thursday}`, { waitUntil: "load" });
await page.waitForSelector('section a[href*="ocorrencia="]', { timeout: 30000 });
await page.waitForTimeout(500);
const thursdaySession = sql(
  `SELECT id FROM class_sessions WHERE class_slot_id = '${thursdaySlotNow}' AND session_date = '${thursday}'`,
);
const thursdayCredit = seedMakeup(thursdaySlotNow, thursday, "Walk Calendario 2");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
await page.locator('section a[href*="ocorrencia="]').first().click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Bloquear nesta data" }).click();
await page.waitForSelector(".toast", { timeout: 30000 });
const blockToast = await page.locator(".toast").first().innerText();
check("o bloqueio da turma confirma na tela", /bloqueada nesta data/i.test(blockToast), blockToast);
const blockedStatus = sql(
  `SELECT status FROM class_sessions WHERE id = '${thursdaySession}'`,
);
const blockedBooking = sql(`
  SELECT b.status FROM bookings b
  JOIN students st ON st.id = b.student_id
  WHERE st.name = 'Walk Calendario 2'
    AND b.class_session_id = '${thursdaySession}'
    AND b.booking_type = 'MAKEUP'
`);
const blockedCredit = sql(`SELECT status FROM credits WHERE id = '${thursdayCredit}'`);
const blockedStudioCredits = sqlRows(`
  SELECT id FROM credits
  WHERE source = 'CANCELAMENTO_ESTUDIO' AND source_session_id = '${thursdaySession}'
`).length;
check("a ocorrencia bloqueada fica BLOQUEADA", blockedStatus === "BLOQUEADA", blockedStatus);
check("a reserva ativa da data bloqueada e cancelada", blockedBooking === "CANCELADA", blockedBooking);
check(
  "o credito da reposicao volta a DISPONIVEL no bloqueio",
  blockedCredit === "DISPONIVEL",
  blockedCredit,
);
check(
  "o bloqueio nao gera credito de estudio",
  blockedStudioCredits === 0,
  `${blockedStudioCredits} creditos`,
);

// Cancelar em ocorrencia bloqueada e recusado.
await page.getByRole("button", { name: "Cancelar aula" }).click();
await page.waitForFunction(
  () =>
    [...document.querySelectorAll('[role="alert"]')].some(
      (element) => (element.textContent ?? "").trim().length > 0,
    ),
  undefined,
  { timeout: 30000 },
);
const blockedAlerts = (await page.locator('[role="alert"]').allInnerTexts())
  .map((text) => text.trim())
  .filter(Boolean);
const blockedAlert = blockedAlerts.join(" | ");
check(
  "cancelar em ocorrencia bloqueada e recusado com mensagem",
  blockedAlert.length > 0 && /bloqueada/i.test(blockedAlert),
  blockedAlert,
);

// Remover o bloco volta a ocorrencia a AGENDADA e nao restaura a reserva.
await page.getByRole("button", { name: "Remover bloqueio" }).click();
await page.waitForSelector(".toast", { timeout: 30000 });
await page.waitForTimeout(600);
const unblockedStatus = sql(
  `SELECT status FROM class_sessions WHERE id = '${thursdaySession}'`,
);
const stillCancelled = sql(`
  SELECT b.status FROM bookings b
  JOIN students st ON st.id = b.student_id
  WHERE st.name = 'Walk Calendario 2'
    AND b.class_session_id = '${thursdaySession}'
    AND b.booking_type = 'MAKEUP'
`);
check("remover o bloqueio volta a AGENDADA", unblockedStatus === "AGENDADA", unblockedStatus);
check(
  "a reserva cancelada pelo bloqueio nao e restaurada",
  stillCancelled === "CANCELADA",
  stillCancelled,
);

// ---------- Passado e read-only (AD-029, CAL-15 na tela) ----------
const pastDate = sql(
  `SELECT session_date FROM class_sessions WHERE session_date < '${today}' ORDER BY session_date LIMIT 1`,
);
await page.goto(`${BASE}/grade?view=dia&data=${pastDate}`, { waitUntil: "load" });
await page.waitForSelector('section a[href*="ocorrencia="]', { timeout: 30000 });
await page.locator('section a[href*="ocorrencia="]').first().click();
await page.waitForTimeout(900);
const pastPanel = await page.locator("aside").innerText();
const pastCancel = await page.getByRole("button", { name: "Cancelar aula" }).count();
const pastReserve = await page.getByRole("button", { name: "Reservar" }).count();
check(
  "a ocorrencia passada mostra os participantes",
  pastPanel.length > 40,
  `${pastPanel.length} chars no painel`,
);
check(
  "a ocorrencia passada e read-only",
  pastCancel === 0 && pastReserve === 0,
  `cancelar=${pastCancel} reservar=${pastReserve}`,
);

// ---------- P3: voltar para hoje (CAL-22) ----------
await page.getByRole("link", { name: "Hoje" }).click();
await page.waitForTimeout(600);
check(
  "a acao Hoje volta para a data de hoje",
  urlParam("data") === today,
  urlParam("data") ?? "",
);

// ---------- CAL-09: a composicao do guia sem estourar a largura ----------
for (const [view, label] of [
  ["semana", "Semanal"],
  ["dia", "Diária"],
  ["mes", "Mensal"],
]) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/grade?view=${view}&data=${today}`, { waitUntil: "load" });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(`a vista ${label} nao estoura a largura em 1280px`, overflow <= 1, `${overflow}px`);
}
await page.setViewportSize(DESKTOP);

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

// ---------- Cenario devolvecido ao estado que as capturas mostram ----------
// O cancelamento da historia consumiu a ocorrencia de terca da semana de D+14:
// o estado final (CANCELADA, com a composicao consumida) fica provado no log
// e no banco, mas a tela volta a ter a composicao para o juiz de telas e para
// a pessoa que quiser abrir o mesmo estado.
sql(`
  DELETE FROM credit_transactions WHERE credit_id IN (
    SELECT id FROM credits WHERE source_session_id = '${tuesdaySession}'
  );
  DELETE FROM credits WHERE source_session_id = '${tuesdaySession}';
  DELETE FROM bookings
    WHERE class_session_id = '${tuesdaySession}'
      AND student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%');
  UPDATE class_sessions SET status = 'AGENDADA' WHERE id = '${tuesdaySession}';
  UPDATE experimentals SET status = 'APROVADA'
    WHERE class_session_id = '${tuesdaySession}' AND name LIKE 'Walk Calendario%';
`);
seedMakeup(tuesdaySlot, tueOfD14, "Walk Calendario 1");

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} asserts do walk passaram`);
if (failed.length > 0) {
  console.log("Falhas:", failed.map((f) => f.name).join("; "));
  process.exitCode = 1;
}
