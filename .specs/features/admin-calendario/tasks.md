# Admin Calendario Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/admin-calendario/design.md` (aprovado)
**Spec**: `.specs/features/admin-calendario/spec.md` (aprovada, CAL-01..22)
**Status**: In Progress
**Approved**: 2026-11-14 - user: "Sim, pode executar"
**Build**: `npm run build; npm run lint`
**Run participants**: `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose`
**Run credits**: `npx vitest run src/modules/credits/services/__tests__/studio-cancellation.int.test.ts --reporter=verbose`
**Run bookings**: `npx vitest run src/modules/bookings/services/__tests__/bookings.int.test.ts --reporter=verbose`
**Run occ**: `npx vitest run src/modules/bookings/services/__tests__/occurrences.int.test.ts --reporter=verbose`
**Run class-blocks**: `npx vitest run src/modules/classes/services/__tests__/blocks.int.test.ts --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convenÃ§Ã£o registrada: `*.test.ts` unit, `*.int.test.ts` integration com Testcontainers); sem AGENTS.md - strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain puro (janelas do calendÃ¡rio, cobertura de bloqueio) | unit | Todas as janelas e ramos 1:1 com os ACs; regra com 2 branches provada nos dois (L-015) | `src/modules/bookings/domain/__tests__/*.test.ts` | `npx vitest run src/modules/bookings/domain --reporter=verbose` |
| DerivaÃ§Ã£o pura (participantes) | unit | Cada vÃ­nculo (fixo/reposiÃ§Ã£o/experimental) e o aviso (CRD-09) com teste prÃ³prio | `src/modules/bookings/services/__tests__/participants.test.ts` | `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose` |
| Services com banco (guardas, bloqueio turma/data, leitor em lote) | integration | Todas as regras novas 1:1 com os ACs; ramos provados nos dois lados; testes existentes nÃ£o enfraquecidos | `src/modules/**/__tests__/*.int.test.ts` | `npm test` |
| Kit UI (VacancyDucks) | unit | Prop `capacity` e default 8 provados | `src/modules/ui/__tests__/*.test.ts` | `npx vitest run src/modules/ui --reporter=verbose` |
| Telas (page, nav, vistas, painel) | none (build gate + walk) | Cada critÃ©rio de tela tem prova de walk ou de picture do juiz de telas | `src/app/(admin)/grade/**` | `npm run build; npm run lint` |
| Schema / migraÃ§Ã£o | none | - (build gate only) | `src/db/schema/**` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | ApÃ³s tasks sÃ³ com unit (T1, T4, T7, T9) | `npx vitest run src/modules/bookings/domain src/modules/bookings/services/__tests__/participants.test.ts src/modules/ui --reporter=verbose` |
| Full | ApÃ³s tasks com integration (o comum aqui) | `npm test` |
| Build | Tasks de tela, schema e fim de fase | `npm run build; npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: DomÃ­nio e guardas de servidor

Tasks independentes; execuÃ§Ã£o na ordem numÃ©rica.

```
T1 (independente)
T2 (independente)
```

### Phase 2: Bloqueio por turma/data (P2, servidor)

```
T3 (independente)
T3 -> T4
T3 -> T5
T4 -> T5
T5 -> T6
```

### Phase 3: Leitor em lote

```
T7 (independente)
T5 -> T8
T7 -> T8
```

### Phase 4: Telas

```
T9 (independente)
T1 -> T10
T8 -> T10
T9 -> T11
T10 -> T11
T2 -> T12
T10 -> T12
T6 -> T13
T12 -> T13
```

---

## Task Breakdown

### T1: Janelas do calendÃ¡rio (domÃ­nio puro)

**What**: `resolveCalendarWindow`, `weekStartOf`, `weekEndOf`, `monthBoundsOf` e o tipo `CalendarView` ("dia" | "semana" | "mes") com validaÃ§Ã£o â€” windowas diÃ¡ria (a data), semanal (segunda a domingo do calendÃ¡rio da data) e mensal (primeiro a Ãºltimo dia do mÃªs); view/data ausentes ou invÃ¡lidos devolvem `ok: false` para a pÃ¡gina cair no default.
**Where**: `src/modules/bookings/domain/calendar.ts` (novo) + `src/modules/bookings/domain/__tests__/calendar.test.ts`
**Depends on**: None
**Reuses**: `weekdayOf`, `addDays`, `isDatePast` de `src/modules/classes/domain/occurrences.ts`
**Requirement**: CAL-01..04, CAL-22 (matemÃ¡tica das janelas; a tela Ã© T10)

**Done when**:

- [x] `weekStartOf` devolve a segunda e `weekEndOf` o domingo da semana do calendÃ¡rio contendo a data (America/Sao_Paulo sÃ³ entra no `today` do chamador)
- [x] `monthBoundsOf` cobre o mÃªs inteiro, inclusive meses que comeÃ§am/terminam em qualquer dia da semana
- [x] `resolveCalendarWindow` recusa view desconhecida e data mal formada com `ok: false`
- [x] Testes unit provam cada janela e cada recusa
- [x] Gate check passes: `npx vitest run src/modules/bookings/domain --reporter=verbose`
- [x] Test count: testes de calendar.test.ts passam (nenhum teste apagado)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bookings): calendar window domain for day/week/month views`
**Status**: âœ… Complete

---

### T2: Guardas de ocorrÃªncia â€” passado (AD-045) e reserva em CANCELADA

**What**: (a) `cancelOccurrenceByStudio` recusa ocorrÃªncia com `sessionDate < todayInStudio(now)` com erro claro e sem alterar estado algum (CAL-15, AD-045); (b) reserva manual em ocorrÃªncia CANCELADA recusada com mensagem clara (CAL-17) â€” a guarda jÃ¡ existe em `bookings.ts:82`, o que falta Ã© o teste prÃ³prio (L-009); acrescentar guarda sÃ³ se faltar.
**Where**: `src/modules/credits/services/cancellations.ts`, `src/modules/bookings/services/bookings.ts` + `studio-cancellation.int.test.ts`, `bookings.int.test.ts`
**Depends on**: None
**Reuses**: `todayInStudio`, transaÃ§Ã£o com `SELECT FOR UPDATE` de `cancelOccurrence`
**Requirement**: CAL-15, CAL-17

**Done when**:

- [x] Teste prova o cancelamento no passado recusado: status, reservas e crÃ©ditos intocados
- [x] Teste prova o caminho da ediÃ§Ã£o de grade (`cancelOccurrenceByScheduleEdit` via `cancelFutureSessions`) continuando a cancelar â€” L-015, os dois caminhos
- [x] Teste prova a recusa de reserva em ocorrÃªncia CANCELADA
- [x] Testes existentes da suÃ­te continuam verdes (nenhum enfraquecido)
- [x] Gate check passes: `npm test`
- [x] Test count: suÃ­te completa verde (378 no inÃ­cio desta feature)

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): refuse studio cancellation on past occurrences`
**Status**: âœ… Complete

---

### T3: Tabela `class_date_blocks` (schema + migraÃ§Ã£o)

**What**: Tabela nova `class_date_blocks` â€” `id`, `class_slot_id` FK, `session_date date`, `reason text`, timestamps, unique `(class_slot_id, session_date)` â€” com schema Drizzle e migraÃ§Ã£o versionada aplicada.
**Where**: `src/db/schema/blocks.ts` (extender), `src/db/schema/index.ts`, migraÃ§Ã£o nova em `src/db/drizzle/`
**Depends on**: None
**Reuses**: padrÃ£o das tabelas `holidays`/`studio_closures` no mesmo arquivo
**Requirement**: CAL-18 (modelo)

**Done when**:

- [x] Schema exportado por `src/db/schema/index.ts`
- [x] MigraÃ§Ã£o gerada (`npm run db:generate`) e aplicada no banco local (`npm run db:migrate`, docker compose de pÃ© â€” AD-015)
- [x] `npm run build` limpo
- [x] Test count: n/a (schema â€” build gate)

**Tests**: none
**Gate**: build

**Commit**: `feat(db): class_date_blocks table for per-class date blocking`
**Status**: âœ… Complete

---

### T4: DomÃ­nio do bloqueio por slot

**What**: `BlockDate` ganha a variante `{ kind: "classSlot"; classSlotId; date }` e nova `isOccurrenceCoveredByBlocks(date, classSlotId, blocks)` â€” coberta = feriado/recesso na data OU bloqueio do slot na data; `resolveBlockTransition` fica intocado (recebe `isCovered` pronto).
**Where**: `src/modules/bookings/domain/blocks.ts` + `__tests__/blocks.test.ts`
**Depends on**: T3 (a variante referencia a tabela nova; sem ela o tipo nÃ£o compila com o schema)
**Reuses**: `isDateCoveredByBlocks`, `resolveBlockTransition` existentes
**Requirement**: CAL-18, CAL-21 (domÃ­nio)

**Done when**:

- [x] Cobertura combinada provada nos ramos (L-015): por feriado, por bloqueio do slot, por nenhum; dois bloqueios de slots diferentes na mesma data nÃ£o se contaminam
- [x] TransiÃ§Ãµes existentes seguem provadas (CANCELADA nunca muda; passado nunca muda â€” testes antigos verdes)
- [x] Gate check passes: `npx vitest run src/modules/bookings/domain --reporter=verbose`
- [x] Test count: blocks.test.ts inteiro verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bookings): slot-aware block coverage in the block domain`
**Status**: âœ… Complete

---

### T5: Cobertura estendida em `hasBlock` e no reconcÃ­lio

**What**: `hasBlock` lÃª tambÃ©m `class_date_blocks` do slot (ocorrÃªncia materializada nasce BLOQUEADA, CAL-18); variante de `hasBlock`/`materializeSession` aceitando bloqueios prÃ©-carregados (o leitor em lote carrega 1Ã—); `reconcileBlockedOccurrences` calcula a cobertura por ocorrÃªncia com `isOccurrenceCoveredByBlocks` e cancela reservas/devolve crÃ©dito RESERVADO como hoje (AD-026), desbloqueando por slot (AD-027).
**Where**: `src/modules/bookings/services/sessions.ts`, `src/modules/bookings/services/blocks.ts` + `blocks.int.test.ts`
**Depends on**: T3, T4
**Reuses**: `reconcileBlockedOccurrences`, `materializeSession` (onConflictDoNothing + releitura), `resolveBlockTransition`
**Requirement**: CAL-18, CAL-21 (serviÃ§o)

**Done when**:

- [x] Teste: bloqueio de slot na data â†’ materializaÃ§Ã£o da ocorrÃªncia nasce BLOQUEADA; outra turma no mesmo dia nasce AGENDADA
- [x] Teste: reconcÃ­lio bloqueia e desbloqueia somente as ocorrÃªncias do slot alvo
- [x] Testes existentes de feriado/recesso continuam verdes (nenhum enfraquecido)
- [x] Gate check passes: `npm test`
- [x] Test count: suÃ­te completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(bookings): class-date blocks in session materialization and reconcile`
**Status**: âœ… Complete

---

### T6: ServiÃ§os e actions de bloquear/desbloquear turma/data

**What**: `blockClassSlotDate` (valida slot existente e ATIVA; recusa duplicado; data passada aceita como registro histÃ³rico sem efeito â€” AD-029; dispara reconcÃ­lio da janela clamada para hoje), `unblockClassSlotDate` (remoÃ§Ã£o fÃ­sica â€” AD-033 â€” e reconcÃ­lio), `listClassDateBlocks(from, to)`; actions de admin com `adminContext`.
**Where**: `src/modules/classes/services/blocks.ts`, `src/modules/classes/actions.ts` + `src/modules/classes/services/__tests__/blocks.int.test.ts`
**Depends on**: T5
**Reuses**: padrÃ£o de `createHoliday`/`deleteHoliday` (clamp, minDate/maxDate), reconcÃ­lio de T5
**Requirement**: CAL-18, CAL-19, CAL-20, CAL-21

**Done when**:

- [x] CAL-18: bloquear torna as ocorrÃªncias da turma na data BLOQUEADAS, cancela as reservas ativas, devolve o crÃ©dito RESERVADO da reposiÃ§Ã£o com vencimento original e nÃ£o gera crÃ©dito de estÃºdio
- [x] CAL-19: remover o bloqueio devolve as cobertas de hoje em diante a AGENDADA e nÃ£o restaura as reservas canceladas
- [x] CAL-20: cancelamento pelo estÃºdio em ocorrÃªncia bloqueada por turma/data Ã© recusado com mensagem clara
- [x] CAL-21: com feriado E bloqueio de slot cobrindo, a data segue bloqueada; liberada somente quando nenhum cobre
- [x] Guarda de data passada: bloqueio registrado em data passada nÃ£o muda ocorrÃªncia alguma
- [x] Gate check passes: `npm test`
- [x] Test count: suÃ­te completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(classes): block and unblock a class slot on a specific date`
**Status**: âœ… Complete

---

### T7: ExtraÃ§Ã£o de `occurrenceParticipants`

**What**: mover `occurrenceParticipants` e `coversDate` da pÃ¡gina (`page.tsx:57-140`) para `src/modules/bookings/services/participants.ts`, sem mudar regra nenhuma â€” a mesma lista de vÃ­nculos e avisos (CRD-09, AD-022) servindo Ã s trÃªs vistas; a pÃ¡gina passa a importar.
**Where**: `src/modules/bookings/services/participants.ts` (novo), `src/app/(admin)/grade/page.tsx` (import), `src/modules/bookings/services/__tests__/participants.test.ts`
**Depends on**: None
**Reuses**: lÃ³gica literal de `page.tsx:70-140`
**Requirement**: CAL-10, CAL-11 (regra dos dados)

**Done when**:

- [x] Testes unit provam cada ramo: fixo pela cobertura do enrollment, avisado fora da lista, reposiÃ§Ã£o/experimental/fixo por reserva ATIVA, experimental APROVADA
- [x] A pÃ¡gina compila usando o mÃ³dulo novo e `npm run build` fica limpo
- [x] Gate check passes: quick gate
- [x] Test count: participants.test.ts verde

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(bookings): extract occurrence participants into a testable service`
**Status**: âœ… Complete

---

### T8: Leitor em lote `listOccurrences`

**What**: leitor que devolve todas as ocorrÃªncias da janela `[{from, to}]` com composiÃ§Ã£o, participantes, notices, status, capacidade e `classBlocked`, em nÃºmero fixo de queries: carrega bloqueios 1Ã—; enumera pares (slot ativo, data) pelo weekday; data passada lÃª somente sessÃµes existentes e omite a nunca-materializada (CAL-06, AD-008); hoje/futuro materializa os faltantes com insert mÃºltiplo `onConflictDoNothing` + releitura; bookings, experimentais, enrollments e crÃ©ditos da janela em uma query cada; composiÃ§Ã£o derivada com `getOccurrenceComposition`/`calculateComposition` (CAL-05, nenhuma regra nova).
**Where**: `src/modules/bookings/services/occurrences.ts` (novo), `sessions.ts` (variante com bloqueios prÃ©-carregados, de T5) + `__tests__/occurrences.int.test.ts`
**Depends on**: T5, T7
**Reuses**: `getOccurrenceComposition`, `materializeSession`, `occurrenceParticipants`, `listApprovedExperimentalsBySession`
**Requirement**: CAL-05, CAL-06, CAL-07 (dados)

**Done when**:

- [x] Teste: janela de N dias materializa exatamente as ocorrÃªncias dos dias Ãºteis de cada slot, idempotente em segunda chamada
- [x] CAL-05: contagens (fixos, reposiÃ§Ãµes, experimentais, vagas) idÃªnticas Ã s de `getComposition` para a mesma ocorrÃªncia â€” fonte Ãºnica
- [x] CAL-06: data passada sem sessÃ£o materializada Ã© omitida; com sessÃ£o, aparece com status real (CANCELADA/BLOQUEADA inclusos)
- [x] CAL-07: ocorrÃªncia coberta por bloqueio vem BLOQUEADA com `classBlocked`/fonte do bloqueio
- [x] Participantes e notices presentes nas rows (CRD-09)
- [x] Gate check passes: `npm test`
- [x] Test count: suÃ­te completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(bookings): batch occurrence reader for calendar windows`
**Status**: âœ… Complete

---

### T9: `VacancyDucks` com capacidade real

**What**: prop `capacity` (default 8) no `VacancyDucks` e o grid da grade passando `slot.capacity` â€” patinhos e aria-label deixam de assumir 8 fixo.
**Where**: `src/modules/ui/components/vacancy-ducks.tsx`, `src/app/(admin)/grade/booking-forms.tsx` + `vacancy-ducks.test.ts`
**Depends on**: None
**Reuses**: componente e testes existentes
**Requirement**: CAL-09 (vagas verdadeiras na composiÃ§Ã£o)

**Done when**:

- [x] Teste unit prova capacidade diferente de 8 e o default 8
- [x] Nenhum consumidor existente quebra (default preserva o comportamento)
- [x] Gate check passes: quick gate
- [x] Test count: kit verde

**Tests**: unit
**Gate**: quick

**Commit**: `fix(ui): vacancy ducks respect the slot capacity`
**Status**: âœ… Complete

---

### T10: PÃ¡gina dirigida por URL + CalendarNav + semana parametrizada

**What**: `page.tsx` lÃª `?view&data&ocorrencia`, resolve a janela com T1 (invÃ¡lido â†’ semana de hoje, renderizaÃ§Ã£o igual Ã  atual) e busca as ocorrÃªncias com `listOccurrences` de T8; `CalendarNav` server-rendered com abas DiÃ¡ria/Semanal/Mensal (default semanal), setas Â±1 dia/semana/mÃªs conforme a aba, seletor de data via GET-form e aÃ§Ã£o "Hoje" â€” sem limite de 7 dias (CAL-03/04/22); `GradeBoard` parametrizado pela janela e pela seleÃ§Ã£o vinda da URL.
**Where**: `src/app/(admin)/grade/page.tsx`, `src/app/(admin)/grade/calendar-nav.tsx` (novo), `booking-forms.tsx`
**Depends on**: T1, T8
**Reuses**: GradeBoard/TurmaPanel existentes, GET-form de `/creditos`, kit da marca (AD-041/042)
**Requirement**: CAL-01, CAL-03, CAL-04, CAL-09 (semana), CAL-22

**Done when**:

- [x] `/grade` sem parÃ¢metros renderiza a semana corrente como hoje (comportamento preservado)
- [x] Abas, setas e seletor constroem URLs corretas; navegar a D+14 renderiza a semana que o contÃ©m
- [x] Clicar em ocorrÃªncia seleciona via `?ocorrencia=` e sobrevive Ã  navegaÃ§Ã£o
- [x] `npm run build; npm run lint` limpos
- [x] Test count: n/a (tela â€” prova de walk nos checks)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): URL-driven calendar navigation with tabs, arrows and date picker`
**Status**: âœ… Complete

---

### T11: Vistas DiÃ¡ria e Mensal

**What**: `DayView` (coluna Ãºnica com as ocorrÃªncias do dia, mesma cÃ©lula/composiÃ§Ã£o do grid) e `MonthView` (grid de semanas do mÃªs; ocorrÃªncias do mÃªs em forma compacta com horÃ¡rio, turma, selo BLOQUEADA/CANCELADA e patinhos; dias fora do mÃªs sÃ³ desenham o calendÃ¡rio, sem ocorrÃªncia); a aba ativa renderiza a vista certa; seleÃ§Ã£o de ocorrÃªncia por URL nas trÃªs.
**Where**: `src/app/(admin)/grade/calendar-views.tsx` (novo) + wiring em `page.tsx`
**Depends on**: T9, T10
**Reuses**: cÃ©lulas/selos do `GradeBoard`, `VacancyDucks` de T9, kit
**Requirement**: CAL-02, CAL-07, CAL-08 (exibiÃ§Ã£o nas trÃªs vistas), CAL-09 (mensal/diÃ¡ria)

**Done when**:

- [x] Aba DiÃ¡ria mostra sÃ³ o dia da URL; Mensal mostra o mÃªs inteiro com as ocorrÃªncias do mÃªs
- [x] Selos de BLOQUEADA e CANCELADA visÃ­veis nas trÃªs vistas (com as ocorrÃªncias criadas pelos testes de bloqueio/cancelamento no banco de dev)
- [x] Sem overflow horizontal em 1280px nas trÃªs vistas
- [x] `npm run build; npm run lint` limpos
- [x] Test count: n/a (tela â€” walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): day and month calendar views`
**Status**: âœ… Complete

---

### T12: Painel em qualquer data â€” read-only no passado e resultado do cancelamento

**What**: o painel da ocorrÃªncia funciona nas trÃªs vistas: data passada renderiza read-only (participantes e histÃ³rico visÃ­veis, nenhum formulÃ¡rio â€” AD-029/AD-045); o formulÃ¡rio de cancelamento exibe o resultado da action com contadores (ocorrÃªncia cancelada, reservas canceladas, crÃ©ditos devolvidos, crÃ©ditos gerados â€” CAL-16) e a recusa da guarda do passado/bloqueada vira mensagem de erro no formulÃ¡rio.
**Where**: `src/app/(admin)/grade/booking-forms.tsx`
**Depends on**: T2, T10
**Reuses**: TurmaPanel/RosterGroup/OccurrenceForms, `useActionState`, `Toast`, `<p role="alert">`
**Requirement**: CAL-10, CAL-11, CAL-15 (tela), CAL-16

**Done when**:

- [x] Data passada: painel mostra vÃ­nculos e avisos, sem botÃ£o de agendar/cancelar
- [x] Cancelamento concluÃ­do exibe os quatro contadores do resultado
- [x] Recusas (passada, bloqueada) aparecem como mensagem de erro no formulÃ¡rio
- [x] `npm run build; npm run lint` limpos
- [x] Test count: n/a (tela â€” walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): occurrence panel with past read-only mode and cancellation result`
**Status**: âœ… Complete

---

### T13: UI do bloqueio de turma/data (P2)

**What**: botÃ£o "Bloquear nesta data" / "Remover bloqueio" no painel para ocorrÃªncia de hoje ou futura nÃ£o cancelada, chamando as actions de T6 com o mesmo padrÃ£o de feedback (`useActionState` + `router.refresh`).
**Where**: `src/app/(admin)/grade/booking-forms.tsx` + `src/modules/classes/actions.ts` (actions de T6)
**Depends on**: T6, T12
**Reuses**: OccurrenceForms, Toast, kit
**Requirement**: CAL-18, CAL-19 (tela)

**Done when**:

- [x] Bloquear/desbloquear persiste pelo painel e a ocorrÃªncia reflete BLOQUEADA/AGENDADA apÃ³s refresh
- [x] OcorrÃªncia passada ou cancelada nÃ£o oferece os botÃµes
- [x] `npm run build; npm run lint` limpos
- [x] Test count: n/a (tela â€” walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): block and unblock a class on a specific date from the panel`
**Status**: âœ… Complete

---

## Checks

**Run participants**: `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose`
**Run credits**: `npx vitest run src/modules/credits/services/__tests__/studio-cancellation.int.test.ts --reporter=verbose`
**Run bookings**: `npx vitest run src/modules/bookings/services/__tests__/bookings.int.test.ts --reporter=verbose`
**Run occ**: `npx vitest run src/modules/bookings/services/__tests__/occurrences.int.test.ts --reporter=verbose`
**Run class-blocks**: `npx vitest run src/modules/classes/services/__tests__/blocks.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - Logada, `/grade` sem parÃ¢metros renderiza a semana de calendÃ¡rio contendo hoje, cada ocorrÃªncia com horÃ¡rio, modalidade, fixos, reposiÃ§Ãµes, experimentais confirmadas e vagas (CAL-01)
Proof: walk - /grade logada abre a semana de hoje com as sete colunas Seg..Dom e as datas de segunda a domingo
Proof: walk - a ocorrencia concreta de terca de D+14 traz horario, modalidade, fixos, reposicoes, experimentais e vagas iguais ao banco

**C2** - As abas DiÃ¡ria, Semanal e Mensal renderizam as ocorrÃªncias da data, da semana e do mÃªs da data selecionada (CAL-02)
Proof: walk - as tres abas mostram so as ocorrencias do dia, da semana e do mes da data escolhida, com lista nao vazia no mes
Proof: walk - a grade mensal tem os sete cabecalhos Seg..Dom e cada celula cai no dia da semana da sua coluna

**C3** - As setas avanÃ§am e recuam exatamente um dia, uma semana ou um mÃªs conforme a aba ativa (CAL-03)
Proof: walk - com cada aba ativa, a seta muda ?data em +/-1 dia / +/-7 dias (segunda seguinte/anterior) / +/-1 mes, e a seta oposta volta pelo mesmo passo

**C4** - O seletor de data leva a qualquer data, incluindo D+14 e alÃ©m, sem limite de 7 dias (CAL-04)
Proof: walk - escolher a data de D+14 no seletor renderiza a ocorrÃªncia da turma daquela semana

**C5** - As contagens de toda visualizaÃ§Ã£o vÃªm da composiÃ§Ã£o fonte Ãºnica (RES-27), sem regra nova de cÃ¡lculo (CAL-05)
Proof: run occ | âœ“ occurrences > derives every count from the single composition source

**C6** - OcorrÃªncia passada nunca materializada Ã© omitida das trÃªs visualizaÃ§Ãµes (CAL-06, AD-008)
Proof: run occ | âœ“ occurrences > omits a past occurrence that was never materialized
Proof: walk - a data passada sem sessao materializada some das tres vistas: dia sem ocorrencia, coluna vazia na semana e mes sem o link dela

**C7** - OcorrÃªncia BLOQUEADA por feriado/recesso aparece marcada nas trÃªs visualizaÃ§Ãµes (CAL-07, AD-014)
Proof: walk - feriado cadastrado em /feriados para uma quarta aparece com selo de bloqueio nas vistas diaria, semanal e mensal
Proof: walk - recesso cadastrado em /feriados (02/12) aparece com selo de bloqueio nas vistas diaria, semanal e mensal

**C8** - OcorrÃªncia CANCELADA aparece com selo de cancelada nas trÃªs visualizaÃ§Ãµes (CAL-08)
Proof: walk - a ocorrencia de terca de D+14 cancelada pela tela aparece com selo de cancelada nas vistas diaria, semanal e mensal

**C9** - As vistas mantÃªm a composiÃ§Ã£o do guia da marca: patinhos mini por slot, tokens, bordas 2px e sem overflow horizontal em 1280px (CAL-09, BRAND-08, AD-041, AD-042)
Proof: walk - em 1280px as tres vistas ficam sem overflow horizontal (ate 1px), com os patinhos mini por slot e as bordas de 2px do container
Proof: browser captures/admin-calendario-semana.running.png

**C10** - O painel da ocorrÃªncia lista os participantes com o vÃ­nculo de cada um (fixo, reposiÃ§Ã£o, experimental) e mantÃ©m os registros de aviso de falta/cancelamento fora da lista de participantes (CAL-10, CRD-09, AD-022)
Proof: run participants | âœ“ participants > lists every participant with its link type and keeps the notices apart (avisos FALTA e CANCELADA ficam fora da lista)

**C11** - Clicar em um participante abre o cadastro do aluno em `/alunos/[id]` (CAL-11)
Proof: walk - clicar num participante fixo navega para /alunos/<id>
Proof: walk - a reposicao de uma aluna fora do fixo da turma aparece no grupo Reposicao e o link dela abre /alunos/<id>

**C12** - Cancelamento pelo estÃºdio de ocorrÃªncia de hoje/futura: a ocorrÃªncia fica CANCELADA e as reservas ativas sÃ£o canceladas com cancelledBy ESTUDIO (CAL-12, CRD-28)
Proof: run credits | âœ“ studio cancellation > cancels the occurrence and its active bookings
Proof: run credits | âœ“ studio cancellation > cancels the occurrence of today and its active bookings

**C23** - Cada aluno fixo afetado pelo cancelamento recebe 1 crÃ©dito CANCELAMENTO_ESTUDIO (CAL-12, AD-017, AD-025)
Proof: run credits | âœ“ studio cancellation > grants one credit per affected fixed student

**C24** - O crÃ©dito RESERVADO da reposiÃ§Ã£o volta a DISPONIVEL com o vencimento original (CAL-12, AD-020)
Proof: run credits | âœ“ studio cancellation > returns the makeup credit to DISPONIVEL

**C13** - Cancelar a mesma ocorrÃªncia novamente nÃ£o duplica crÃ©dito nem altera reservas jÃ¡ canceladas (CAL-13, CRD-31/33)
Proof: run credits | âœ“ studio cancellation > grants no duplicate credit when the cancellation repeats

**C14** - Cancelamento em ocorrÃªncia BLOQUEADA por feriado/recesso Ã© recusado com mensagem clara (CAL-14, FER-09, AD-031)
Proof: run credits | âœ“ studio cancellation > refuses the cancellation of a blocked occurrence by feriado (FER-09)
Proof: run credits | âœ“ studio cancellation > refuses the cancellation of a blocked occurrence by recesso (FER-09)

**C15** - Cancelamento em ocorrÃªncia de data passada Ã© recusado com mensagem clara, sem alterar estado algum (CAL-15, AD-045)
Proof: run credits | âœ“ studio cancellation > refuses the cancellation of a past occurrence (AD-045), com cardinalidade de sessoes, reservas, creditos e transacoes igual antes e depois

**C16** - ApÃ³s cancelar, a tela exibe o resultado: ocorrÃªncia cancelada, reservas canceladas, crÃ©ditos devolvidos e crÃ©ditos gerados (CAL-16)
Proof: walk - cancelar uma ocorrencia futura mostra os quatro contadores no formulario
Proof: walk - os quatro numeros da mensagem batem com o banco: sessao CANCELADA, reservas CANCELADA/ESTUDIO, transacoes DEVOLUCAO e creditos CANCELAMENTO_ESTUDIO

**C17** - OcorrÃªncia CANCELADA recusa novas reservas (CAL-17)
Proof: run bookings | âœ“ bookings > refuses a booking on a cancelled occurrence

**C18** - Bloquear uma turma em uma data: ocorrÃªncias BLOQUEADAS, reservas ativas canceladas, crÃ©dito RESERVADO da reposiÃ§Ã£o devolvido e nenhum crÃ©dito de estÃºdio (CAL-18, AD-026, AD-032)
Proof: run class-blocks | âœ“ blocks > blocks a class slot on the date without granting studio credits (CAL-18)

**C19** - Remover o bloqueio: cobertas de hoje em diante voltam a AGENDADA e as reservas canceladas pelo bloqueio nÃ£o sÃ£o restauradas (CAL-19, AD-027)
Proof: run class-blocks | âœ“ blocks > unblocks the class slot without restoring cancelled bookings (CAL-19)
Proof: run class-blocks | âœ“ blocks > unblocks the class slot of today without restoring cancelled bookings (CAL-19)

**C20** - Cancelamento pelo estÃºdio em ocorrÃªncia bloqueada por turma/data Ã© recusado com mensagem clara (CAL-20, AD-031)
Proof: run class-blocks | âœ“ blocks > refuses studio cancellation while the class slot is blocked (CAL-20)

**C21** - Enquanto qualquer bloqueio (feriado, recesso ou turma/data) cobre a data a ocorrÃªncia segue BLOQUEADA e desbloqueia somente quando nenhum cobre (CAL-21, AD-028)
Proof: run class-blocks | âœ“ blocks > keeps the occurrence blocked while any block covers the date (CAL-21)
Proof: run class-blocks | âœ“ blocks > keeps the occurrence blocked while a closure covers the date (CAL-21)

**C22** - A aÃ§Ã£o "Hoje" renderiza a janela da aba ativa contendo a data de hoje (CAL-22)
Proof: walk - partindo de uma data distante, "Hoje" nas tres abas volta ?data para hoje e desenha a janela corrente do dia, da semana e do mes

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-14 - user: "Sim, pode executar" (aprova as tasks); user: "2 workers por lote (Recommended)" (aprova a delegacao em 2 lotes)
**Dispatched:** Batch 1 (Fases 1-2, T1-T6) -> worker batch-1, HEAD 014ac9d, returned (6 tasks, 403 testes verdes, 6 commits: 07f294d, 5b633c2, 2358177, 7947050, abb0e6c, 3135644); Batch 2 (Fases 3-4, T7-T13) -> worker batch-2, HEAD 3135644, returned (7 tasks, 414 testes verdes, 7 commits: 4e75d01, d4b625e, f25c52e, 800519b, c52270d, 6cca0c9, 3091c1d); Verifier + juiz de telas -> sub-agentes independentes, HEAD c4eee69, diff 014ac9d..c4eee69, returned (Verifier FAIL com 21 findings; juiz de telas Round 1: 2/2 matches)
**Walked:** 2026-11-14 - walk em chromium headless (playwright-core) contra o dev server na 3001, 66/66 asserts, capturas fullPage em 1440x900. P1 vistas - /grade sem parametros abre a semana de hoje com as sete colunas Seg..Dom de 09/11 a 15/11 e a terca materializada 10/11 na coluna certa; a aba Mensal desenha 42 celulas desde 2026-10-26 com os sete cabecalhos alinhados ao dia da semana de cada celula (CAL-08); a aba Diaria mostra so o dia e as setas andam +/-1 dia, +/-7 dias e +/-1 mes, voltando pelo mesmo passo; o seletor leva a D+14 (2026-11-28) e a ocorrencia concreta de terca 24/11 traz 19h, Superioga Intenso, 5 fixos, 1 reposicao, 1 experimental e 1 vaga livre, iguais ao banco (CAL-01, CAL-05). P1 participantes - o painel de 24/11 lista fixos, reposicao e experimental com a composicao do banco; clicar num fixo abre /alunos/<id>; a reposicao e de uma aluna fora do fixo da turma, aparece no grupo Reposicao e o link dela abre /alunos/<id> (CAL-10, CAL-11). P1 selos - feriado cadastrado em /feriados para quarta 18/11 e recesso para 02/12 aparecem com selo de bloqueio na diaria, na semanal e na mensal (CAL-07). P1 cancelamento - cancelar a ocorrencia de terca 24/11 mostra "Ocorrencia cancelada: 1. Reservas canceladas: 1. Creditos devolvidos: 1. Creditos gerados: 5."; os quatro numeros batem com o banco (sessao CANCELADA, reserva CANCELADA/ESTUDIO, transacao DEVOLUCAO do credito e 5 creditos CANCELAMENTO_ESTUDIO) e o selo CANCELADA aparece nas tres vistas (CAL-08, CAL-12, CAL-16). P2 bloqueio - na quinta 19/11 "Bloquear nesta data" deixa a ocorrencia BLOQUEADA, cancela a reserva ativa, devolve o credito a DISPONIVEL e nao gera credito de estudio; "Cancelar aula" e recusado; "Remover bloqueio" volta a AGENDADA sem restaurar a reserva (CAL-18..CAL-21). Passado - a ocorrencia passada abre o painel com participantes e sem reservar/cancelar; a data 06/10 sem sessao materializada some da diaria, da semanal e da mensal (CAL-06, CAL-15). P3 - "Hoje" nas tres abas volta para 2026-11-14 com a janela corrente de cada uma (CAL-22). CAL-09 - em 1280px as tres vistas ficam sem overflow (0px), com patinhos mini e bordas 2px; nenhum erro de console e nenhum recurso faltando. Capturas: captures/admin-calendario-semana.running.png (semana de 16/11 com o bloco na quarta) e captures/admin-calendario-painel.running.png (painel da terca 24/11). Dados do cenario: 5 alunas "Walk Calendario 1..5" (1..4 fixas na terca 19h, a 5 na reposicao), 1 experimental aprovada em 24/11, a turma de quinta 19h (Intenso), o feriado em 18/11 e o recesso em 02/12; o script recria o cenario no inicio e devolve a composicao de terca no fim.

---

## Phase Execution Map

```
Phase 1 â†’ Phase 2 â†’ Phase 3 â†’ Phase 4

Phase 1:  T1, T2
Phase 2:  T3, T4, T5, T6
Phase 3:  T7, T8
Phase 4:  T9, T10, T11, T12, T13
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**Batching**: 13 tasks â†’ 2 batches: Batch 1 = Phases 1-3 (T1-T8), Batch 2 = Phase 4 (T9-T13). Offer-then-confirm before dispatching any worker.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 arquivo de domÃ­nio + testes | âœ… Granular |
| T2 | 2 guardas coesas (estado da ocorrÃªncia) em 2 services | âš ï¸ coeso - mesma regra de ocorrÃªncia |
| T3 | 1 tabela (schema + migraÃ§Ã£o) | âœ… Granular |
| T4 | 1 funÃ§Ã£o de domÃ­nio + testes | âœ… Granular |
| T5 | 2 services de um mesmo mÃ³dulo (cobertura) | âš ï¸ coeso - um mecanismo |
| T6 | 3 funÃ§Ãµes de um service + actions | âš ï¸ coeso - CRUD de um recurso |
| T7 | 1 extraÃ§Ã£o (1 arquivo + import) | âœ… Granular |
| T8 | 1 service novo + testes | âœ… Granular |
| T9 | 1 componente + 1 chamador | âœ… Granular |
| T10 | page + nav + parametrizaÃ§Ã£o do grid | âš ï¸ coeso - um wire-up |
| T11 | 2 vistas em 1 arquivo novo | âš ï¸ coeso - mesmas cÃ©lulas |
| T12 | 1 arquivo (painel) | âœ… Granular |
| T13 | 1 arquivo + actions | âœ… Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | inÃ­cio da Phase 1 | âœ… Match |
| T2 | None | Phase 1 apÃ³s T1 (ordem numÃ©rica, sem dep) | âœ… Match |
| T3 | None | inÃ­cio da Phase 2 | âœ… Match |
| T4 | T3 | T3 â†’ T4 | âœ… Match |
| T5 | T3, T4 | T4 â†’ T5 (T3 Ã© ancestral de T4) | âœ… Match |
| T6 | T5 | T5 â†’ T6 | âœ… Match |
| T7 | None | inÃ­cio da Phase 3 | âœ… Match |
| T8 | T5, T7 | nota "T8 â† T5, T7" | âœ… Match |
| T9 | None | inÃ­cio da Phase 4 | âœ… Match |
| T10 | T1, T8 | nota "T10 â† T1, T8" | âœ… Match |
| T11 | T9, T10 | nota "T11 â† T9, T10" | âœ… Match |
| T12 | T2, T10 | nota "T12 â† T2, T10" | âœ… Match |
| T13 | T6, T12 | nota "T13 â† T6, T12" | âœ… Match |

Nenhuma dependÃªncia aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domain puro | unit | unit | âœ… OK |
| T2 | Service com banco | integration | integration | âœ… OK |
| T3 | Schema / migraÃ§Ã£o | none | none | âœ… OK |
| T4 | Domain puro | unit | unit | âœ… OK |
| T5 | Service com banco | integration | integration | âœ… OK |
| T6 | Service com banco | integration | integration | âœ… OK |
| T7 | DerivaÃ§Ã£o pura | unit | unit | âœ… OK |
| T8 | Service com banco | integration | integration | âœ… OK |
| T9 | Kit UI | unit | unit | âœ… OK |
| T10 | Tela | none (build + walk) | none | âœ… OK |
| T11 | Tela | none (build + walk) | none | âœ… OK |
| T12 | Tela | none (build + walk) | none | âœ… OK |
| T13 | Tela | none (build + walk) | none | âœ… OK |
