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
/** Ultimo dia do mes da data. */
function monthEnd(date) {
  const [year, month] = date.split("-").map(Number);
  return iso(Date.UTC(year, month, 0));
}
/** "2026-11-13" vira "13/11". */
function dayLabel(date) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
/** "2026-11-14" vira "14/11/2026" (o periodo da tela). */
function formatBR(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}
/** "19:00" vira "19h"; "09:30" vira "09h30" (a voz do guia). */
function hourLabel(time) {
  const [hour, minute] = time.split(":");
  return minute && minute !== "00" ? `${hour}h${minute}` : `${hour}h`;
}

const today = sql("SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date");
const d14 = addDays(today, 14);
const monday = mondayOf(today);
const nextMonday = addDays(monday, 7);
const currentTuesday = addDays(monday, 1);
const d14Monday = mondayOf(d14);
/** Terca e quinta da semana de D+14: os alvos das historias. */
const tueOfD14 = addDays(d14Monday, 1);
const thursday = addDays(today, ((4 - weekdayIndex(today) + 7) % 7) || 7);
const wednesday = addDays(nextMonday, 2);
/** Recesso do walk numa semana que nao aparece nas capturas (quarta 02/12). */
const closureDate = addDays(d14Monday, 9);
const closureMonday = mondayOf(closureDate);
/** Data passada que o walk garante nunca materializada (terca 06/10). */
const pastTuesday = "2026-10-06";

/** Rotulos das colunas da grade, segunda a domingo (o guia e as vistas). */
const MONTH_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** Rotulo do dia da semana de uma data na ordem segunda-primeiro. */
function weekdayLabel(date) {
  return MONTH_LABELS[(weekdayIndex(date) + 6) % 7];
}

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
  DELETE FROM studio_closures WHERE reason LIKE 'Walk Calendario%';
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

// O passado nunca materializado (CAL-06): o walk apaga qualquer sessao da
// data do teste para provar que as tres vistas nao a desenham.
sql(`
  DELETE FROM experimental_reschedules
    WHERE from_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    )
       OR to_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    );
  DELETE FROM experimentals
    WHERE class_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    );
  DELETE FROM credit_transactions WHERE credit_id IN (
    SELECT id FROM credits
    WHERE source_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    )
       OR used_booking_id IN (
      SELECT id FROM bookings
      WHERE class_session_id IN (
        SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
      )
    )
  );
  DELETE FROM credits
    WHERE source_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    )
       OR used_booking_id IN (
      SELECT id FROM bookings
      WHERE class_session_id IN (
        SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
      )
    );
  DELETE FROM bookings
    WHERE class_session_id IN (
      SELECT id FROM class_sessions WHERE session_date = '${pastTuesday}'
    );
  DELETE FROM class_sessions WHERE session_date = '${pastTuesday}';
`);

sql(`
  INSERT INTO students (name, phone, email, birth_date, enrollment_date, status)
  SELECT 'Walk Calendario ' || g,
         '1199999' || lpad(g::text, 4, '0'),
         'walk' || g || '@yoguese.com',
         '1990-01-01',
         (now() AT TIME ZONE 'America/Sao_Paulo')::date,
         'ATIVO'
  FROM generate_series(1, 5) g;
`);

