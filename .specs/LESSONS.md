# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

### L-002 - A proof line must name a test that asserts every case the check names, so one test covers the whole claim.
- signal: `weak_test` · recurrence: 2 feature(s) · scope: `tests` · harmful: 1
- features: core-turmas-reservas, core-creditos-cancelamentos
- evidence: C3, C7, C9, C10 (tests) (+2 more)
- last seen: 2026-11-13T02:09:55Z

### L-009 - Every rule the source document states gets its own check, because behavior that is correct only by probe breaks silently when no test names it.
- signal: `weak_test` · recurrence: 2 feature(s) · scope: `tests` · harmful: 0
- features: core-turmas-reservas, core-creditos-cancelamentos
- evidence: C28, C29, C30 (tests) (+1 more)
- last seen: 2026-11-10T12:21:45Z

### L-015 - A rule with two branches is proven on both branches, because the branch the happy path never reaches stays untested.
- signal: `weak_test` · recurrence: 2 feature(s) · scope: `bookings` · harmful: 0
- features: core-creditos-cancelamentos, core-feriados-recessos
- evidence: C9 (bookings) (+1 more)
- last seen: 2026-11-11T19:39:52Z

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - A criterion that says the system persists a state is proven only by a test that reads the stored row, never by a validator-only unit test.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: core-turmas-reservas
- evidence: C1 (src/modules/classes/__tests__/actions.int.test.ts:46) (tests)
- last seen: 2026-11-07T11:24:38Z

### L-003 - Any path that returns an existing occurrence re-checks the slot and class type status first, because get-or-create short-circuits before the write path validates.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `bookings` · harmful: 0
- features: core-turmas-reservas
- evidence: RES-04 (src/modules/bookings/services/sessions.ts:50) (bookings)
- last seen: 2026-11-07T11:24:39Z

### L-004 - Editing the weekday or time of a recurring slot cancels the future occurrences of the old schedule, because materialized rows survive a slot update.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `classes` · harmful: 0
- features: core-turmas-reservas
- evidence: AD-013 (src/modules/classes/services/classes.ts:169) (classes)
- last seen: 2026-11-07T11:24:39Z

### L-005 - Derived numbers such as occupancy and available spots come from one shared service, because two derivations drift apart and one of them stays untested.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `bookings` · harmful: 0
- features: core-turmas-reservas
- evidence: RES-27 (src/modules/bookings/services/bookings.ts:127) (bookings)
- last seen: 2026-11-07T11:24:40Z

### L-006 - A status column the product exposes is read by every listing that publishes the entity, because writing it alone changes nothing.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `classes` · harmful: 0
- features: core-turmas-reservas
- evidence: RES-05 (src/modules/classes/services/classes.ts:210) (classes)
- last seen: 2026-11-07T11:24:41Z

### L-007 - Materializing an occurrence validates the requested date against the slot weekday, because the key alone accepts any date.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `bookings` · harmful: 0
- features: core-turmas-reservas
- evidence: src/modules/bookings/services/sessions.ts:79 (bookings)
- last seen: 2026-11-07T11:24:41Z

### L-008 - Composition counts distinct people, because summing enrollments and bookings counts the same student twice.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `bookings` · harmful: 0
- features: core-turmas-reservas
- evidence: src/modules/bookings/services/bookings.ts:84 (bookings)
- last seen: 2026-11-07T11:24:42Z

### L-010 - A rule gets its own requirement ID before the checks cite it, because two rules under one ID make the traceability ambiguous.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec` · harmful: 0
- features: core-turmas-reservas
- evidence: spec.md:176 (RES-17 collision) (spec)
- last seen: 2026-11-07T11:24:42Z

### L-011 - A public listing publishes only the occurrences the server accepts bookings for, because a published blocked occurrence shows availability that does not exist.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `agenda` · harmful: 0
- features: core-turmas-reservas
- evidence: src/app/(site)/api/agenda/route.ts:56 (agenda)
- last seen: 2026-11-07T11:24:43Z

### L-012 - A rule with a numeric threshold is proven at the exact boundary and one step below, because a test in the middle of the range passes whatever the threshold is.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `credits` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: C25/C26 (credits)
- last seen: 2026-11-10T12:17:00Z

