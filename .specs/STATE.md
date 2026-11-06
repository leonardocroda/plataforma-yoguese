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

## Handoff

Snapshot - updated when work pauses.

### Handoff snapshot (2026-11-06)

- Repo initialized this session; first commit pending (docs + spec).
- Feature in course: `core-turmas-reservas` - SPECIFY phase, spec written,
  awaiting user approval before Design/Tasks/Execute.
- Stack decisions AD-001..AD-009 ready to feed the scaffold tasks.
- Deferred to later features: auth/profiles, credits + 24h rule,
  experimental approval flow, student-area UI, institutional site,
  notifications, payments, reports.
