# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - A criterion that says the system persists a state is proven only by a test that reads the stored row, never by a validator-only unit test.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: core-turmas-reservas
- evidence: C1 (src/modules/classes/__tests__/actions.int.test.ts:46) (tests)
- last seen: 2026-11-07T11:24:38Z

### L-002 - A proof line must name a test that asserts every case the check names, so one test covers the whole claim.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: core-turmas-reservas
- evidence: C3, C7, C9, C10 (tests)
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

### L-009 - Every rule the source document states gets its own check, because behavior that is correct only by probe breaks silently when no test names it.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: core-turmas-reservas
- evidence: C28, C29, C30 (tests)
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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
