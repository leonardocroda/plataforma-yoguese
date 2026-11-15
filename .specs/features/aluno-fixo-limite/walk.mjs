import pw from "file:///C:/Users/leona/.local/share/opencode/worktree/15f1b9/spec-aluno-fixo/node_modules/playwright-core/index.js";
import pgPkg from "file:///C:/Users/leona/.local/share/opencode/worktree/15f1b9/spec-aluno-fixo/node_modules/pg/lib/index.js";
const { chromium } = pw;
const pg = pgPkg.default ?? pgPkg;

const BASE = "http://localhost:3002";
const STUDIO_TZ = "America/Sao_Paulo";

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${extra}`}`);
}

function studioToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ }).format(
    new Date(),
  );
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Proxima data com o dia da semana dado (1 = domingo) a partir de `from`.
function nextOccurrence(weekday, from) {
  const d = new Date(`${from}T12:00:00Z`);
  for (let i = 0; i < 8; i++) {
    if (d.getUTCDay() === weekday) return d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  throw new Error("unreachable");
}

const db = new pg.Client({
  connectionString: "postgres://test:test@localhost:55433/test",
});
await db.connect();

const today = studioToday();
// terca=3? Nao: getUTCDay 1=domingo... nosso weekday do app: 1=Domingo..7=Sabado
// (WEEKDAY_LABELS[weekday-1]); getUTCDay: 0=domingo. Mapa:
const weekdayFor = (appWeekday) => appWeekday - 1; // app 1(Dom)..7(Sab) -> utc 0..6
const mondayDate = nextOccurrence(weekdayFor(2), today); // app 2 = Segunda
const fridayDate = nextOccurrence(weekdayFor(6), today); // app 6 = Sexta
const saturdayDate = nextOccurrence(weekdayFor(7), today); // app 7 = Sabado

// ---------- cleanup de rodadas anteriores ----------
const cleanupTypeId = (await db.query("select id from class_types order by name limit 1")).rows[0].id;
await db.query("delete from fixed_enrollments where class_slot_id in (select id from class_slots where class_type_id = $1)", [cleanupTypeId]);
await db.query("delete from class_sessions where class_slot_id in (select id from class_slots where class_type_id = $1)", [cleanupTypeId]);
await db.query("delete from class_slots where class_type_id = $1", [cleanupTypeId]);
await db.query("update students set plan_id = null where plan_id in (select id from plans where name = 'Plano Walk 2x')");
await db.query("delete from plans where name = 'Plano Walk 2x'");

// ---------- setup de dados (fixture do walk) ----------
const { rows: typeRows } = await db.query(
  "select id, name from class_types order by name limit 1",
);
const classTypeId = typeRows[0].id;
const typeName = typeRows[0].name;

const { rows: planRows } = await db.query(
  "insert into plans (name, price, weekly_frequency, status) values ('Plano Walk 2x', '150.00', 2, 'ATIVO') returning id",
);
const planId = planRows[0].id;

const { rows: studentRows } = await db.query(
  "update students set plan_id = $1 where email = 'aluno.teste.1@yoguese.com' returning id",
  [planId],
);
const studentId = studentRows[0].id;

async function createSlot(weekday, start) {
  const { rows } = await db.query(
    "insert into class_slots (class_type_id, weekday, start_time, end_time, capacity, status) values ($1, $2, $3, '20:00', 8, 'ATIVA') returning id",
    [classTypeId, weekday, start],
  );
  return rows[0].id;
}
const mondaySlot = await createSlot(2, "19:00");
const fridaySlot = await createSlot(6, "19:00");
const saturdaySlot = await createSlot(7, "19:00");

for (const slotId of [mondaySlot, fridaySlot]) {
  // startDate = hoje: o encerramento por hoje (FIX-04) sai da lista na hora
  await db.query(
    "insert into fixed_enrollments (student_id, class_slot_id, start_date, status) values ($1, $2, $3, 'ATIVA')",
    [studentId, slotId, today],
  );
}

console.log(
  `setup ok: today=${today} monday=${mondayDate} friday=${fridayDate} saturday=${saturdayDate} type=${typeName}`,
);

// ---------- browser ----------
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch({ channel: "msedge" });
}
const pageErrors = [];
const page = await browser.newPage();
page.on("pageerror", (error) => pageErrors.push(String(error)));

// login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "admin@yoguese.com");
await page.fill('input[name="password"]', "walk-fixo-2026");
await page.click('button[type="submit"]');
await page.waitForURL(/grade/, { timeout: 20000 });
check("login do admin alcaca a /grade", page.url().includes("/grade"));

