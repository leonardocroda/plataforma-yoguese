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

## Handoff

Snapshot - updated when work pauses.

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
