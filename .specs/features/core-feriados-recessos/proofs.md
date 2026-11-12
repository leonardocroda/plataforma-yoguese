# core-feriados-recessos proofs

**HEAD**: 775a5b3
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 47 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run int / ✓ blocks > blocks the existing occurrences when the holiday is created (FER-01)` | pass |
| C1 | `run int / ✓ block reconcile > blocks the occurrences of the window and cancels their active bookings (FER-01, ` | pass |
| C1 | `run unit / ✓ block transition (domain) > blocks a covered scheduled occurrence` | pass |
| C2 | `run int / ✓ blocks > blocks every date of the closure range when the closure is created (FER-02)` | pass |
| C2 | `run unit / ✓ block transition (domain) > matches the holiday date and the inclusive closure range` | pass |
| C3 | `run int / ✓ block reconcile > blocks the occurrences of the window and cancels their active bookings (FER-01, ` | pass |
| C4 | `run int / ✓ block reconcile > returns the reserved makeup credit to DISPONIVEL keeping the original expiry (FE` | pass |
| C5 | `run int / ✓ blocks > creates no credit when a block is registered (FER-05, PRD 15)` | pass |
| C5 | `run int / ✓ block reconcile > creates no credit when blocking (FER-05, PRD 15)` | pass |
| C6 | `run int / ✓ block reconcile > leaves past occurrences untouched (FER-06)` | pass |
| C6 | `run unit / ✓ block transition (domain) > treats today as affected and yesterday as not` | pass |
| C7 | `run int / ✓ block reconcile > leaves cancelled occurrences untouched (FER-07)` | pass |
| C7 | `run unit / ✓ block transition (domain) > ignores a covered cancelled occurrence` | pass |
| C8 | `run int / ✓ bookings > rejects a booking in an occurrence blocked by holiday or closure` | pass |
| C9 | `run int / ✓ studio cancellation > refuses the cancellation of a blocked occurrence (FER-09)` | pass |
| C10 | `run int / ✓ blocks > unblocks the occurrences when the holiday is deleted (FER-10)` | pass |
| C10 | `run int / ✓ block reconcile > restores uncovered blocked occurrences to AGENDADA (FER-10)` | pass |
| C10 | `run unit / ✓ block transition (domain) > reopens an uncovered blocked occurrence` | pass |
| C11 | `run int / ✓ blocks > unblocks the occurrences when the closure is deleted (FER-11)` | pass |
| C11 | `run int / ✓ blocks > blocks new dates and releases removed dates when the closure is edited (FER-11, FER-23)` | pass |
| C12 | `run int / ✓ block reconcile > keeps the occurrence blocked while another block covers the date (FER-12)` | pass |
| C12 | `run int / ✓ blocks > keeps the occurrence blocked when one of two overlapping blocks is removed (FER-12)` | pass |
| C13 | `run int / ✓ block reconcile > keeps a past blocked occurrence blocked when unblocking (FER-13)` | pass |
| C13 | `run unit / ✓ block transition (domain) > keeps a past blocked occurrence blocked` | pass |
| C14 | `run int / ✓ block reconcile > keeps the occurrence blocked when the slot weekday changed (FER-14)` | pass |
| C14 | `run unit / ✓ block transition (domain) > keeps the occurrence blocked when the weekday no longer matches` | pass |
| C15 | `run int / ✓ block reconcile > restores no booking when unblocking (FER-15)` | pass |
| C16 | `run int / ✓ blocks > lists holidays and studio closures (FER-16)` | pass |
| C16 | `walk - a tela /feriados lista os feriados com data e nome e os recessos com inicio, fim e motivo` | pass (Walked) |
| C17 | `run int / ✓ admin actions > creates a holiday from the block action and returns the outcome (FER-17)` | pass |
| C17 | `walk - cadastrar feriado na tela /feriados grava, bloqueia e apresenta o resultado da operacao` | pass (Walked) |
| C18 | `run int / ✓ admin actions > refuses a holiday on a duplicated date (FER-18)` | pass |
| C19 | `run int / ✓ blocks > moves the block when the holiday is edited (FER-19)` | pass |
| C19 | `run int / ✓ admin actions > edits a holiday from the block action and reprocesses the blocks (FER-19)` | pass |
| C20 | `run int / ✓ blocks > refuses to edit a holiday onto another holiday date (FER-20)` | pass |
| C21 | `run int / ✓ admin actions > creates a studio closure from the block action and returns the outcome (FER-21)` | pass |
| C21 | `walk - cadastrar recesso na tela /feriados grava, bloqueia e apresenta o resultado da operacao` | pass (Walked) |
| C22 | `run int / ✓ blocks > refuses a closure whose end is before its start (FER-22)` | pass |
| C22 | `run int / ✓ admin actions > refuses a closure with an end before the start (FER-22)` | pass |
| C23 | `run int / ✓ blocks > blocks new dates and releases removed dates when the closure is edited (FER-11, FER-23)` | pass |
| C23 | `run int / ✓ admin actions > edits a studio closure from the block action and reprocesses the blocks (FER-23)` | pass |
| C24 | `run int / ✓ admin actions > deletes a holiday from the block action and unblocks the occurrences (FER-24)` | pass |
| C24 | `walk - remover feriado na tela /feriados desbloqueia as ocorrencias e apresenta o resultado` | pass (Walked) |
| C25 | `run int / ✓ admin actions > deletes a studio closure from the block action and unblocks the occurrences (FER-2` | pass |
| C25 | `walk - remover recesso na tela /feriados desbloqueia as ocorrencias e apresenta o resultado` | pass (Walked) |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run int` - exit 0

```
 ✓ src/modules/bookings/services/__tests__/blocks.int.test.ts > block reconcile > keeps a past blocked occurrence blocked when unblocking (FER-13) 150ms
 ✓ src/modules/bookings/services/__tests__/blocks.int.test.ts > block reconcile > keeps the occurrence blocked when the slot weekday changed (FER-14) 174ms
 ✓ src/__tests__/seed.int.test.ts > seed > migration applies on the empty container 13ms
 ✓ src/__tests__/seed.int.test.ts > seed > the two PRD class types 52ms
 ✓ src/__tests__/seed.int.test.ts > seed > test students are loaded 21ms
 ✓ src/modules/bookings/services/__tests__/blocks.int.test.ts > block reconcile > restores no booking when unblocking (FER-15) 397ms

 Test Files  19 passed (19)
      Tests  142 passed (142)
   Start at  17:06:30
   Duration  157.99s (tests 85%, import 15%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run unit` - exit 0

```
 ✓ src/modules/bookings/domain/__tests__/blocks.test.ts > block transition (domain) > treats today as affected and yesterday as not 1ms
 ✓ src/modules/credits/domain/__tests__/credit-rules.test.ts > credit rules > measures the hours until the class start in the studio timezone 9ms
 ✓ src/modules/credits/domain/__tests__/credit-rules.test.ts > credit rules > treats exactly 24 hours as eligible 1ms
 ✓ src/modules/credits/domain/__tests__/credit-rules.test.ts > credit rules > treats 23 hours 59 minutes as not eligible 0ms
 ✓ src/modules/credits/domain/__tests__/credit-rules.test.ts > credit rules > sets the credit expiry 30 days after the generation 1ms
 ✓ src/__tests__/smoke.test.ts > smoke > runs the runner 4ms

 Test Files  8 passed (8)
      Tests  46 passed (46)
   Start at  17:09:12
   Duration  1.27s (import 54%, transform 19%, tests 14%, worker 13%, environment 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
