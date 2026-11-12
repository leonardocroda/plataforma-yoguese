# core-creditos-cancelamentos proofs

**HEAD**: 4d8e313
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 63 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run int / ✓ non attendance > creates the occurrence record and releases the spot` | pass |
| C2 | `run int / ✓ non attendance > records the cancellation when the notice is 24 hours or more` | pass |
| C2 | `run unit / ✓ credit rules > measures the hours until the class start in the studio timezone` | pass |
| C3 | `run int / ✓ non attendance > records the absence when the notice is under 24 hours` | pass |
| C4 | `run int / ✓ non attendance > grants a credit when the notice is 24 hours or more` | pass |
| C4 | `run unit / ✓ credit rules > sets the credit expiry 30 days after the generation` | pass |
| C5 | `run int / ✓ non attendance > grants a credit at exactly 24 hours` | pass |
| C5 | `run unit / ✓ credit rules > treats exactly 24 hours as eligible` | pass |
| C6 | `run int / ✓ non attendance > grants no credit at 23 hours 59 minutes` | pass |
| C6 | `run unit / ✓ credit rules > treats 23 hours 59 minutes as not eligible` | pass |
| C7 | `run int / ✓ non attendance > refuses a second notice for the same occurrence` | pass |
| C8 | `run int / ✓ non attendance > keeps the fixed enrollment active for the next occurrences` | pass |
| C9 | `run int / ✓ composition > drops the fixed student who cancelled or missed the occurrence` | pass |
| C10 | `run int / ✓ non attendance > records the notice in the student history` | pass |
| C11 | `run int / ✓ credits > grants a manual credit with a 30 day expiry and a transaction` | pass |
| C11 | `run int / ✓ non attendance > grants a credit when the notice is 24 hours or more` | pass |
| C11 | `run int / ✓ bookings > reserves the credit and links it to the booking` | pass |
| C12 | `run int / ✓ credits > keeps the documented origins and statuses` | pass |
| C13 | `run int / ✓ credits > blocks the use of an expired credit` | pass |
| C13 | `run unit / ✓ credit status > reports an expired credit as VENCIDO` | pass |
| C14 | `run int / ✓ credits > refuses a second credit for the same origin` | pass |
| C15 | `run int / ✓ credit transactions > records the previous status, the new status, the reason and the responsible` | pass |
| C16 | `run int / ✓ credit transactions > refuses a manual change without a reason` | pass |
| C17 | `run int / ✓ bookings > reserves the credit and links it to the booking` | pass |
| C18 | `run int / ✓ bookings > requires a valid credit for a makeup booking` | pass |
| C19 | `run int / ✓ makeups > blocks the third makeup of the week for the student self service` | pass |
| C19 | `run unit / ✓ credit week > counts only the makeups of the monday to sunday week of the occurrence` | pass |
| C20 | `run int / ✓ makeups > counts only the makeups of the occurrence week` | pass |
| C21 | `run int / ✓ makeups > lets the admin book a makeup without the weekly limit` | pass |
| C22 | `run int / ✓ makeups > confirms one of two concurrent bookings with the same credit` | pass |
| C23 | `run int / ✓ makeups > allows a makeup in any class type` | pass |
| C24 | `run int / ✓ makeups > reports eligibility and lists only classes with a free spot` | pass |
| C25 | `run int / ✓ makeups > returns the credit to DISPONIVEL when the makeup is cancelled 24 hours ahead` | pass |
| C26 | `run int / ✓ makeups > cancels the credit when the makeup is cancelled under 24 hours` | pass |
| C27 | `run int / ✓ makeups > grants no new credit when a makeup is cancelled` | pass |
| C28 | `run int / ✓ studio cancellation > cancels the occurrence and its active bookings` | pass |
| C29 | `run int / ✓ studio cancellation > grants one credit per affected fixed student` | pass |
| C30 | `run int / ✓ studio cancellation > returns the makeup credit to DISPONIVEL` | pass |
| C31 | `run int / ✓ studio cancellation > grants no duplicate credit when the cancellation repeats` | pass |
| C32 | `run int / ✓ sessions > grants one credit per fixed student per cancelled future occurrence on a schedule edit` | pass |
| C33 | `run int / ✓ studio cancellation > grants the studio credit to a student who already missed` | pass |
| C33 | `run int / ✓ studio cancellation > grants no second credit to a student who already has one for the occurrence` | pass |
| C34 | `run int / ✓ credits > grants a manual credit with a 30 day expiry and a transaction` | pass |
| C35 | `run int / ✓ credits > returns a credit to DISPONIVEL keeping the original expiry` | pass |
| C36 | `run int / ✓ credits > cancels a credit and keeps the history` | pass |
| C37 | `run int / ✓ credits > lists the credits of a student with their transactions` | pass |
| C38 | `run int / ✓ credits > lists the available credits expiring in the next 7 days` | pass |
| C39 | `walk - a tela de creditos do aluno lista os creditos do aluno com geracao, vencimento, status, origem e as tra` | pass (Walked) |
| C40 | `run int / ✓ credit actions > grants a credit from the admin action and returns the new status` | pass |
| C40 | `run int / ✓ credit actions > returns a credit from the admin action and returns the new status` | pass |
| C40 | `run int / ✓ credit actions > cancels a credit from the admin action and returns the new status` | pass |
| C40 | `run int / ✓ credit actions > refuses a manual credit change without a reason` | pass |
| C41 | `run int / ✓ credit actions > registers the non attendance from the admin action and returns the outcome` | pass |
| C41 | `run int / ✓ credit actions > registers the absence from the admin action without a credit` | pass |
| C42 | `run int / ✓ credit actions > cancels the class from the admin action and returns the counts` | pass |
| C43 | `run int / ✓ credit actions > refuses a manual makeup without a credit` | pass |
| C44 | `run unit / ✓ credit status > reports a reserved credit whose class ended as UTILIZADO` | pass |
| C44 | `run int / ✓ credits > settles a reserved credit as UTILIZADO after the class ends` | pass |
| C45 | `run int / ✓ non attendance > refuses the notice when the student is not a fixed student` | pass |
| C46 | `run int / ✓ non attendance > refuses the notice when the occurrence was cancelled by the studio` | pass |
| C47 | `run int / ✓ non attendance > refuses the notice when the occurrence is in the past` | pass |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run int` - exit 0