// As cinco alunas existem, mas so as quatro primeiras sao fixas na terca: a
// reposicao (a quinta) e de uma aluna de fora da turma (CAL-11).
sql(`
  INSERT INTO fixed_enrollments (student_id, class_slot_id, start_date, status)
  SELECT s.id, '${tuesdaySlot}', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 60, 'ATIVA'
  FROM students s
  WHERE s.name IN ('Walk Calendario 1', 'Walk Calendario 2', 'Walk Calendario 3', 'Walk Calendario 4');
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

// A semana padrao de hoje precisa de uma ocorrencia materializada: a terca
// desta semana ja passou e o leitor so mostra sessao existente no passado.
sql(`
  INSERT INTO class_sessions (class_slot_id, session_date, status)
  VALUES ('${tuesdaySlot}', '${currentTuesday}', 'AGENDADA')
  ON CONFLICT (class_slot_id, session_date) DO UPDATE SET status = 'AGENDADA';
`);

const tuesdaySession = sql(
  `SELECT id FROM class_sessions WHERE class_slot_id = '${tuesdaySlot}' AND session_date = '${tueOfD14}'`,
);
const makeupStudent = sql("SELECT id FROM students WHERE name = 'Walk Calendario 5'");
const tuesdayCredit = seedMakeup(tuesdaySlot, tueOfD14, "Walk Calendario 5");

/** Experimental aprovada na mesma ocorrencia: o vinculo experimental do painel. */
sql(`
  INSERT INTO experimentals (name, phone, phone_normalized, class_session_id, status, health_declaration, requested_at)
  VALUES ('Walk Calendario Visitante', '11 98888-7777', '11988887777', '${tuesdaySession}', 'APROVADA', 'declaro', now());
`);

/**
 * Composicao de uma ocorrencia lida direto do banco, com a mesma regra do
 * leitor (CAL-05): fixos pelos vinculos ativos que cobrem a data, menos quem
 * avisou falta/cancelamento; reposicoes e experimentais pelas reservas ativas
 * deduplicadas; a experimental aprovada soma; a vaga e capacidade - total.
 */
function occurrenceFacts(slotId, date) {
  const [startTime, className, capacityText] = sql(`
    SELECT s.start_time || '|' || ct.name || '|' || s.capacity
    FROM class_slots s
    JOIN class_types ct ON ct.id = s.class_type_id
    WHERE s.id = '${slotId}'
  `).split("|");
  const sessionId = sql(
    `SELECT id FROM class_sessions WHERE class_slot_id = '${slotId}' AND session_date = '${date}'`,
  );
  const absent = new Set(
    sqlRows(`
      SELECT student_id FROM bookings
      WHERE class_session_id = '${sessionId}'
        AND booking_type = 'FIXED'
        AND status IN ('CANCELADA', 'FALTA')
    `),
  );
  const fixedIds = sqlRows(`
    SELECT DISTINCT fe.student_id
    FROM fixed_enrollments fe
    JOIN students st ON st.id = fe.student_id
    WHERE fe.class_slot_id = '${slotId}'
      AND fe.status = 'ATIVA'
      AND fe.start_date <= '${date}'
      AND (fe.end_date IS NULL OR fe.end_date > '${date}')
      AND st.status = 'ATIVO'
  `).filter((studentId) => !absent.has(studentId));
  const counted = new Set(fixedIds);
  let fixed = fixedIds.length;
  let makeup = 0;
  let experimental = 0;
  for (const row of sqlRows(`
    SELECT b.student_id || '|' || b.booking_type
    FROM bookings b
    JOIN students st ON st.id = b.student_id
    WHERE b.class_session_id = '${sessionId}'
      AND b.status = 'ATIVA'
      AND st.status = 'ATIVO'
  `)) {
    const [studentId, type] = row.split("|");
    if (counted.has(studentId)) continue;
    counted.add(studentId);
    if (type === "FIXED") fixed += 1;
    else if (type === "MAKEUP") makeup += 1;
    else experimental += 1;
  }
  experimental += Number(
    sql(
      `SELECT count(*) FROM experimentals WHERE class_session_id = '${sessionId}' AND status = 'APROVADA'`,
    ),
  );
  const capacity = Number(capacityText);
  return {
    startTime,
    className,
    capacity,
    fixed,
    makeup,
    experimental,
    spots: capacity - (fixed + makeup + experimental),
    sessionId,
  };
}

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

/** Os sete cabecalhos da grade semanal, "Seg 09/11" (segunda a domingo). */
async function weekHeaders() {
  return page.evaluate(() => {
    const grid = document.querySelector("section div.overflow-x-auto > div");
    if (!grid) return [];
    return [...grid.children]
      .slice(1, 8)
      .map((cell) => cell.innerText.replace(/\s+/g, " ").trim());
  });
}

/** Texto das ocorrencias da coluna de uma data na grade semanal. */
async function weekColumnText(date) {
  return page.evaluate((target) => {
    const grid = document.querySelector("section div.overflow-x-auto > div");
    if (!grid) return null;
    const children = [...grid.children];
    const targetLabel = `${target.slice(8, 10)}/${target.slice(5, 7)}`;
    const columns = children
      .slice(1, 8)
      .map((cell) => (cell.innerText.includes(targetLabel) ? [] : null));
    for (let i = 8; i < children.length; i++) {
      const offset = (i - 8) % 8;
      if (offset === 0) continue;
      const column = columns[offset - 1];
      if (!column) continue;
      column.push(children[i].innerText.replace(/\s+/g, " ").trim());
    }
    const found = columns.find((column) => column);
    return found ? found.filter(Boolean).join(" | ") : null;
  }, date);
}

/** Texto da ocorrencia de uma data nas vistas que usam links (dia e mes). */
async function occurrenceCellText(date) {
  const links = page.locator('section a[href*="ocorrencia="]');
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    const key = decodeURIComponent((href ?? "").split("ocorrencia=")[1] ?? "");
    if (key.split("|")[1] === date) {
      return (await links.nth(i).innerText()).replace(/\s+/g, " ");
    }
  }
  return null;
}

/** Datas das ocorrencias desenhadas como link (vistas diaria e mensal). */
async function occurrenceDatesOnPage() {
  const hrefs = await page
    .locator('section a[href*="ocorrencia="]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return hrefs.map(
    (href) => decodeURIComponent(href.split("ocorrencia=")[1] ?? "").split("|")[1] ?? "",
  );
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

// CAL-01/CAL-02: a semana padrao e segunda a domingo da data de hoje, com as
// sete colunas rotuladas e as datas certas.
const defaultHeaders = await weekHeaders();
const expectedWeek = Array.from({ length: 7 }, (_, index) => {
  const date = addDays(monday, index);
  return `${weekdayLabel(date)} ${dayLabel(date)}`;
});
check(
  "a semana padrao vai de segunda a domingo de hoje com as sete colunas",
  defaultHeaders.length === 7 &&
    defaultHeaders.join("|") === expectedWeek.join("|") &&
    defaultHeaders[0].startsWith("Seg") &&
    defaultHeaders[6].startsWith("Dom"),
  defaultHeaders.join(" | "),
);
const currentTuesdayColumn = await weekColumnText(currentTuesday);
check(
  "a semana padrao traz a ocorrencia materializada da terca",
  (currentTuesdayColumn ?? "").includes("Intenso"),
  currentTuesdayColumn ?? "(coluna vazia)",
);

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
  monthHrefs.length > 0 &&
    monthHrefs.every((href) => {
      const key = decodeURIComponent(href.split("ocorrencia=")[1] ?? "");
      return key.split("|")[1]?.startsWith(monthOfToday) ?? false;
    }),
  `${monthHrefs.length} ocorrencias em ${monthOfToday}`,
);

// CAL-02/CAL-08: a grade mensal comeca na segunda e cada coluna cai no dia
// certo (o bug do cabecalho Dom sobre a celula de segunda nao pode voltar).
const monthGrid = await page.evaluate(() => {
  const grid = document.querySelector("section div.grid-cols-7");
  if (!grid) return null;
  const children = [...grid.children];
  return {
    headers: children.slice(0, 7).map((cell) => cell.innerText.trim()),
    days: children.slice(7).map((cell) => cell.innerText.trim().split(/\s+/)[0]),
  };
});
const monthFirst = `${today.slice(0, 7)}-01`;
const gridStart = mondayOf(monthFirst);
const gridEnd = addDays(mondayOf(monthEnd(monthFirst)), 6);
const expectedGridDates = [];
for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
  expectedGridDates.push(date);
}
const monthAligned =
  monthGrid !== null &&
  monthGrid.headers.join("|") === MONTH_LABELS.join("|") &&
  monthGrid.days.length === expectedGridDates.length &&
  expectedGridDates.every(
    (date, index) =>
      Number(monthGrid.days[index]) === Number(date.slice(8, 10)) &&
      monthGrid.headers[index % 7] === weekdayLabel(date),
  );
check(
  "a grade mensal alinha cada coluna com o dia da semana (segunda a domingo)",
  monthAligned,
  monthGrid
    ? `${monthGrid.headers.join(",")} / ${monthGrid.days.length} dias desde ${gridStart}`
    : "grade ausente",
);

await page.getByRole("tab", { name: "Diária" }).click();
await page.waitForURL("**/grade?*view=dia*", { timeout: 20000 });
await page.waitForTimeout(400);
const dayHrefs = await page
  .locator('section a[href*="ocorrencia="]')
  .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
const dayTitle = await body();
check(
  "a aba Diaria mostra so o dia selecionado",
  urlParam("view") === "dia" &&
    dayTitle.includes(`${formatBR(today)} a ${formatBR(today)}`) &&
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
await page.getByRole("link", { name: "Período anterior" }).click();
await page.waitForTimeout(500);
const weekBack = urlParam("data");
check(
  "a seta da vista Semanal volta uma semana",
  weekBack === addDays(weekNext, -7),
  `${weekNext} -> ${weekBack}`,
);

await page.getByRole("tab", { name: "Mensal" }).click();
await page.waitForURL("**/grade?*view=mes*", { timeout: 20000 });
await page.waitForTimeout(400);
const monthBefore = urlParam("data");
const expectedMonthNext = addMonths(monthBefore, 1);
await Promise.all([
  page.waitForURL(`**/grade?*data=${expectedMonthNext}*`, { timeout: 20000 }),
  page.getByRole("link", { name: "Próximo período" }).click(),
]);
await page.waitForTimeout(400);
const monthNext = urlParam("data");
check(
  "a seta da vista Mensal anda um mes",
  monthNext === expectedMonthNext,
  `${monthBefore} -> ${monthNext}`,
);
const expectedMonthBack = addMonths(monthNext, -1);
await Promise.all([
  page.waitForURL(`**/grade?*data=${expectedMonthBack}*`, { timeout: 20000 }),
  page.getByRole("link", { name: "Período anterior" }).click(),
]);
await page.waitForTimeout(400);
check(
  "a seta da vista Mensal volta um mes",
  urlParam("data") === expectedMonthBack,
  `${monthNext} -> ${urlParam("data")}`,
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

// CAL-01/CAL-05: uma ocorrencia concreta (terca de D+14) com horario,
// modalidade, fixos, reposicoes, experimentais e vagas iguais ao banco.
const tuesdayFacts = occurrenceFacts(tuesdaySlot, tueOfD14);
const tuesdaySlotButton = page.locator('button[aria-label^="Terça, 19h"]').first();
const tuesdayLabel = await tuesdaySlotButton.getAttribute("aria-label");
const tuesdayDots = await tuesdaySlotButton.evaluate((element) =>
  [...element.querySelectorAll(".dot")].reduce((acc, dot) => {
    const kind = [...dot.classList].find((name) => name !== "dot");
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {}),
);
check(
  "a ocorrencia concreta mostra horario, modalidade, vinculos e vagas do banco",
  (tuesdayLabel ?? "").includes(hourLabel(tuesdayFacts.startTime)) &&
    (tuesdayLabel ?? "").includes(tuesdayFacts.className) &&
    (tuesdayLabel ?? "").includes(
      `${tuesdayFacts.spots} vagas livres de ${tuesdayFacts.capacity}`,
    ) &&
    tuesdayDots.fixo === tuesdayFacts.fixed &&
    tuesdayDots.rep === tuesdayFacts.makeup &&
    tuesdayDots.exp === tuesdayFacts.experimental &&
    tuesdayDots.livre === tuesdayFacts.spots,
  `${tuesdayLabel} | fixos ${tuesdayDots.fixo}/${tuesdayFacts.fixed}, reposicoes ${tuesdayDots.rep}/${tuesdayFacts.makeup}, experimentais ${tuesdayDots.exp}/${tuesdayFacts.experimental}, vagas ${tuesdayDots.livre}/${tuesdayFacts.spots}`,
);

// ---------- P1: participantes da ocorrencia (CAL-10, CAL-11) ----------
await page.goto(
  `${BASE}/grade?view=semana&data=${d14}&ocorrencia=${tuesdaySlot}|${tueOfD14}`,
  { waitUntil: "load" },
);
await page.waitForSelector("aside", { timeout: 30000 });
await page.waitForTimeout(500);
const panel = page.locator("aside");
// O painel quebra linha entre o numero de vagas e o rotulo; a comparacao usa
// o mesmo espaco normalizado que o corpo da pagina.
const panelText = (await panel.innerText()).replace(/\s+/g, " ");
check(
  "o painel lista os tres vinculos",
  /Fixo/.test(panelText) && /Reposição/.test(panelText) && /Experimental/.test(panelText),
);
const fixoLinks = await panel.locator('a[href^="/alunos/"]').count();
check("os fixos da ocorrencia abrem o cadastro do aluno", fixoLinks > 0, `${fixoLinks} links`);
check(
  "a composicao da ocorrencia soma os vinculos do painel",
  panelText.includes(`Fixo · ${tuesdayFacts.fixed}`) &&
    panelText.includes(`Reposição · ${tuesdayFacts.makeup}`) &&
    panelText.includes(`Experimental · ${tuesdayFacts.experimental}`) &&
    panelText.includes(
      `${tuesdayFacts.spots} ${tuesdayFacts.spots === 1 ? "vaga livre" : "vagas livres"}`,
    ),
  `painel x banco: fixos ${tuesdayFacts.fixed}, reposicoes ${tuesdayFacts.makeup}, experimentais ${tuesdayFacts.experimental}, vagas ${tuesdayFacts.spots}`,
);
const experimentalItem = panel.locator("li", { hasText: "Walk Calendario Visitante" });
check(
  "a experimental aprovada sem aluno nao tem link de cadastro",
  (await experimentalItem.count()) === 1 &&
    (await experimentalItem.locator('a[href^="/alunos/"]').count()) === 0,
);
await shot("admin-calendario-painel");

const alunoHref = await panel.locator('a[href^="/alunos/"]').first().getAttribute("href");
await panel.locator('a[href^="/alunos/"]').first().click();
await page.waitForURL("**/alunos/**", { timeout: 30000 });
check("clicar num participante abre o cadastro", page.url().includes(alunoHref), page.url());

// A reposicao e de uma aluna fora do fixo da turma: o grupo Reposição aparece
// e o link dela tambem leva ao cadastro (CAL-11).
check(
  "a reposicao e de uma aluna fora do fixo da turma",
  sql(
    `SELECT count(*) FROM fixed_enrollments WHERE class_slot_id = '${tuesdaySlot}' AND student_id = '${makeupStudent}' AND status = 'ATIVA'`,
  ) === "0",
  `aluna ${makeupStudent}`,
);
await page.goto(
  `${BASE}/grade?view=semana&data=${d14}&ocorrencia=${tuesdaySlot}|${tueOfD14}`,
  { waitUntil: "load" },
);
await page.waitForSelector("aside", { timeout: 30000 });
await page.waitForTimeout(500);
const makeupPanel = page.locator("aside");
const makeupLink = makeupPanel
  .locator("li", { hasText: "Walk Calendario 5" })
  .locator('a[href^="/alunos/"]');
check(
  "a reposicao tem link para o cadastro",
  (await makeupLink.count()) === 1,
  `${await makeupLink.count()} links`,
);
await makeupLink.click();
await page.waitForURL("**/alunos/**", { timeout: 30000 });
check(
  "clicar na reposicao abre o cadastro",
  page.url().includes(`/alunos/${makeupStudent}`),
  page.url(),
);

// ---------- P1: selos de bloqueio por feriado e recesso (CAL-07) ----------
// O feriado e o recesso sao cadastrados pela tela do admin: o reconcile marca
// as ocorrencias e as tres vistas mostram o selo.
await page.goto(`${BASE}/feriados`, { waitUntil: "load" });
await page.waitForSelector("#feriado-data", { timeout: 30000 });
await page.fill("#feriado-data", wednesday);
await page.fill("#feriado-nome", "Walk Calendario feriado");
await page.locator('form:has(#feriado-data) button[type="submit"]').click();
await page.waitForSelector(".toast", { timeout: 30000 });
check("o feriado cadastrado bloqueia a data", (await body()).includes("Feriado cadastrado"));

await page.fill("#recesso-inicio", closureDate);
await page.fill("#recesso-fim", closureDate);
await page.fill("#recesso-motivo", "Walk Calendario recesso");
await page.locator('form:has(#recesso-inicio) button[type="submit"]').click();
await page.waitForFunction(
  () => document.body.innerText.includes("Recesso cadastrado"),
  undefined,
  { timeout: 30000 },
);
check(
  "o recesso cadastrado bloqueia a data",
  (await body()).includes("Recesso cadastrado"),
  `${closureDate}`,
);

// Feriado (quarta 18/11) nas tres vistas.
await page.goto(`${BASE}/grade?view=dia&data=${wednesday}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "o feriado bloqueia a ocorrencia na vista diaria",
  /bloqueada/i.test((await occurrenceCellText(wednesday)) ?? ""),
  (await occurrenceCellText(wednesday)) ?? "",
);
await page.goto(`${BASE}/grade?view=semana&data=${wednesday}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.waitForTimeout(400);
check(
  "o feriado bloqueia a ocorrencia na vista semanal",
  ((await weekColumnText(wednesday)) ?? "").includes("Bloqueada"),
  (await weekColumnText(wednesday)) ?? "",
);
await shot("admin-calendario-semana");
await page.goto(`${BASE}/grade?view=mes&data=${wednesday}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "o feriado bloqueia a ocorrencia na vista mensal",
  /bloqueada/i.test((await occurrenceCellText(wednesday)) ?? ""),
  (await occurrenceCellText(wednesday)) ?? "",
);

