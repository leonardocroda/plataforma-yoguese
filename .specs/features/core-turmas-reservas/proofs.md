# core-turmas-reservas proofs

**HEAD**: d16d038
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 29 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ validators > accepts a valid class` | pass |
| C2 | `run int / ✓ classes > default capacity is eight` | pass |
| C3 | `run unit / ✓ validators > rejects an end time less than or equal to the start` | pass |
| C4 | `run int / ✓ classes > deactivating a class affects future occurrences` | pass |
| C5 | `run int / ✓ seed > the two PRD class types` | pass |
| C6 | `run int / ✓ sessions > creates on the first query and re-queries without duplicating` | pass |
| C7 | `run int / ✓ sessions > a holiday blocks the occurrence` | pass |
| C8 | `run int / ✓ composition > PRD example 5+2+1 cap 8 with zero spots left` | pass |
| C9 | `run int / ✓ enrollments > an ended enrollment leaves the date count` | pass |
| C10 | `run int / ✓ sessions > rejects materializing a past date` | pass |
| C11 | `run int / ✓ blocks > a holiday blocks the occurrence on that date` | pass |
| C12 | `run int / ✓ blocks > a closure blocks the inclusive boundary dates` | pass |
| C13 | `run int / ✓ blocks > refuses a holiday on a date already registered` | pass |
| C14 | `run int / ✓ bookings > confirms when a spot is available` | pass |
| C15 | `run int / ✓ bookings > rejects when full with a clear message and no partial state` | pass |
| C16 | `run int / ✓ bookings > concurrency on the last spot confirms one` | pass |
| C17 | `run int / ✓ bookings > rejects a duplicate in the same session` | pass |
| C18 | `run int / ✓ bookings > rejects a past date` | pass |
| C19 | `run int / ✓ bookings > records audit data` | pass |
| C20 | `run int / ✓ bookings > second class on the same day with admin` | pass |
| C21 | `run int / ✓ enrollments > creates and counts from the start_date` | pass |
| C22 | `run int / ✓ enrollments > rejects a full class at the next occurrence` | pass |
| C23 | `run int / ✓ enrollments > capacity is checked before writing` | pass |
| C24 | `run int / ✓ enrollments > end_date removes the count after the end` | pass |
| C25 | `run int / ✓ enrollments > student history` | pass |
| C26 | `run int / ✓ agenda > returns the period without personal data` | pass |
| C27 | `run int / ✓ agenda > omits an inactive slot from the list` | pass |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run unit` - exit 0

```
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates include both edges when they match the slot 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates with an invalid range return an empty list 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates do not shift during the daylight saving transition 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence is the same day when today is a class day 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence advances to the following week 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > addDays crosses the month boundary 1ms

 Test Files  4 passed (4)
      Tests  20 passed (20)
   Start at  01:26:14
   Duration  367ms (import 46%, transform 24%, worker 17%, tests 12%, environment 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run int` - exit 0

```
 ✓ src/app/(site)/api/agenda/__tests__/agenda.int.test.ts > agenda > rejects an invalid period with 400 22ms
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > propagates the slot validation error to the caller 44ms
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > deactivates a class type and a slot through the actions 49ms
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > creates a manual booking through the action 164ms
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > propagates the no-vacancy error from the booking action 161ms
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > creates and ends a fixed enrollment through the actions 61ms

 Test Files  9 passed (9)
      Tests  44 passed (44)
   Start at  01:26:18
   Duration  79.02s (tests 87%, import 13%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
