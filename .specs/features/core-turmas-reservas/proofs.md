# core-turmas-reservas proofs

**HEAD**: 5fa234f
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 33 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run int / ✓ admin actions > creates a class type and a slot through the actions` | pass |
| C2 | `run int / ✓ classes > default capacity is eight` | pass |
| C3 | `run unit / ✓ validators > rejects every invalid field naming the offending one` | pass |
| C4 | `run int / ✓ classes > editing or deactivating a class affects future occurrences` | pass |
| C5 | `run int / ✓ seed > the two PRD class types` | pass |
| C6 | `run int / ✓ sessions > creates on the first query and re-queries without duplicating` | pass |
| C7 | `run int / ✓ bookings > rejects a booking in an occurrence blocked by holiday or closure` | pass |
| C8 | `run int / ✓ composition > PRD example 5+2+1 cap 8 with zero spots left` | pass |
| C9 | `run int / ✓ enrollments > counts an active enrollment as fixed and stops counting after it ends` | pass |
| C10 | `run int / ✓ composition > reads a materialized past occurrence and refuses creating a new one` | pass |
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
| C28 | `run int / ✓ bookings > a class with eight bookings refuses the ninth` | pass |
| C29 | `run int / ✓ classes > rejects a capacity below the occupancy of a future occurrence` | pass |
| C30 | `run int / ✓ blocks > a holiday and a closure on the same date block one single occurrence` | pass |
| C31 | `run int / ✓ occurrence composition > the single composition service feeds the booking and the reading paths` | pass |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run int` - exit 0

```
 ✓ src/modules/classes/__tests__/actions.int.test.ts > admin actions > creates and ends a fixed enrollment through the actions 306ms
 ✓ src/modules/classes/services/__tests__/classes.int.test.ts > composition > reads a materialized past occurrence and refuses creating a new one 211ms
 ✓ src/modules/classes/services/__tests__/classes.int.test.ts > composition > reading a past date does not materialize 164ms
 ✓ src/__tests__/seed.int.test.ts > seed > migration applies on the empty container 7ms
 ✓ src/__tests__/seed.int.test.ts > seed > the two PRD class types 38ms
 ✓ src/__tests__/seed.int.test.ts > seed > test students are loaded 11ms

 Test Files  10 passed (10)
      Tests  57 passed (57)
   Start at  07:35:56
   Duration  86.65s (tests 87%, import 13%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run unit` - exit 0

```
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates include both edges when they match the slot 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates with an invalid range return an empty list 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates do not shift during the daylight saving transition 2ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence is the same day when today is a class day 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence advances to the following week 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > addDays crosses the month boundary 1ms

 Test Files  4 passed (4)
      Tests  21 passed (21)
   Start at  07:37:26
   Duration  697ms (import 52%, worker 17%, transform 16%, tests 14%, environment 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