// Recesso (quarta 02/12) nas tres vistas.
await page.goto(`${BASE}/grade?view=dia&data=${closureDate}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "o recesso bloqueia a ocorrencia na vista diaria",
  /bloqueada/i.test((await occurrenceCellText(closureDate)) ?? ""),
  (await occurrenceCellText(closureDate)) ?? "",
);
await page.goto(`${BASE}/grade?view=semana&data=${closureMonday}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.waitForTimeout(400);
check(
  "o recesso bloqueia a ocorrencia na vista semanal",
  ((await weekColumnText(closureDate)) ?? "").includes("Bloqueada"),
  (await weekColumnText(closureDate)) ?? "",
);
await page.goto(`${BASE}/grade?view=mes&data=${closureDate}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "o recesso bloqueia a ocorrencia na vista mensal",
  /bloqueada/i.test((await occurrenceCellText(closureDate)) ?? ""),
  (await occurrenceCellText(closureDate)) ?? "",
);

// ---------- P1: cancelar pelo estudio em D+14 (CAL-12, CAL-16) ----------
await page.goto(
  `${BASE}/grade?view=semana&data=${d14}&ocorrencia=${tuesdaySlot}|${tueOfD14}`,
  { waitUntil: "load" },
);
await page.waitForSelector("aside", { timeout: 30000 });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Cancelar aula" }).click();
await page.waitForSelector(".toast", { timeout: 30000 });
const cancelToast = (await page.locator(".toast").first().innerText()).replace(/\s+/g, " ");
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
  WHERE st.name = 'Walk Calendario 5'
    AND b.class_session_id = '${tuesdaySession}'
    AND b.booking_type = 'MAKEUP'
`);
const returnedCredit = sql(`SELECT status FROM credits WHERE id = '${tuesdayCredit}'`);
const studioCredits = Number(sql(`
  SELECT count(*) FROM credits
  WHERE source = 'CANCELAMENTO_ESTUDIO' AND source_session_id = '${tuesdaySession}'
`));
check("a ocorrencia fica CANCELADA", sessionStatus === "CANCELADA", sessionStatus);
check(
  "a reserva ativa e cancelada pelo estudio",
  bookingState === "CANCELADA/ESTUDIO",
  bookingState,
);
check("o credito reservado da reposicao volta a DISPONIVEL", returnedCredit === "DISPONIVEL", returnedCredit);
check(
  "um credito de estudio por fixo afetado",
  studioCredits === tuesdayFacts.fixed,
  `${studioCredits} creditos para ${tuesdayFacts.fixed} fixos`,
);

// CAL-16: os quatro numeros da mensagem batem com o estado real da ocorrencia.
const cancelNumbers = cancelToast.match(
  /Ocorrência cancelada: (\d+)\. Reservas canceladas: (\d+)\. Créditos devolvidos: (\d+)\. Créditos gerados: (\d+)\./,
);
const dbNumbers = {
  session: Number(
    sql(
      `SELECT count(*) FROM class_sessions WHERE id = '${tuesdaySession}' AND status = 'CANCELADA'`,
    ),
  ),
  bookings: Number(
    sql(`
      SELECT count(*) FROM bookings
      WHERE class_session_id = '${tuesdaySession}'
        AND status = 'CANCELADA' AND cancelled_by = 'ESTUDIO'
    `),
  ),
  returned: Number(
    sql(`
      SELECT count(*) FROM credit_transactions
      WHERE action = 'DEVOLUCAO' AND credit_id = '${tuesdayCredit}'
    `),
  ),
  granted: Number(
    sql(`
      SELECT count(*) FROM credits
      WHERE source = 'CANCELAMENTO_ESTUDIO' AND source_session_id = '${tuesdaySession}'
    `),
  ),
};
check(
  "os quatro contadores do cancelamento batem com o banco",
  cancelNumbers !== null &&
    Number(cancelNumbers[1]) === dbNumbers.session &&
    Number(cancelNumbers[2]) === dbNumbers.bookings &&
    Number(cancelNumbers[3]) === dbNumbers.returned &&
    Number(cancelNumbers[4]) === dbNumbers.granted,
  cancelNumbers
    ? `tela ${cancelNumbers.slice(1).join("/")} x banco ${dbNumbers.session}/${dbNumbers.bookings}/${dbNumbers.returned}/${dbNumbers.granted}`
    : cancelToast,
);

// CAL-08: a ocorrencia cancelada aparece com selo nas tres vistas.
await page.goto(`${BASE}/grade?view=dia&data=${tueOfD14}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "a ocorrencia cancelada aparece com selo na vista diaria",
  /cancelada/i.test((await occurrenceCellText(tueOfD14)) ?? ""),
  (await occurrenceCellText(tueOfD14)) ?? "",
);
await page.goto(`${BASE}/grade?view=semana&data=${d14}`, { waitUntil: "load" });
await page.waitForSelector('button[aria-label*="vagas livres de"]', { timeout: 30000 });
await page.waitForTimeout(400);
check(
  "a ocorrencia cancelada aparece com selo na vista semanal",
  ((await weekColumnText(tueOfD14)) ?? "").includes("Cancelada"),
  (await weekColumnText(tueOfD14)) ?? "",
);
await page.goto(`${BASE}/grade?view=mes&data=${d14}`, { waitUntil: "load" });
await page.waitForTimeout(600);
check(
  "a ocorrencia cancelada aparece com selo na vista mensal",
  /cancelada/i.test((await occurrenceCellText(tueOfD14)) ?? ""),
  (await occurrenceCellText(tueOfD14)) ?? "",
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

// ---------- CAL-06: passado nunca materializado some das tres vistas ----------
check(
  "a data passada do teste nao tem sessao materializada",
  sql(`SELECT count(*) FROM class_sessions WHERE session_date = '${pastTuesday}'`) === "0",
  pastTuesday,
);
await page.goto(`${BASE}/grade?view=dia&data=${pastTuesday}`, { waitUntil: "load" });
await page.waitForTimeout(600);
const pastDayBody = await body();
const pastDayDates = await occurrenceDatesOnPage();
check(
  "a vista diaria omite a ocorrencia passada nunca materializada",
  pastDayBody.includes("Nenhuma ocorrência nesta data.") && pastDayDates.length === 0,
  `${pastDayDates.length} ocorrencias em ${pastTuesday}`,
);
await page.goto(`${BASE}/grade?view=semana&data=${pastTuesday}`, { waitUntil: "load" });
await page.waitForTimeout(600);
const pastWeekColumn = await weekColumnText(pastTuesday);
check(
  "a vista semanal omite a ocorrencia passada nunca materializada",
  (pastWeekColumn ?? "") === "",
  `coluna de ${pastTuesday}: '${pastWeekColumn ?? ""}'`,
);
await page.goto(`${BASE}/grade?view=mes&data=${pastTuesday}`, { waitUntil: "load" });
await page.waitForTimeout(600);
const pastMonthDates = await occurrenceDatesOnPage();
check(
  "a vista mensal omite a ocorrencia passada nunca materializada",
  !pastMonthDates.includes(pastTuesday),
  `${pastMonthDates.length} ocorrencias em ${pastTuesday.slice(0, 7)}`,
);

// ---------- P3: voltar para hoje das tres abas (CAL-22) ----------
for (const [view, label, farDate] of [
  ["dia", "Diaria", addDays(today, -20)],
  ["semana", "Semanal", addDays(today, 35)],
  ["mes", "Mensal", addMonths(today, 2)],
]) {
  await page.goto(`${BASE}/grade?view=${view}&data=${farDate}`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.getByRole("link", { name: "Hoje" }).click();
  await page.waitForTimeout(700);
  let windowOk = false;
  let windowDetail = urlParam("data") ?? "";
  if (view === "dia") {
    windowOk = (await body()).includes(`${formatBR(today)} a ${formatBR(today)}`);
  } else if (view === "semana") {
    const headers = await weekHeaders();
    windowOk =
      headers.length === 7 &&
      headers[0] === `${weekdayLabel(monday)} ${dayLabel(monday)}` &&
      headers[6] === `${weekdayLabel(addDays(monday, 6))} ${dayLabel(addDays(monday, 6))}`;
    windowDetail = headers.join(" | ");
  } else {
    const text = await body();
    windowOk =
      text.includes(formatBR(monthFirst)) &&
      text.includes(formatBR(monthEnd(monthFirst)));
    windowDetail = `${monthFirst} a ${monthEnd(monthFirst)}`;
  }
  check(
    `a acao Hoje na aba ${label} renderiza a janela de hoje`,
    urlParam("view") === view && urlParam("data") === today && windowOk,
    `${urlParam("view")} ${windowDetail}`,
  );
}

// ---------- CAL-09: a composicao do guia sem estourar a largura ----------
for (const [view, label] of [
  ["semana", "Semanal"],
  ["dia", "Diária"],
  ["mes", "Mensal"],
]) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/grade?view=${view}&data=${tueOfD14}`, { waitUntil: "load" });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const marks = await page.evaluate(() => {
    const container = document.querySelector("main > div, main > section");
    const style = container ? getComputedStyle(container) : null;
    return {
      ducks: document.querySelectorAll(".vagas.sm .dot").length,
      borders: style
        ? [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ]
        : [],
    };
  });
  check(
    `a vista ${label} mantem patinhos e bordas 2px em 1280px`,
    overflow <= 1 &&
      marks.ducks > 0 &&
      marks.borders.length === 4 &&
      marks.borders.every((width) => width === "2px"),
    `overflow=${overflow}px patinhos=${marks.ducks} bordas=${marks.borders.join("/")}`,
  );
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

// ---------- Cenario devolvido ao estado que as capturas mostram ----------
// O cancelamento da historia consumiu a ocorrencia de terca da semana de D+14:
// o estado final (CANCELADA, com a composicao consumida) fica provado no log
// e no banco, mas a tela volta a ter a composicao para o juiz de telas e para
// a pessoa que quiser abrir o mesmo estado.
sql(`
  DELETE FROM credit_transactions WHERE credit_id IN (
    SELECT id FROM credits
    WHERE admin_label = 'Walk Calendario'
       OR source_session_id = '${tuesdaySession}'
  );
  DELETE FROM credits
    WHERE admin_label = 'Walk Calendario'
       OR source_session_id = '${tuesdaySession}';
  DELETE FROM bookings
    WHERE class_session_id = '${tuesdaySession}'
      AND student_id IN (SELECT id FROM students WHERE name LIKE 'Walk Calendario%');
  UPDATE class_sessions SET status = 'AGENDADA' WHERE id = '${tuesdaySession}';
  UPDATE experimentals SET status = 'APROVADA'
    WHERE class_session_id = '${tuesdaySession}' AND name LIKE 'Walk Calendario%';
`);
seedMakeup(tuesdaySlot, tueOfD14, "Walk Calendario 5");

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} asserts do walk passaram`);
if (failed.length > 0) {
  console.log("Falhas:", failed.map((f) => f.name).join("; "));
  process.exitCode = 1;
}