```
 ✓ src/modules/credits/services/__tests__/credits.int.test.ts > credits > returns a credit to DISPONIVEL keeping the original expiry 258ms
 ✓ src/modules/credits/services/__tests__/credits.int.test.ts > credits > cancels a credit and keeps the history 176ms
 ✓ src/modules/credits/services/__tests__/credits.int.test.ts > credits > lists the credits of a student with their transactions 406ms
 ✓ src/modules/credits/services/__tests__/credits.int.test.ts > credits > lists the available credits expiring in the next 7 days 273ms
 ✓ src/modules/credits/services/__tests__/credits.int.test.ts > credits > settles a reserved credit as UTILIZADO after the class ends 195ms
 ✓ src/test/__tests__/postgres.int.test.ts > testcontainer postgres > starts the container and queries postgres 7ms

 Test Files  18 passed (18)
      Tests  112 passed (112)
   Start at  09:24:44
   Duration  134.74s (tests 84%, import 16%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run unit` - exit 0

```
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates include both edges when they match the slot 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates with an invalid range return an empty list 0ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > occurrence dates do not shift during the daylight saving transition 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence is the same day when today is a class day 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > next occurrence advances to the following week 1ms
 ✓ src/modules/classes/domain/__tests__/occurrences.test.ts > occurrences > addDays crosses the month boundary 1ms

 Test Files  7 passed (7)
      Tests  37 passed (37)
   Start at  09:27:02
   Duration  639ms (import 55%, transform 17%, worker 16%, tests 11%, environment 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
