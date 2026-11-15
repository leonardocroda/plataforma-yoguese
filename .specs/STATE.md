# STATE.md - Yogue-se Yoga Platform

Project memory: Decisions log (AD-NNN) + Handoff snapshot.
Source document (binding): `PRD.md.txt` - SRS Yogue-se V1.0.

## Decisions

### AD-001 - ACTIVE - Stack: Next.js + TypeScript (2026-11-06)

User chose Next.js + TypeScript + Postgres. Single full-stack app; rules
server-side (server actions / route handlers), layer thin at the route.

### AD-002 - ACTIVE - Database: managed Postgres + Drizzle (2026-11-06)

Supabase or Neon managed Postgres, Drizzle ORM with versioned migrations.
The 14 PRD entities fit relational; reservations need transactional
integrity.

### AD-003 - ACTIVE - Test runner: Vitest (2026-11-06)

Acceptance tests from PRD section 15 (e.g. "cancelamento com 23h59 nao gera
credito") become real Vitest tests. Domain rules tested as pure functions;
transaction tests run against a real test Postgres.

### AD-004 - ACTIVE - Architecture: modular monolith (2026-11-06)

One Next.js app, no separate backend, no monorepo. Domain rules live in
`src/modules/<modulo>/` (domain pure functions, services, server actions,
components); `src/app/` holds only routing (route groups: `(site)`,
`(admin)`, `(aluno)`) and no business rule; cross-module access only through
a module's service interface. Rationale: one database, small load, future
extraction path; PRD itself requires "arquitetura modular, permitindo
expansao sem reconstruir".

### AD-005 - ACTIVE - Profiles: admin and student only (2026-11-06)

Teacher uses the admin profile; students never see other students' data.

### AD-006 - ACTIVE - First admin and student access (2026-11-06)

First admin created by controlled seed at deploy. New student access:
admin registers the account, sends credential via WhatsApp, student sets
password on first login. No email integration in v1.

### AD-007 - ACTIVE - Credit expiry computed on read (2026-11-06)

No cron. Any read/booking consults `expires_at` server-side; the `status`
column becomes an audible cache, not the source of truth. Reinforces PRD
rule "processado no servidor, nunca no navegador".

### AD-008 - ACTIVE - Core slot model: on-demand sessions + derived counts (2026-11-06)

User confirmed. `CLASS_SESSIONS` are materialized on demand (get-or-create)
when a read/booking touches (slot, date). Fixed students are counted from
active `FIXED_ENROLLMENTS` covering the date, NOT materialized as
`BOOKINGS` per future occurrence. Composition and vacancies are derived:
fixed count + active bookings by type vs `capacity`. A `BOOKING` (FIXED)
is created only when a specific occurrence needs it (future: "avisar nao
comparecimento"). Rationale: changing a fixed schedule becomes one row
change, not a sweep over future bookings; PRD behaviour (fixed
recurrences automatically occupy slots) is preserved.

### AD-009 - ACTIVE - Implementation order (2026-11-06)

Features follow PRD section 16. First feature: core turmas + sessoes +
reservas (operational foundation). Then credits/cancellations (PRD marks
this module priority), holidays/closures, experimentals, admin panel,
student area, institutional site, Pato Yoga Club.

### AD-010 - ACTIVE - Manual booking does not validate credits in the core slice (2026-11-06)

User confirmed in discussion: the core slice's manual booking (PRD 4.6)
accepts FIXED/MAKEUP/EXPERIMENTAL types without type-specific rules.
Credit validation ("nao permitir agendamento sem credito valido", PRD 6.4)
lands in the credits feature.

### AD-011 - ACTIVE - Multiple classes in the same day require admin marking (2026-11-06)

User correction to a spec assumption: a student may attend N classes on
the same day, but only the admin marks the second and later ones. In
self-service the student books at most one class per day - even with an
available credit ("mesmo tendo credito, o aluno nao podera marcar mais de
uma aula no mesmo dia"). The admin-side allowance is a core-slice
criterion (admin may book the same student twice on a date); the student
self-service limit is enforced when the student-area booking lands.

### AD-012 - ACTIVE - Code identifiers in English (2026-11-06)

User instruction mid-build: variables, functions, types and file names in
the codebase are written in English ("voce ta dando varios nomes de
variavel em portugues, precisa traduzir pra ingles isso ai"). Portuguese
stays where the user-facing product lives: UI copy, seed data (student
names, class modality labels), commit-scoped docs and spec prose. Applies
retroactively via a normalization pass after the current batch returns,
and is mandatory for Batch C onward.

### AD-013 - ACTIVE - Editing a slot weekday/time cancels its future old occurrences (2026-11-07)

User decision after the Verifier's finding: when the admin edits a class
slot's weekday or time, the slot's future occurrences under the OLD
schedule are set to CANCELADA and their bookings are cancelled (spot
released), preserving the history. No credit is generated - the credits
module does not exist yet; in that feature the same situation must become
an automatic credit.

### AD-014 - ACTIVE - Public agenda omits blocked and inactive occurrences (2026-11-07)

User decision after the Verifier's finding: the public agenda does not
publish occurrences blocked by a holiday or closure, nor slots or class
types that are inactive. The admin grade still shows them, marked as
BLOQUEADA.

### AD-015 - ACTIVE - Local development database: docker compose + db scripts (2026-11-07)

The local database is Postgres in docker compose (`docker compose up -d`,
container `yoguese-db`, port 55432, volume `yoguese-pgdata`). The connection
string lives in `.env.local` (copied from `.env.example`; the git ignores it).
The `db:migrate` and `db:seed` scripts run on plain node, so they read that
file themselves through `src/db/env.ts` - Next.js only loads it inside the app
runtime. The seed writes the two PRD class types and the four test students
and is idempotent. Integration tests do not use this database: Testcontainers
brings its own Postgres, so the local one can stay up while the suite runs.

### AD-016 - ACTIVE - Credits feature scope: rules plus minimal admin UI (2026-11-07)

User decision: the credits feature delivers the server rules and a minimal
admin UI - a student credit screen (grant, return, cancel, transaction
history) and the studio class cancellation on the `/grade` screen. The
student buttons ("avisar nao comparecimento", "agendar reposicao", "meus
creditos") land with the student-area feature; the services they will call
are built and tested here.

### AD-017 - ACTIVE - One credit per cancelled occurrence on a slot day/time edit (2026-11-07)

AD-013 said the weekday/time edit cancels the future old occurrences and
that, in the credits module, the same situation must become an automatic
credit. User decision: each cancelled occurrence gives 1 credit to each
fixed student affected in it, source CANCELAMENTO_ESTUDIO. Eight cancelled
occurrences with four fixed students = 32 credits.

### AD-018 - ACTIVE - Credit consumption by schedule, no presence step (2026-11-07)

User decision: the credit of a booked makeup becomes UTILIZADO when the
class end time passes, with no manual presence marking. Rationale from the
user: a student who does not notify up to 24h in advance loses the credit,
so a rule by schedule is enough.

### AD-019 - ACTIVE - Admin manual makeup requires a credit and skips the weekly limit (2026-11-07)

AD-010 deferred credit validation to this feature. User decision: a manual
booking of type MAKEUP by the admin requires a valid DISPONIVEL credit and
reserves it, and the limit of two makeups per week applies only to the
student's self-service booking (same latitude as AD-011).

### AD-020 - ACTIVE - Studio cancellation returns the credit of a booked makeup (2026-11-07)

User decision: when the studio cancels an occurrence that has a booked
makeup, the reserved credit returns to DISPONIVEL keeping its original
expiry date.

### AD-021 - ACTIVE - Returning a credit keeps the original expiry date (2026-11-07)

User decision: the admin action "devolver credito" sets the status back to
DISPONIVEL without touching `expires_at`, and works from RESERVADO,
UTILIZADO or CANCELADO, recording the transaction (PRD 6.6, PRD 15).

### AD-022 - ACTIVE - Absence and cancellation live in the booking status (2026-11-07)

User decision: the history of absences and cancellations lives in the
booking status - FALTA for the absence registered by a late notice, CANCELADA
for the cancellation - with no new table. The per-occurrence record of a
fixed student's notice is a BOOKING row of type FIXED, exactly as AD-008
anticipated.

### AD-023 - ACTIVE - Admin registers the non-attendance notice on the student's behalf (2026-11-07)

User decision: with the student area out of scope, the admin registers the
"aviso de nao comparecimento" on behalf of the student; the 24h rule is
computed on the server at the moment of the registration.

### AD-024 - ACTIVE - Weekly makeup limit counts the week of the class date (2026-11-07)

User decision: the two-makeups-per-week limit (Monday to Sunday,
America/Sao_Paulo) counts the active MAKEUP bookings whose occurrence date
falls in the week of the occurrence being booked, not the week of the
request.

### AD-025 - ACTIVE - Studio credit even for a student who already notified absence (2026-11-07)

User decision: the studio cancellation gives a credit to every affected
fixed student, including one who had already notified absence with less
than 24h (no credit yet); a student who already holds a credit for that
occurrence does not get a second one.

### AD-026 - ACTIVE - Block registration cancels bookings and returns the reserved makeup credit (2026-11-10)

User decision: when a holiday or closure is registered, the active bookings
(makeup/experimental) of the covered occurrences are cancelled, the spots are
freed, and the reserved credit of a cancelled makeup returns to DISPONIVEL
keeping its original expiry. No new credit is created (PRD 7.1/7.2 stand).
Rationale: the AD-018 settlement turns a reserved credit UTILIZADO when the
occurrence end time passes without looking at the occurrence status - keeping
the booking active on a blocked occurrence would consume the student's credit
for a class that will not happen.

### AD-027 - ACTIVE - Unblock restores AGENDADA automatically; cancelled bookings are not restored (2026-11-10)

User decision: removing or editing the holiday/closure returns the covered
BLOQUEADA occurrences to AGENDADA automatically (today onward only; a
CANCELADA occurrence is never resurrected). The bookings cancelled by the
block are not restored - the student rebooks with the returned credit.

### AD-028 - ACTIVE - Overlapping blocks are allowed and never unified (2026-11-10)

User decision: a closure may overlap another closure or a holiday. A date
stays blocked while ANY block covers it and unblocks only when none does.

### AD-029 - ACTIVE - Blocks accept past dates with forward-only effect (2026-11-10)

User decision: a holiday or closure may be registered on a past date as a
historical record; the block effect only touches occurrences from today
onward, never rewriting the past of the grade.

### AD-030 - ACTIVE - No national-holiday seed; the admin registers them manually (2026-11-10)

User decision: Brazilian national holidays are registered by the admin
(PRD 7.1 grants the admin the registration); `db:seed` stays as is.

### AD-031 - ACTIVE - Studio cancellation is refused on a blocked occurrence (2026-11-10)

User decision: cancelling an occurrence already blocked by a holiday/closure
is refused with a clear error. The block already communicates the class does
not happen, and the cancellation would trigger studio credits (PRD 7.3),
which a holiday forbids (PRD 7.1).

### AD-032 - ACTIVE - Per-slot blocking is deferred to the admin panel feature (2026-11-10)

User decision: PRD 4.3 "bloquear horÃ¡rios" (blocking a specific class slot,
not a date) stays out of this feature and lands with the admin panel (AD-009
order). Today the equivalent effect is deactivating the slot in the grade.

### AD-033 - ACTIVE - Holidays and closures are removed physically, without the PRD-12 status column (2026-11-10)

User decision: PRD 12 lists a `status` column on HOLIDAYS and
STUDIO_CLOSURES, but no PRD rule uses it and the unblock path is the
removal/edit of the record itself (AD-027), so the tables keep no `status`
column and removal is a physical delete.

### AD-034 - ACTIVE - Admin base comes before experimentals (2026-11-11)

User reorder of AD-009 after the three core features closed: the next feature
is the admin base (login + logged-in admin area wiring the existing screens)
instead of experimentals. Rationale from the user: with the operational core
done, a logged-in admin frontend already makes much of the platform usable
("gostaria de ja ter um frontend uma area logada para os admins"); the (admin)
layout is a placeholder reading "auth em feature futura" and PRD section 16
places authentication, admin panel and registrations in FASE 1. Experimentals
(PRD modulo 8) follow the admin base.

### AD-035 - ACTIVE - Auth stack: own implementation, signed cookie session (2026-11-12)

Decision recorded during the admin-base design: credentials auth is implemented
in-repo - scrypt (node:crypto) password hashing and a stateless session cookie
signed with HMAC-SHA256 (`yoguese_session`, httpOnly, 7 days, secret from
AUTH_SECRET) - with no auth dependency. The guard lives in the (admin) layout
plus requireAdminSession() on every admin server action (a server action is a
reachable POST endpoint). Rationale: defaults approved in the spec (no heavy new
dependency, single admin in v1). Trade-off: no server-side revocation before
expiry in v1; revisiting when student accounts land. Scope: every authenticated
area from now on (admin today, student area later) reuses this pattern.

### AD-036 - ACTIVE - Experimental has its own table and approved ones occupy the vacancy (2026-11-12)

User decision: a public request lives in `EXPERIMENTALS` (PRD 12) with the
normalized phone, and an approved experimental counts as experimental occupancy
in the occurrence composition; no student row is created before conversion.
Rationale: the public form collects only name and phone while `STUDENTS`
requires e-mail and birth date; the separate table preserves attempts and
history, and composition stays the single source of the numbers (AD-008).

### AD-037 - ACTIVE - Conversion creates an active student with plan and fixed slots (2026-11-12)

User decision: "Converter em aluna" asks e-mail, birth date, plan and fixed
slot(s), checks vacancy, and creates an ATIVO student with fixed enrollments in
one transaction, keeping the experimental as CONVERTIDA. This departs from PRD
8.6 steps 1-2 (status "aguardando matricula" then send access): the student area
and login do not exist yet (AD-006, AD-034), so the intermediate state would
leave the student unusable. Revisit when the student area lands.

### AD-038 - ACTIVE - Duplicate experimental: everything except refused blocks, and blocked attempts are recorded (2026-11-12)

User decision: the phone is normalized before comparison; any prior request not
RECUSADA blocks a new one, while a request refused by the studio frees the
person. The blocked attempt is stored as DUPLICADA linked to the canonical
request so the admin can consult previous attempts (PRD 8.2). Concurrency is
settled by a partial unique index on the normalized phone for canonical rows.

### AD-039 - ACTIVE - Admin registers experimental cancellation and no-show with the 24h rule (2026-11-12)

User decision: the admin registers on the visitor's behalf (AD-023). With 24h
or more before the start the experimental becomes CANCELADA_COM_DIREITO and the
same record may be rescheduled, with the previous occurrence recorded; less
than 24h and no-show end the right. No-show only after the start; cancellation
only before it. Studio cancellation, a holiday/closure block, or a slot
weekday/time edit keeps the right and frees the spot (AD-026/AD-027).

### AD-040 - ACTIVE - The public form chooses a concrete occurrence with vacancy (2026-11-12)

User decision: the visitor picks date, time and modality from the active future
occurrences that still have a vacancy; the request stores that session. A
pending request never occupies, and approval rechecks the same vacancy (PRD
8.3). The experimental price stays R$ 45,00 with manual payment and no
automatic charge (PRD 8.4).

### AD-041 - ACTIVE - Brand: the studio guide supersedes the PRD palette (2026-11-12)

User decision: PRD section 14's "paleta sugerida" (off-white, bege, verde
sÃ¡lvia, tons terrosos) is superseded. The frontend of every existing screen
(home publica, /experimental, /login, admin) adopts the studio's own direction of
art, authored in `captures/yogue-se-brand.html` of feature `redesign-marca`:
papel #F3F2F1 with manchinhas texture, pena #FFFBF9 surfaces, preto #000 titles
and 2px borders, pÃªssego #FFC798 as the only real color, Outfit as the sole
font, mascot (pato.png) only in home/confirmation/empty/404, vacancies always as
8 ducks with the five states of the guide, and the guide voice/vocabulary in all
copy. Implementation lives as CSS custom properties in `globals.css` plus
components in `src/modules/ui/` over the existing Tailwind v4. PRD section 14
non-color requirements (responsive, mobile-first student area, clear feedback,
fast loading) stand unchanged. Rationale: the user built the guide ("montei um
html com toda a direÃ§Ã£o de arte e branding do site"), the PRD palette was
provisional and the result "ficou meio ruim". Trade-off: every reskinned screen
must be re-verified against the design, and the area do aluno inherits this
system when it lands. NOTA: AD-041 is numbered for the redesign worktree
(checkout 2026-11-12); the mainline agent may take the same number - renumber on
merge if both survive.

### AD-042 - ACTIVE - Approved departures from the binding brand guide (2026-11-12)

Bundle of the differences between `captures/yogue-se-brand.html` and the product,
each confirmed by the user during the redesign Specify ("Tudo que existe hoje",
delegated mechanics in `context.md` of feature `redesign-marca`): (1) home nav
drops "Metodo/Professora/Horarios/Contato" - the product has no such pages - and
keeps logo + "Entrar" + the experimental CTA; (2) the guide's three method cards
stay out, the home keeps the upcoming-classes list only; (3) the guide's student
area screen ("Oi, Marina", credits, fixed classes) is not built - the route does
not exist - and inherits this design system when the student-area feature lands;
(4) the admin week grid keeps the guide composition with real `/grade` data
instead of the mock times and names; (5) the voice table's example dates are
computed from the product's credit rules. Same numbering caveat as AD-041:
renumber on merge if the mainline agent took the number.

### AD-043 - ACTIVE - Small buttons keep the guide's look but grow to a 44px touch target (2026-11-13)

The guide's CSS gives `.btn.peq` 38px and `.btn-txt` 36px, while BRAND-05 -
approved in the spec of feature `redesign-marca` - asks every control for a
touch target of at least 44px. The product keeps the guide's shape, label and
underline and raises those two small variants to 44px; the primary `.btn` stays
at the guide's 48px. The difference is listed in the feature's `spec.md`
"Differences from the source". Same numbering caveat as AD-041: renumber on
merge if the mainline agent took the number.

### AD-044 - ACTIVE - Admin split: turmas and calendario are two features (2026-11-14)

User decision during the Specify of the candidate `admin-turmas-calendario`: the scope
splits into `admin-turmas` (medium: UI over the existing services of
`classes/actions.ts` + `classes/services/classes.ts`) implemented FIRST, and
`admin-calendario` (large: PRD 4.2 three views + free-time navigation + participants
+ studio cancellation) second. The calendar EVOLVES `/grade` (it already holds the
composition, participants, booking forms and the brand skin - AD-041/AD-042); class
management gets a new `/turmas` route in the admin shell. Navigation: tabs
diaria/semanal/mensal (weekly default, calendar week Mon-Sun America/Sao_Paulo),
prev/next arrows and a date picker (D+14 reachable). A CANCELADA occurrence stays
visible with a badge in all three views. Per-slot/date blocking (AD-032, PRD 4.3)
lands as P2 of `admin-calendario`.

### AD-046 - ACTIVE - Fixo exige plano; frequÃªncia do plano limita os vÃ­nculos fixos (2026-11-14)

User decision durante o Specify do candidato `aluno-fixo-limite`: sem plano a
aluna NÃƒO pode ser fixa (createEnrollment recusa), e uma aluna com plano de
N vezes por semana nÃ£o pode ter mais de N vÃ­nculos fixos ativos - a regra
vale na criaÃ§Ã£o pela grade, na conversÃ£o de experimental (AD-037) e recusa a
ediÃ§Ã£o que baixe a frequÃªncia ou limpe o plano com vÃ­nculos ativos. RemoÃ§Ã£o
de vÃ­nculo: pelo detalhe da aluna, encerrando em data (default hoje).
NOTE: numbered in the worktree `spec-aluno-fixo`; the mainline agent may take
the same number - renumber on merge if both survive (same caveat as AD-041).

### AD-045 - ACTIVE - Studio cancellation is refused on a past occurrence (2026-11-14)

User decision: with free-time navigation, `cancelOccurrenceByStudio` gains a guard
refusing occurrences dated before today (America/Sao_Paulo) with a clear error and
no state change - cancellation applies from today onward. Rationale: coherent with
the AD-029 spirit (never rewriting the past of the grade) and it avoids rewriting
past credits; today the guard is missing only because the 7-day window never
surfaced it. Bookings/history of the past stay read-only.

## Handoff

Snapshot - updated when work pauses.

### Handoff snapshot (2026-11-15) - `aluno-fixo-limite` FECHADA (worktree `spec-aluno-fixo`)

- Feature `aluno-fixo-limite` EXECUTADA e FECHADA: 6 tasks (T1-T6), uma commit atomica por task
  (`2cd6b3a`..`d088db2`) mais `65bfb2e` fechando os findings do Verifier.
- T1-T4: guards no servidor (encerramento, limite do plano na criacao, guards de plano na
  edicao, limite na conversao). T5: UI de encerramento em `/alunos/[id]`. T6 nasceu de um
  ACHADO DE WALK: `getStudentProfile` listava `endDate = hoje` como ativo (`gte`) enquanto a
  composicao ja nao contava no dia (RES-23) - corrigido para `gt` com criterios novos
  FIX-06/FIX-07 no spec.
- Verifier (author != verifier) devolveu FAIL com 4 findings (perna por-data de C5 sem prova,
  C2 unilateral, walk nao-duravel, proofs.md untracked); todos fechados em `65bfb2e` com
  `verification.md` na coluna `Closed` (o 4o por decisao documentada: proofs.md permanece
  untracked porque carrega o hash do HEAD).
- Suite: 425 testes verdes, build e lint limpos, `check_proofs.py` no HEAD `65bfb2e`: 16/16
  pass; walk do detalhe: 10/10 asserts (roteiro em `.specs/features/aluno-fixo-limite/walk.mjs`).
- FIX: fixture `createStudents` agora vincula um plano de teste (frequencia 7) por default;
  `plan: false` cria sem plano (usado pelo STUD-09). Student sem plano NAO pode ser fixo.
- `validate_verification.py aluno-fixo-limite`: 0 erros / 0 warnings no HEAD de fechamento.
- MERGE: feito - sem colisao de AD (a mainline parou no AD-045) e codigo disjunto; so .specs/STATE.md conflitou (snapshots de Handoff intercalados).

### Handoff snapshot (2026-11-14) - `admin-calendario` FECHADA

- Feature `admin-calendario` EXECUTADA e FECHADA: 13 tasks (T1-T13) em 4 fases e 2 batches
  (13 commits), mais o fix pass do Verifier em 7 commits: `0e8d047` (cabecalho da vista mensal),
  `6dd9895` (historico da turma desativada), `165a515` (link de todo participante e legenda das
  vagas), `4cc32fb` (departures no spec e screens round 1), `409c578` (provas do walk),
  `7f07486` (provas de creditos) e `d01563e` (provas de bloqueio).
- Verifier (author != verifier) devolveu FAIL com 23 findings sobre 24 checks; todos fechados em
  uma passada, com a coluna `Closed` apontando o commit e o check que prova cada um.
- Juiz de telas independente rodou round 1 e round 2 sobre as capturas refeitas (as duas
  `matches`, sem nenhuma linha `differs`); o juiz pode ser despachado neste harness.
- 3 bugs reais fechados no fix pass: a grade mensal comecava na segunda mas o primeiro cabecalho
  era `Dom`; a ocorrencia CANCELADA sumia quando a turma era desativada (CAL-08); a legenda
  afirmava "8 vagas" com capacidade editavel. O link de cadastro existia so para os fixos
  (CAL-11) e passou a valer para todo participante com aluno.
- Departures registrados em `spec.md` `Differences from the source` com `y`: barra de navegacao
  (CAL-02/03/04/22), semana de sete dias segunda-domingo (user: "podemos ter aula todos os
  dias"), rotulos Fixo/Reposicao/Experimental (CAL-10/CAL-11) e a legenda das vagas (CAL-09).
- Suite: 421 testes verdes (61 arquivos), walk 66/66 asserts, build e lint limpos,
  `check_proofs.py` 38 pass / 0 fail e `validate_verification.py` 0 erro / 0 warning.
- Licoes: **L-002** (recorrencia 4) e **L-015** (recorrencia 3) reconfirmadas; 9 candidate novas
  (L-035..L-043) sobre prova vazia, destinatario de credito, cardinalidade, ordem de cabecalho e
  leitura de historico de registro inativo.
- O que entrega: `/grade` com abas Diaria/Semanal/Mensal, setas, seletor de data sem limite de
  7 dias (D+14), acao "Hoje", painel da ocorrencia com participantes e link de cadastro,
  cancelamento pelo estudio com os quatro contadores, selos `Cancelada`/`Bloqueada` nas tres
  vistas, bloqueio por turma/data e a guarda de ocorrencia passada (AD-045).
- Estado local esperado pos-gate: `proofs.md` (desta feature e das outras) e artefato gerado e
  fica como modificacao local nao commitada - commitar movimenta o HEAD e invalida o hash.


### Handoff snapshot (2026-11-14) - `admin-turmas` FECHADA

- Feature `admin-turmas` EXECUTADA e FECHADA: 7 tasks (T1-T7) em 2 fases, uma commit atomica por
  task, mais 4 commits de correcao (refresh da listagem achado no walk, ocorrencia BLOQUEADA
  achada pelo Verifier, reforco das provas e o round do Verifier documentado).
- Verifier (author != verifier) devolveu FAIL com 8 findings; fechados em uma passada -
  `a051ae2` (check C23), `4f24941` (checks C3/C5/C10/C13/C14/C15/C17 e os novos C20-C22) e
  `c5c98fb` (checks C16 e C19, provados no walk round 2) - com `verification.md` na coluna
  `Closed`.
- Suite: 378 testes verdes (363 no inicio), build e lint limpos, `check_proofs.py` com 25 pass /
  0 fail e `validate_verification.py` com 0 erro e 0 warning no HEAD de fechamento.
- O que entrega: rota nova `/turmas` no shell (`NAV_LINKS`), listagem de modalidades e turmas
  ativas e inativas com status/dia/horario/capacidade, formulario de criar e editar modalidade,
  formulario de criar turma (capacidade 8 quando em branco, so modalidades ativas no seletor),
  edicao de dia/horario/capacidade, desativar/reativar sem apagar registro e feedback da
  edicao com quantas ocorrencias foram canceladas e quantos creditos foram gerados.
- Guardas de servidor novas: nome de modalidade em branco recusado com `field: "name"`;
  modalidade inexistente ou INATIVA recusada na criacao de turma; horario, dia e capacidade
  invalidos recusados nomeando o campo (validador de dominio, fonte unica).
- Bug de produto achado pelo Verificador: a mudanca de dia/horario tambem fecha agora a
  ocorrencia BLOQUEADA da grade antiga, sem credito de estudio (feriado/recesso veda credito,
  AD-031) - antes ela ressuscitaria sozinha quando o bloqueio fosse removido (AD-027).
- Bug de produto achado pelo walk: o refresh da listagem dependia do booleano `state.ok` e a
  segunda operacao bem-sucedida nao atualizava a tela (a modalidade ficava INATIVA no banco e a
  tela seguia "Ativa"). Depende do estado inteiro agora.
- Walk: 2 rodadas no chromium headless (playwright-core) contra o dev server na 3001; round 2 com
  20 gestos, contagens nao-zero no feedback da edicao ("Turma atualizada. 1 ocorrencia cancelada
  na grade antiga e 1 credito gerado"), o estado sem nenhuma modalidade ativa (seletor vazio e
  botao desabilitado) e o banco de dev restaurado ao estado anterior.
- Licoes: L-030 (criterio que fala de listagem prova relendo a listagem, nao a tabela), L-031
  (regra que escolhe entre candidatos prova com dois candidatos de valores diferentes), L-032
  (check de tela que conta algo exercita com contagem nao-zero), L-033 (a mudanca de agenda
  fecha tambem as ocorrencias bloqueadas da grade antiga) e L-034 (a tela atualiza depois da
  action dependendo do estado, nao de um booleano dele) - as cinco candidate; **L-002** (a
  prova nomeia o teste que cobre toda a claim) e **L-009** (toda regra do documento tem check
  proprio) reconfirmadas com recorrencia 3.
- PROXIMA feature da ordem do AD-044: `admin-calendario` (spec aprovada, 22 criterios
  CAL-01..22), com Design/Tasks a fazer. O bug do passado (AD-045) fica para la.
- Estado local esperado pos-gate: `proofs.md` e `.specs/features/admin-turmas/proofs.md` sao
  artefatos gerados e ficam como modificacao local nao commitada (commitar movimenta o HEAD e
  invalida o hash das provas).

### Handoff snapshot (2026-11-14) - specs `admin-turmas` + `admin-calendario` APROVADAS

- Fase Specify das duas features fechada com `validate_spec.py` limpo (0 erro/0 warning
  nas duas). User aprovou as duas specs no mesmo turno: "aprovado, vamos fazer primeiro
  a spec de turmas ate o fim, deixe registrado em algum lugar que a proxima sera o
  calendario" - linhas `**Approved**` escritas nos dois spec.md.
- APROVADAS, 18 criterios (TURM-01..18): rota nova `/turmas` no shell com CRUD de
  modalidades e turmas sobre os services existentes, feedback da edicao de
  dia/horario (AD-013/AD-017), guarda de modalidade inativa, desativar/reativar sem
  apagar registro.
- APROVADA, 22 criterios (CAL-01..22): calendario do PRD 4.2 evoluindo a `/grade`
  (abas diaria/semanal/mensal, setas, seletor de data, D+14), participantes com
  vinculo, cancelamento pelo estudio em qualquer data futura, guarda de ocorrencia
  passada (AD-045), bloqueio de turma/data como P2 (AD-032).
- DECISAO DE ORDEM - `admin-turmas` primeiro, implementada ate o fim; a PROXIMA
  feature depois dela e `admin-calendario` (spec aprovada, aguardando Design/Tasks).
  User: "deixe registrado em algum lugar que a proxima sera o calendario".
- Decisoes novas: AD-044 (split, interface, ordem) e AD-045 (cancelamento recusado
  no passado). Nenhum codigo escrito ainda.

### Handoff snapshot (2026-11-14) - `redesign-marca` FECHADA

- Feature `redesign-marca` EXECUTADA e FECHADA: 13 tasks de redesign (T1-T13) mais uma commit
  por achado do Verifier, 36 commits sobre a base 698374c na branch `redesign-marca`, mesclada
  na `main` (4ebae5c) e enviada (main = 4c4fe32).
- O que entrega: a arte do guia de marca em todas as telas existentes - home publica,
  `/experimental`, `/login` e o admin (grade, alunos, experimentais, planos, creditos, feriados).
  Tokens em `globals.css`, kit de UI em `src/modules/ui` (Button, Field, Chip, Toast,
  VacancyDucks), lotacao em patinhos, voz do guia e a area da aluna adiada (a rota nao existe).
- Decisoes: AD-041 (o guia substitui a paleta do PRD), AD-042 (as diferencas aprovadas com o
  guia) e AD-043 (os botoes pequenos mantem a arte do guia e crescem para 44px, o piso de alvo
  de toque do BRAND-05).
- Verifier (author != verifier): o round 1 devolveu FAIL com 9 achados, fechados um a um
  (6734b9d, 7e9ba82, 81b860c, 48f238c, 3a3b30b, 69a21bd, da8c7a8, 9581d26, 7bade6d, 1f98d07);
  o round final devolveu PASS com 41/41 checks (C1-C41) e os 9 achados com `Closed` apontando
  o commit que os fecha. `verification.md` versionado nesta `main`.
- Provas: `check_proofs.py` 44 pass / 0 fail com arvore limpa, `validate_verification.py`
  0 erro / 0 warning, build e lint limpos e a suite verde (58 arquivos, 363 testes). O walk de
  telas foi de 30/30 para 47/47 asserts, e o proprio walk devolve o banco de dev ao estado
  inicial.
- Ressalva registrada: toda sessao de juiz de telas foi recusada pelo filtro de seguranca da
  ferramenta, entao o refresh do `screens.md` depois do round 2 (a copy "voce" e o piso de 44px)
  foi do autor e esta marcado como tal no proprio arquivo; os 16 vereditos continuam sendo os
  do juiz independente do round 2.
- Merge na `main`: 3 conflitos, todos na camada de banco - as duas branches criaram a migracao
  0004 com SQL byte-identico; mantida a migracao da `main` e nada do dominio da `main` foi
  sobrescrito (`git diff main -- src/modules src/db` vazio).

### Handoff snapshot (2026-11-12) - `core-experimentais` FECHADA

- Feature `core-experimentais` EXECUTADA e FECHADA: 26 tasks (T1-T26) em 4 fases, uma commit
  atomica por task sobre o commit de planejamento a8c3595, em 3 batches de sub-agentes
  (Fases 1-2, Fase 3, Fase 4). Dois workers cairam por limite de uso do provider no meio da
  T1 e da T13 e foram retomados do estado parcial em disco - commitar por task e o que torna
  o resume barato. 0 desvios de spec.
- Verifier (author != verifier) devolveu FAIL com 7 findings (F1-F7) mais 1 bug pre-existente
  (F8); fechados em uma passada, um commit por finding (1b62fe1 C7, 8abe4c5 C8, 01713c3 C15,
  d9de766 C21, 1c73ef1 C42, a6d85c3 F8) e a prova de walk das telas de C27/C43 em 3c4af45;
  `verification.md` com os 8 findings fechados na coluna `Closed` (6a7a892).
- `check_proofs.py` com 66 pass / 0 fail e `validate_verification.py` com 0 erro e 0 warning no
  HEAD de fechamento. Suite verde (unit + integration), build e lint limpos.
- O que a feature entrega: formulario publico `/experimental` (nome, telefone, modalidade,
  dia/horario com vaga, R$ 45,00, declaracao do PRD), painel admin `/experimentais` (lista,
  busca por telefone, detalhe com aprovar/recusar/trocar ocorrencia/reagendar/cancelar/falta/
  pagamento/contato por WhatsApp/conversao), grade listando a aprovada como `(experimental)`,
  composicao contando APROVADA e conversao transacional em aluna ATIVA com plano e horarios
  fixos (AD-037).
- Bug pre-existente corrigido (F8, achado pelo Verifier): o default `enrollment_date` usava
  `CURRENT_DATE` do Postgres (UTC) e a suite ficava vermelha entre 21h e 23h59; agora segue o
  calendario do estudio (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`, migracao 0004) e o
  teste compara com `todayInStudio()`.
- Decisoes do usuario desta feature: AD-036 (tabela propria, aprovada ocupa vaga), AD-037
  (conversao transacional em aluna ATIVA, sem estado intermediario), AD-038 (duplicidade: tudo
  exceto RECUSADA bloqueia e a tentativa fica gravada como DUPLICADA), AD-039 (admin registra
  cancelamento/falta com a regra de 24h; cancelamento do estudio mantem o direito), AD-040
  (o formulario escolhe a ocorrencia concreta com vaga; preco R$ 45,00 manual).
- Licoes destiladas dos findings: L-028 (criterio que nomeia uma tela e provado pelo walk do
  browser, nao pelo gate Build) e L-029 (data escrita por default do banco segue o calendario
  do estudio; teste que compara com a data local da maquina fica vermelho no fim do dia) - as
  duas candidate. L-002 (a prova nomeia o teste que cobre toda a claim) reincidiu em 5
  findings desta feature e foi penalizada (harmful=1).
- Feature `admin-base` EXECUTADA e FECHADA antes desta: 13 tasks, 6 findings do Verifier
  fechados (94d70dc, 1e3c822, 78eb0ad, 1594143, 39cdce4, 717ec90), com criterios novos no
  spec (AUTH-09, STUD-09, STUD-10, STUD-11) e checks C25-C30.
- Estado local esperado pos-gate: `proofs.md`, `.specs/LESSONS.md` e `.specs/lessons.json` sao
  artefatos gerados e ficam como modificacao local nao commitada (commitar movimenta o HEAD e
  invalida o hash das provas).
- Proxima feature da ordem do AD-009 (emendada pela AD-034): area do aluno (PRD modulos 12 e
  13) e o resto da FASE 1 do PRD 16. Dev server: subir com `npm run dev` APOS qualquer
  `npm run build` (o build de producao sobrescreve `.next` e corrompe o cache do dev server
  rodando - reiniciar e limpar `.next`).

### Handoff snapshot (2026-11-11)

- Feature `core-feriados-recessos` EXECUTADA: 8 tasks (T1-T8), uma commit atomica por task,
  mais 3 commits de correcao (feedback da tela fora das listas 5b88dd2, fixture de
  enrollments independente do dia da semana 1c593de e reforco das provas do Verifier
  816fa51). Verifier (author != verifier) devolveu FAIL com 2 findings de forca de prova;
  ambos fechados em 816fa51 na coluna `Closed` de `verification.md`.
- Suite: 188 testes verdes (unit 46 + integration 142), build e lint limpos,
  `check_proofs.py` com 47 pass / 0 fail e `validate_verification.py` com 0 erro e 0
  warning (feature fechada).
- Licoes: L-020 registrada (candidate: criterio que protege linhas existentes prova com as
  linhas no lugar, campo a campo) e **L-015 promovida a confirmed** (recorrencia 2:
  core-creditos-cancelamentos + core-feriados-recessos). L-002 e L-009 seguiram confirmadas
  e foram aplicadas (checks proprios por regra, provas que nomeiam o teste completo).
- Decisoes do usuario que valem para as proximas features: AD-026 (bloqueio cancela as
  reservas ativas e devolve o credito da reposicao com vencimento original, sem criar
  credito), AD-027 (desbloqueio automatico volta a AGENDADA sem restaurar reservas),
  AD-028 (sobreposicao de bloqueios permitida, sem unificar), AD-029 (data passada aceita
  com efeito so para frente), AD-030 (feriados nacionais sem seed), AD-031 (cancelamento
  pelo estudio recusado em ocorrencia bloqueada), AD-032 (bloqueio de horario por turma
  fica para o painel admin) e AD-033 (sem coluna status do PRD 12; remocao fisica).
- Walk da feature: chromium headless (playwright-core) contra o dev server na 3001, rotas
  `/feriados` e `/grade` com os 10 gestos exercitados (listar vazia, cadastrar feriado,
  duplicar com erro, grade bloqueada, recesso sobreposto, editar, remover feriado com
  sobreposicao mantendo bloqueio, remover recesso reabrindo, estado final com Natal 25/12
  e recesso de hoje). Sem pageerrors. O feedback das operacoes fica num host unico fora
  das listas (a linha removida sairia da lista levando a mensagem junto).
- Nucleo do bloqueio: transicao pura em `bookings/domain/blocks.ts`
  (`resolveBlockTransition` + `isDateCoveredByBlocks`), reconcilio em
  `bookings/services/blocks.ts` (janela clampada para hoje, transacao unica, idempotente),
  CRUD em `classes/services/blocks.ts` disparando o reconcilio, `hasBlock` do
  `sessions.ts` na cobertura compartilhada (L-005), guarda de recusa em
  `cancelOccurrenceByStudio`.
- Setup local (AD-015): `docker compose up -d` -> `npm run db:migrate` -> `npm run
  db:seed` -> `npm run dev` (3001 se a 3000 estiver ocupada); docker desktop precisa
  estar de pe antes de qualquer comando docker.
- Proxima feature da ordem do AD-009 (emendada pela AD-034): base do admin
  (login + area logada dos admins) antes das experimentais (PRD modulo 8).

### Handoff snapshot (2026-11-10)

- Feature `core-creditos-cancelamentos` EXECUTADA: 18 tasks (T1-T18), uma commit atomica por
  task, em 3 batches (Fases 1-2, Fases 3-4 e Fase 5), mais 2 commits da rodada de correcao
  do Verifier.
- Verifier (author != verifier) devolveu FAIL com 10 achados; os 10 foram corrigidos em uma
  passada no commit 60d114e, cada um fechado por commit na coluna `Closed` de
  `verification.md`. Criterios CRD-45, CRD-46 e CRD-47 acrescentados ao spec (aviso so para
  aluno fixo, aviso em ocorrencia cancelada, aviso em ocorrencia no passado), com os checks
  C45-C47; a ressalva da borda de 7 dias dos vencimentos foi fechada no commit ed02215.
- Suite: 149 testes verdes (unit 37 + integration 112), build e lint limpos,
  `check_proofs.py` com 63 pass / 0 fail e `validate_verification.py` com 0 erro e 0 warning
  (feature fechada).
- 9 licoes destiladas dos achados do Verifier em `.specs/lessons.json`; L-002 e L-009
  reincidiram nesta feature e foram promovidas a `confirmed` (mesma regra observada em
  2 features distintas).
- Decisoes do usuario que valem para as proximas features: AD-016 (escopo = regras no
  servidor + UI minima do admin; a area do aluno vem depois), AD-017 (1 credito
  CANCELAMENTO_ESTUDIO por aluno fixo afetado na ocorrencia cancelada), AD-018 (o credito da
  reposicao vira UTILIZADO quando passa o fim da aula, sem etapa de presenca), AD-019
  (agendamento manual pelo admin exige credito valido e nao conta no limite semanal), AD-020
  e AD-021 (devolver credito volta a DISPONIVEL com o vencimento original), AD-022 e AD-023
  (falta e cancelamento no status da reserva; o admin registra o aviso em nome do aluno),
  AD-024 (o limite de 2 reposicoes conta a semana de segunda a domingo da data da aula) e
  AD-025 (o credito do estudio nao duplica o credito que o aluno ja tem da ocorrencia).
- Walk da feature: chromium headless (playwright-core) contra o dev server na 3001, rotas
  `/creditos` e `/grade`, com as 6 acoes exercitadas (conceder, devolver, cancelar, aviso
  com e sem as 24h, reposicao manual com e sem credito, cancelar aula).
- `proofs.md` e artefato gerado: fica regenerado no HEAD de fechamento (por isso
  aparece como modificacao local depois do ultimo commit).
- Setup local (AD-015): `docker compose up -d` -> `npm run db:migrate` ->
  `npm run db:seed` -> `npm run dev`; o Postgres local fica na 55432 (container `yoguese-db`).
- Deferred to later features: area do aluno (autoatendimento de reposicao e botoes do
  aluno), auth/profiles, notificacoes, pagamentos, relatorios e agenda.

### Handoff snapshot (2026-11-07)

- Feature `core-turmas-reservas` EXECUTADA: 20 tasks (T1-T20), uma commit atomica por
  task, mais 6 commits da rodada de correcao do Verifier.
- Verifier (author != verifier) devolveu FAIL com 10 achados; os 10 foram corrigidos,
  cada um fechado por commit na coluna `Closed` de `verification.md`, e os checks
  C28-C31 foram acrescentados. Criterios RES-28 e RES-29 acrescentados ao spec
  (regra da edicao de capacidade e da edicao de dia/horario).
- Suite: 78 testes verdes (unit 21 + integration 57), build e lint limpos,
  `check_proofs.py` com 33 pass / 0 fail e `validate_verification.py` com 0 erro
  e 0 warning (feature fechada).
- 11 licoes destiladas dos achados do Verifier em `.specs/lessons.json` (todas
  `candidate`; viram `confirmed` quando reaparecerem em outra feature).
- Decisoes do usuario que valem para as proximas features: AD-013 (editar dia/horario
  cancela as ocorrencias futuras antigas e as reservas delas - na feature de creditos
  isso vira credito automatico) e AD-014 (agenda publica omite bloqueadas e inativas;
  a grade admin mostra BLOQUEADA).
- `proofs.md` e artefato gerado: fica regenerado no HEAD de fechamento (por isso
  aparece como modificacao local depois do ultimo commit).
- Setup local (AD-015): `docker compose up -d` -> `npm run db:migrate` ->
  `npm run db:seed` -> `npm run dev`; o `README.md` da raiz traz o passo a passo.
  O Postgres local fica na 55432 e o container antigo do walk (`yoguese-walk`) usa
  a mesma porta - pare um dos dois antes de subir o outro.
- Deferred to later features: auth/profiles, credits + 24h rule (a AD-013 vira
  credito automatico la), experimental approval flow, student-area UI, institutional
  site, notifications, payments, reports, agenda (validacao de `from`/`to`).