// PLIM-02 pela grade: tentar o 3o vinculo de um plano 2x
await page.goto(
  `${BASE}/grade?view=semana&data=${saturdayDate}&ocorrencia=${saturdaySlot}%7C${saturdayDate}`,
  { waitUntil: "networkidle" },
);
await page.selectOption("#grade-fixo", { label: "Aluno Teste 1" });
await page.click("text=Vincular fixo");
const refusal = await page
  .waitForSelector("text=Plano Walk 2x 2x/semana: a aluna ja esta fixa em 2 turmas", {
    timeout: 15000,
  })
  .then(() => true)
  .catch(() => false);
check(
  "PLIM-02 na grade: 3o vinculo recusado nomeando plano e contagem",
  refusal,
);

// FIX-01/FIX-04: detalhe da aluna com os 2 fixos ativos
await page.goto(`${BASE}/alunos`, { waitUntil: "networkidle" });
await page.click(`a[href="/alunos/${studentId}"]`);
await page.waitForURL(/alunos\/.+/, { timeout: 20000 });
await page.waitForSelector("text=Horários fixos ativos", { timeout: 20000 });
let items = await page.locator("section:has(h2:text('Horários fixos ativos')) li").count();
check("detalhe lista os 2 vinculos ativos com o formulario", items === 2, `count=${items}`);

const section = page.locator("section:has(h2:text('Horários fixos ativos'))");
const dateDefault = await section
  .locator("li")
  .first()
  .locator("input[type=date]")
  .inputValue();
check("data de encerramento pre-preenchida com hoje", dateDefault === today, `value=${dateDefault}`);

// FIX-03 pela tela: data anterior ao inicio (ontem < startDate de hoje) recusa
await section
  .locator("li")
  .first()
  .locator("input[type=date]")
  .fill(addDays(today, -1));
await section.locator("li").first().locator('button:text("Encerrar")').click();
const errorShown = await section
  .locator('[role="alert"]')
  .waitFor({ timeout: 15000 })
  .then(() => true)
  .catch(() => false);
const errorText = errorShown
  ? await section.locator('[role="alert"]').textContent()
  : "";
check(
  "FIX-03 na tela: data anterior ao inicio recusa com erro visivel",
  errorShown && errorText.includes("anterior"),
  errorText,
);

// FIX-01: encerrar o primeiro vinculo em hoje (a borda aceita)
await section
  .locator("li")
  .first()
  .locator("input[type=date]")
  .fill(today);
await section.locator("li").first().locator('button:text("Encerrar")').click();
const toastShown = await page
  .waitForSelector("text=Horário fixo encerrado a partir de " + today, {
    timeout: 15000,
  })
  .then(() => true)
  .catch(() => false);
check("FIX-01 na tela: feedback cita o encerramento com a data", toastShown);

// FIX-04: a lista recarrega sem o vinculo encerrado
let reloaded = false;
for (let i = 0; i < 60 && !reloaded; i++) {
  const n = await page
    .locator("section:has(h2:text('Horários fixos ativos')) li")
    .count();
  reloaded = n === 1;
  if (!reloaded) await new Promise((r) => setTimeout(r, 500));
}
items = await page.locator("section:has(h2:text('Horários fixos ativos')) li").count();
check("FIX-04 na tela: a lista recarrega sem o vinculo encerrado", reloaded && items === 1);

const { rows: endedRows } = await db.query(
  "select end_date from fixed_enrollments where class_slot_id = $1",
  [mondaySlot],
);
const endedIso = endedRows[0]?.end_date
  ? new Date(endedRows[0].end_date).toISOString().slice(0, 10)
  : null;
check(
  "FIX-01 no banco: endDate gravada com a data enviada",
  endedIso === today,
  JSON.stringify(endedRows),
);

// FIX-02 pela tela: a segunda (slot encerrado) volta a mostrar 8 vagas livres
await page.goto(
  `${BASE}/grade?view=semana&data=${mondayDate}&ocorrencia=${mondaySlot}%7C${mondayDate}`,
  { waitUntil: "networkidle" },
);
const mondayLabel = await page
  .locator(`button[aria-label*="${typeName}"]`)
  .first()
  .getAttribute("aria-label");
check(
  "FIX-02 na tela: a vaga da turma volta (8 vagas livres de 8)",
  mondayLabel?.includes("8 vagas livres de 8"),
  mondayLabel ?? "sem label",
);

check("nenhum pageerror no walk", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
await db.end();

const failed = results.filter((r) => !r.ok);
console.log(`\nWALK: ${results.length - failed.length}/${results.length} asserts`);
process.exit(failed.length > 0 ? 1 : 0);