### L-013 - A rule that compares two periods is proven with the request in a third period, because a test whose dates fall in the current period cannot tell which period the rule used.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `credits` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: C20 (credits)
- last seen: 2026-11-10T12:17:01Z

### L-014 - A rule that decides a state from the current time is exercised through the service that owns the clock, because a unit test that injects the outcome proves nothing about the rule.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `credits` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: C44 (credits)
- last seen: 2026-11-10T12:17:01Z

### L-016 - A criterion that says the system persists references is proven by asserting the references on the rows that carry them, because asserting only the empty case passes whatever the writer stores.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `credits` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: C11 (credits)
- last seen: 2026-11-10T12:17:02Z

### L-017 - A criterion that names a type of a created row is proven by asserting that type on the row itself, because an assertion on the related row passes whatever the type is.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `bookings` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: C17 (bookings)
- last seen: 2026-11-10T12:17:02Z

### L-018 - Every rule the source document states gets its own check, because behavior that is correct only by probe breaks silently when no test names it.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: spec.md edge cases CRD-46/CRD-47 (spec)
- last seen: 2026-11-10T12:17:04Z

### L-019 - A service that grants an entitlement checks the eligibility the requirement names, because a form that offers only eligible records hides the gap from every test.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `credits` · harmful: 0
- features: core-creditos-cancelamentos
- evidence: CRD-01/CRD-45 (credits)
- last seen: 2026-11-10T12:17:05Z

### L-020 - A criterion that protects existing rows is proven with those rows in place, asserting their fields after the operation
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: core-feriados-recessos
- evidence: C7 (tests)
- last seen: 2026-11-11T19:39:51Z

### L-021 - A route guard checks the session role together with session presence, so any role added later cannot leak through a layout that only tests for null.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `auth` · harmful: 0
- features: admin-base
- evidence: src/app/(admin)/layout.tsx:26 (auth)
- last seen: 2026-11-12T15:24:29Z

### L-022 - Every service path that writes a state a validator guards must reapply the validator rule, because create/update coverage never protects a third path like a status transition.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `students` · harmful: 0
- features: admin-base
- evidence: src/modules/students/services/students.ts:207 (students)
- last seen: 2026-11-12T15:24:29Z

### L-023 - When a criterion fixes exact display terms, labels copy them verbatim instead of paraphrasing or inflecting them.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: admin-base
- evidence: src/app/(admin)/alunos/student-forms.tsx:32 (ui)
- last seen: 2026-11-12T15:24:48Z

### L-024 - An optional field's edit path distinguishes omitted from empty, because empty is how the user clears the value.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `plans` · harmful: 0
- features: admin-base
- evidence: src/modules/plans/services/plans.ts:129 (plans)
- last seen: 2026-11-12T15:24:54Z

### L-025 - Uniqueness of an access-identity field ignores letter case and the stored value is normalized, because a future login normalizes before comparing.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `students` · harmful: 0
- features: admin-base
- evidence: src/modules/students/services/students.ts:87 (students)
- last seen: 2026-11-12T15:24:59Z

### L-026 - A referenced id reachable through a server action is validated for existence with a field error, because the form select is not the only entry point.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: admin-base
- evidence: src/modules/students/services/students.ts:119 (repo-layer)
- last seen: 2026-11-12T15:25:04Z

### L-027 - A service signature change needs the Build gate, not only the targeted vitest run, because vitest's esbuild transform does not typecheck.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `repo` · harmful: 0
- features: admin-base
- evidence: proofs.md Build - plans.ts input.description (repo)
- last seen: 2026-11-12T15:25:10Z

### L-028 - A criterion that names a screen is proved by the browser walk that visits that screen, not by the build gate that only compiles it.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: core-experimentais
- evidence: verification.md C27 (F6) e C43 (F7) (ui)
- last seen: 2026-11-13T02:09:55Z

### L-029 - A date written by a database default follows the studio calendar, and a test that compares it with the machine local date turns red at the end of the day.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `db` · harmful: 0
- features: core-experimentais
- evidence: src/db/__tests__/students-schema.int.test.ts:102 (db)
- last seen: 2026-11-13T02:09:55Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
