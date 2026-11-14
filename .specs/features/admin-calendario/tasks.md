# Admin Calendario Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/admin-calendario/design.md` (aprovado)
**Spec**: `.specs/features/admin-calendario/spec.md` (aprovada, CAL-01..22)
**Status**: Approved
**Approved**: 2026-11-14 - user: "Sim, pode executar"
**Build**: `npm run build; npm run lint`
**Run participants**: `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose`
**Run credits**: `npx vitest run src/modules/credits/services/__tests__/studio-cancellation.int.test.ts --reporter=verbose`
**Run bookings**: `npx vitest run src/modules/bookings/services/__tests__/bookings.int.test.ts --reporter=verbose`
**Run occ**: `npx vitest run src/modules/bookings/services/__tests__/occurrences.int.test.ts --reporter=verbose`
**Run class-blocks**: `npx vitest run src/modules/classes/services/__tests__/blocks.int.test.ts --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convenção registrada: `*.test.ts` unit, `*.int.test.ts` integration com Testcontainers); sem AGENTS.md - strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain puro (janelas do calendário, cobertura de bloqueio) | unit | Todas as janelas e ramos 1:1 com os ACs; regra com 2 branches provada nos dois (L-015) | `src/modules/bookings/domain/__tests__/*.test.ts` | `npx vitest run src/modules/bookings/domain --reporter=verbose` |
| Derivação pura (participantes) | unit | Cada vínculo (fixo/reposição/experimental) e o aviso (CRD-09) com teste próprio | `src/modules/bookings/services/__tests__/participants.test.ts` | `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose` |
| Services com banco (guardas, bloqueio turma/data, leitor em lote) | integration | Todas as regras novas 1:1 com os ACs; ramos provados nos dois lados; testes existentes não enfraquecidos | `src/modules/**/__tests__/*.int.test.ts` | `npm test` |
| Kit UI (VacancyDucks) | unit | Prop `capacity` e default 8 provados | `src/modules/ui/__tests__/*.test.ts` | `npx vitest run src/modules/ui --reporter=verbose` |
| Telas (page, nav, vistas, painel) | none (build gate + walk) | Cada critério de tela tem prova de walk ou de picture do juiz de telas | `src/app/(admin)/grade/**` | `npm run build; npm run lint` |
| Schema / migração | none | - (build gate only) | `src/db/schema/**` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit (T1, T4, T7, T9) | `npx vitest run src/modules/bookings/domain src/modules/bookings/services/__tests__/participants.test.ts src/modules/ui --reporter=verbose` |
| Full | Após tasks com integration (o comum aqui) | `npm test` |
| Build | Tasks de tela, schema e fim de fase | `npm run build; npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Domínio e guardas de servidor

Tasks independentes; execução na ordem numérica.

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

### T1: Janelas do calendário (domínio puro)

**What**: `resolveCalendarWindow`, `weekStartOf`, `weekEndOf`, `monthBoundsOf` e o tipo `CalendarView` ("dia" | "semana" | "mes") com validação — windowas diária (a data), semanal (segunda a domingo do calendário da data) e mensal (primeiro a último dia do mês); view/data ausentes ou inválidos devolvem `ok: false` para a página cair no default.
**Where**: `src/modules/bookings/domain/calendar.ts` (novo) + `src/modules/bookings/domain/__tests__/calendar.test.ts`
**Depends on**: None
**Reuses**: `weekdayOf`, `addDays`, `isDatePast` de `src/modules/classes/domain/occurrences.ts`
**Requirement**: CAL-01..04, CAL-22 (matemática das janelas; a tela é T10)

**Done when**:

- [x] `weekStartOf` devolve a segunda e `weekEndOf` o domingo da semana do calendário contendo a data (America/Sao_Paulo só entra no `today` do chamador)
- [x] `monthBoundsOf` cobre o mês inteiro, inclusive meses que começam/terminam em qualquer dia da semana
- [x] `resolveCalendarWindow` recusa view desconhecida e data mal formada com `ok: false`
- [x] Testes unit provam cada janela e cada recusa
- [x] Gate check passes: `npx vitest run src/modules/bookings/domain --reporter=verbose`
- [x] Test count: testes de calendar.test.ts passam (nenhum teste apagado)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bookings): calendar window domain for day/week/month views`
**Status**: ✅ Complete

---

### T2: Guardas de ocorrência — passado (AD-045) e reserva em CANCELADA

**What**: (a) `cancelOccurrenceByStudio` recusa ocorrência com `sessionDate < todayInStudio(now)` com erro claro e sem alterar estado algum (CAL-15, AD-045); (b) reserva manual em ocorrência CANCELADA recusada com mensagem clara (CAL-17) — a guarda já existe em `bookings.ts:82`, o que falta é o teste próprio (L-009); acrescentar guarda só se faltar.
**Where**: `src/modules/credits/services/cancellations.ts`, `src/modules/bookings/services/bookings.ts` + `studio-cancellation.int.test.ts`, `bookings.int.test.ts`
**Depends on**: None
**Reuses**: `todayInStudio`, transação com `SELECT FOR UPDATE` de `cancelOccurrence`
**Requirement**: CAL-15, CAL-17

**Done when**:

- [x] Teste prova o cancelamento no passado recusado: status, reservas e créditos intocados
- [x] Teste prova o caminho da edição de grade (`cancelOccurrenceByScheduleEdit` via `cancelFutureSessions`) continuando a cancelar — L-015, os dois caminhos
- [x] Teste prova a recusa de reserva em ocorrência CANCELADA
- [x] Testes existentes da suíte continuam verdes (nenhum enfraquecido)
- [x] Gate check passes: `npm test`
- [x] Test count: suíte completa verde (378 no início desta feature)

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): refuse studio cancellation on past occurrences`
**Status**: ✅ Complete

---

### T3: Tabela `class_date_blocks` (schema + migração)

**What**: Tabela nova `class_date_blocks` — `id`, `class_slot_id` FK, `session_date date`, `reason text`, timestamps, unique `(class_slot_id, session_date)` — com schema Drizzle e migração versionada aplicada.
**Where**: `src/db/schema/blocks.ts` (extender), `src/db/schema/index.ts`, migração nova em `src/db/drizzle/`
**Depends on**: None
**Reuses**: padrão das tabelas `holidays`/`studio_closures` no mesmo arquivo
**Requirement**: CAL-18 (modelo)

**Done when**:

- [x] Schema exportado por `src/db/schema/index.ts`
- [x] Migração gerada (`npm run db:generate`) e aplicada no banco local (`npm run db:migrate`, docker compose de pé — AD-015)
- [x] `npm run build` limpo
- [x] Test count: n/a (schema — build gate)

**Tests**: none
**Gate**: build

**Commit**: `feat(db): class_date_blocks table for per-class date blocking`
**Status**: ✅ Complete

---

### T4: Domínio do bloqueio por slot

**What**: `BlockDate` ganha a variante `{ kind: "classSlot"; classSlotId; date }` e nova `isOccurrenceCoveredByBlocks(date, classSlotId, blocks)` — coberta = feriado/recesso na data OU bloqueio do slot na data; `resolveBlockTransition` fica intocado (recebe `isCovered` pronto).
**Where**: `src/modules/bookings/domain/blocks.ts` + `__tests__/blocks.test.ts`
**Depends on**: T3 (a variante referencia a tabela nova; sem ela o tipo não compila com o schema)
**Reuses**: `isDateCoveredByBlocks`, `resolveBlockTransition` existentes
**Requirement**: CAL-18, CAL-21 (domínio)

**Done when**:

- [x] Cobertura combinada provada nos ramos (L-015): por feriado, por bloqueio do slot, por nenhum; dois bloqueios de slots diferentes na mesma data não se contaminam
- [x] Transições existentes seguem provadas (CANCELADA nunca muda; passado nunca muda — testes antigos verdes)
- [x] Gate check passes: `npx vitest run src/modules/bookings/domain --reporter=verbose`
- [x] Test count: blocks.test.ts inteiro verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bookings): slot-aware block coverage in the block domain`
**Status**: ✅ Complete

---

### T5: Cobertura estendida em `hasBlock` e no reconcílio

**What**: `hasBlock` lê também `class_date_blocks` do slot (ocorrência materializada nasce BLOQUEADA, CAL-18); variante de `hasBlock`/`materializeSession` aceitando bloqueios pré-carregados (o leitor em lote carrega 1×); `reconcileBlockedOccurrences` calcula a cobertura por ocorrência com `isOccurrenceCoveredByBlocks` e cancela reservas/devolve crédito RESERVADO como hoje (AD-026), desbloqueando por slot (AD-027).
**Where**: `src/modules/bookings/services/sessions.ts`, `src/modules/bookings/services/blocks.ts` + `blocks.int.test.ts`
**Depends on**: T3, T4
**Reuses**: `reconcileBlockedOccurrences`, `materializeSession` (onConflictDoNothing + releitura), `resolveBlockTransition`
**Requirement**: CAL-18, CAL-21 (serviço)

**Done when**:

- [x] Teste: bloqueio de slot na data → materialização da ocorrência nasce BLOQUEADA; outra turma no mesmo dia nasce AGENDADA
- [x] Teste: reconcílio bloqueia e desbloqueia somente as ocorrências do slot alvo
- [x] Testes existentes de feriado/recesso continuam verdes (nenhum enfraquecido)
- [x] Gate check passes: `npm test`
- [x] Test count: suíte completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(bookings): class-date blocks in session materialization and reconcile`
**Status**: ✅ Complete

---

### T6: Serviços e actions de bloquear/desbloquear turma/data

**What**: `blockClassSlotDate` (valida slot existente e ATIVA; recusa duplicado; data passada aceita como registro histórico sem efeito — AD-029; dispara reconcílio da janela clamada para hoje), `unblockClassSlotDate` (remoção física — AD-033 — e reconcílio), `listClassDateBlocks(from, to)`; actions de admin com `adminContext`.
**Where**: `src/modules/classes/services/blocks.ts`, `src/modules/classes/actions.ts` + `src/modules/classes/services/__tests__/blocks.int.test.ts`
**Depends on**: T5
**Reuses**: padrão de `createHoliday`/`deleteHoliday` (clamp, minDate/maxDate), reconcílio de T5
**Requirement**: CAL-18, CAL-19, CAL-20, CAL-21

**Done when**:

- [x] CAL-18: bloquear torna as ocorrências da turma na data BLOQUEADAS, cancela as reservas ativas, devolve o crédito RESERVADO da reposição com vencimento original e não gera crédito de estúdio
- [x] CAL-19: remover o bloqueio devolve as cobertas de hoje em diante a AGENDADA e não restaura as reservas canceladas
- [x] CAL-20: cancelamento pelo estúdio em ocorrência bloqueada por turma/data é recusado com mensagem clara
- [x] CAL-21: com feriado E bloqueio de slot cobrindo, a data segue bloqueada; liberada somente quando nenhum cobre
- [x] Guarda de data passada: bloqueio registrado em data passada não muda ocorrência alguma
- [x] Gate check passes: `npm test`
- [x] Test count: suíte completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(classes): block and unblock a class slot on a specific date`
**Status**: ✅ Complete

---

### T7: Extração de `occurrenceParticipants`

**What**: mover `occurrenceParticipants` e `coversDate` da página (`page.tsx:57-140`) para `src/modules/bookings/services/participants.ts`, sem mudar regra nenhuma — a mesma lista de vínculos e avisos (CRD-09, AD-022) servindo às três vistas; a página passa a importar.
**Where**: `src/modules/bookings/services/participants.ts` (novo), `src/app/(admin)/grade/page.tsx` (import), `src/modules/bookings/services/__tests__/participants.test.ts`
**Depends on**: None
**Reuses**: lógica literal de `page.tsx:70-140`
**Requirement**: CAL-10, CAL-11 (regra dos dados)

**Done when**:

- [x] Testes unit provam cada ramo: fixo pela cobertura do enrollment, avisado fora da lista, reposição/experimental/fixo por reserva ATIVA, experimental APROVADA
- [x] A página compila usando o módulo novo e `npm run build` fica limpo
- [x] Gate check passes: quick gate
- [x] Test count: participants.test.ts verde

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(bookings): extract occurrence participants into a testable service`
**Status**: ✅ Complete

---

### T8: Leitor em lote `listOccurrences`

**What**: leitor que devolve todas as ocorrências da janela `[{from, to}]` com composição, participantes, notices, status, capacidade e `classBlocked`, em número fixo de queries: carrega bloqueios 1×; enumera pares (slot ativo, data) pelo weekday; data passada lê somente sessões existentes e omite a nunca-materializada (CAL-06, AD-008); hoje/futuro materializa os faltantes com insert múltiplo `onConflictDoNothing` + releitura; bookings, experimentais, enrollments e créditos da janela em uma query cada; composição derivada com `getOccurrenceComposition`/`calculateComposition` (CAL-05, nenhuma regra nova).
**Where**: `src/modules/bookings/services/occurrences.ts` (novo), `sessions.ts` (variante com bloqueios pré-carregados, de T5) + `__tests__/occurrences.int.test.ts`
**Depends on**: T5, T7
**Reuses**: `getOccurrenceComposition`, `materializeSession`, `occurrenceParticipants`, `listApprovedExperimentalsBySession`
**Requirement**: CAL-05, CAL-06, CAL-07 (dados)

**Done when**:

- [x] Teste: janela de N dias materializa exatamente as ocorrências dos dias úteis de cada slot, idempotente em segunda chamada
- [x] CAL-05: contagens (fixos, reposições, experimentais, vagas) idênticas às de `getComposition` para a mesma ocorrência — fonte única
- [x] CAL-06: data passada sem sessão materializada é omitida; com sessão, aparece com status real (CANCELADA/BLOQUEADA inclusos)
- [x] CAL-07: ocorrência coberta por bloqueio vem BLOQUEADA com `classBlocked`/fonte do bloqueio
- [x] Participantes e notices presentes nas rows (CRD-09)
- [x] Gate check passes: `npm test`
- [x] Test count: suíte completa verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(bookings): batch occurrence reader for calendar windows`
**Status**: ✅ Complete

---

### T9: `VacancyDucks` com capacidade real

**What**: prop `capacity` (default 8) no `VacancyDucks` e o grid da grade passando `slot.capacity` — patinhos e aria-label deixam de assumir 8 fixo.
**Where**: `src/modules/ui/components/vacancy-ducks.tsx`, `src/app/(admin)/grade/booking-forms.tsx` + `vacancy-ducks.test.ts`
**Depends on**: None
**Reuses**: componente e testes existentes
**Requirement**: CAL-09 (vagas verdadeiras na composição)

**Done when**:

- [x] Teste unit prova capacidade diferente de 8 e o default 8
- [x] Nenhum consumidor existente quebra (default preserva o comportamento)
- [x] Gate check passes: quick gate
- [x] Test count: kit verde

**Tests**: unit
**Gate**: quick

**Commit**: `fix(ui): vacancy ducks respect the slot capacity`
**Status**: ✅ Complete

---

### T10: Página dirigida por URL + CalendarNav + semana parametrizada

**What**: `page.tsx` lê `?view&data&ocorrencia`, resolve a janela com T1 (inválido → semana de hoje, renderização igual à atual) e busca as ocorrências com `listOccurrences` de T8; `CalendarNav` server-rendered com abas Diária/Semanal/Mensal (default semanal), setas ±1 dia/semana/mês conforme a aba, seletor de data via GET-form e ação "Hoje" — sem limite de 7 dias (CAL-03/04/22); `GradeBoard` parametrizado pela janela e pela seleção vinda da URL.
**Where**: `src/app/(admin)/grade/page.tsx`, `src/app/(admin)/grade/calendar-nav.tsx` (novo), `booking-forms.tsx`
**Depends on**: T1, T8
**Reuses**: GradeBoard/TurmaPanel existentes, GET-form de `/creditos`, kit da marca (AD-041/042)
**Requirement**: CAL-01, CAL-03, CAL-04, CAL-09 (semana), CAL-22

**Done when**:

- [ ] `/grade` sem parâmetros renderiza a semana corrente como hoje (comportamento preservado)
- [ ] Abas, setas e seletor constroem URLs corretas; navegar a D+14 renderiza a semana que o contém
- [ ] Clicar em ocorrência seleciona via `?ocorrencia=` e sobrevive à navegação
- [ ] `npm run build; npm run lint` limpos
- [ ] Test count: n/a (tela — prova de walk nos checks)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): URL-driven calendar navigation with tabs, arrows and date picker`

---

### T11: Vistas Diária e Mensal

**What**: `DayView` (coluna única com as ocorrências do dia, mesma célula/composição do grid) e `MonthView` (grid de semanas do mês; ocorrências do mês em forma compacta com horário, turma, selo BLOQUEADA/CANCELADA e patinhos; dias fora do mês só desenham o calendário, sem ocorrência); a aba ativa renderiza a vista certa; seleção de ocorrência por URL nas três.
**Where**: `src/app/(admin)/grade/calendar-views.tsx` (novo) + wiring em `page.tsx`
**Depends on**: T9, T10
**Reuses**: células/selos do `GradeBoard`, `VacancyDucks` de T9, kit
**Requirement**: CAL-02, CAL-07, CAL-08 (exibição nas três vistas), CAL-09 (mensal/diária)

**Done when**:

- [ ] Aba Diária mostra só o dia da URL; Mensal mostra o mês inteiro com as ocorrências do mês
- [ ] Selos de BLOQUEADA e CANCELADA visíveis nas três vistas (com as ocorrências criadas pelos testes de bloqueio/cancelamento no banco de dev)
- [ ] Sem overflow horizontal em 1280px nas três vistas
- [ ] `npm run build; npm run lint` limpos
- [ ] Test count: n/a (tela — walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): day and month calendar views`

---

### T12: Painel em qualquer data — read-only no passado e resultado do cancelamento

**What**: o painel da ocorrência funciona nas três vistas: data passada renderiza read-only (participantes e histórico visíveis, nenhum formulário — AD-029/AD-045); o formulário de cancelamento exibe o resultado da action com contadores (ocorrência cancelada, reservas canceladas, créditos devolvidos, créditos gerados — CAL-16) e a recusa da guarda do passado/bloqueada vira mensagem de erro no formulário.
**Where**: `src/app/(admin)/grade/booking-forms.tsx`
**Depends on**: T2, T10
**Reuses**: TurmaPanel/RosterGroup/OccurrenceForms, `useActionState`, `Toast`, `<p role="alert">`
**Requirement**: CAL-10, CAL-11, CAL-15 (tela), CAL-16

**Done when**:

- [ ] Data passada: painel mostra vínculos e avisos, sem botão de agendar/cancelar
- [ ] Cancelamento concluído exibe os quatro contadores do resultado
- [ ] Recusas (passada, bloqueada) aparecem como mensagem de erro no formulário
- [ ] `npm run build; npm run lint` limpos
- [ ] Test count: n/a (tela — walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): occurrence panel with past read-only mode and cancellation result`

---

### T13: UI do bloqueio de turma/data (P2)

**What**: botão "Bloquear nesta data" / "Remover bloqueio" no painel para ocorrência de hoje ou futura não cancelada, chamando as actions de T6 com o mesmo padrão de feedback (`useActionState` + `router.refresh`).
**Where**: `src/app/(admin)/grade/booking-forms.tsx` + `src/modules/classes/actions.ts` (actions de T6)
**Depends on**: T6, T12
**Reuses**: OccurrenceForms, Toast, kit
**Requirement**: CAL-18, CAL-19 (tela)

**Done when**:

- [ ] Bloquear/desbloquear persiste pelo painel e a ocorrência reflete BLOQUEADA/AGENDADA após refresh
- [ ] Ocorrência passada ou cancelada não oferece os botões
- [ ] `npm run build; npm run lint` limpos
- [ ] Test count: n/a (tela — walk)

**Tests**: none
**Gate**: build

**Commit**: `feat(grade): block and unblock a class on a specific date from the panel`

---

## Checks

**Run participants**: `npx vitest run src/modules/bookings/services/__tests__/participants.test.ts --reporter=verbose`
**Run credits**: `npx vitest run src/modules/credits/services/__tests__/studio-cancellation.int.test.ts --reporter=verbose`
**Run bookings**: `npx vitest run src/modules/bookings/services/__tests__/bookings.int.test.ts --reporter=verbose`
**Run occ**: `npx vitest run src/modules/bookings/services/__tests__/occurrences.int.test.ts --reporter=verbose`
**Run class-blocks**: `npx vitest run src/modules/classes/services/__tests__/blocks.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - Logada, `/grade` sem parâmetros renderiza a semana de calendário contendo hoje, cada ocorrência com horário, modalidade, fixos, reposições, experimentais confirmadas e vagas (CAL-01)
Proof: walk - /grade logada mostra a semana corrente com as contagens da composição em cada ocorrência

**C2** - As abas Diária, Semanal e Mensal renderizam as ocorrências da data, da semana e do mês da data selecionada (CAL-02)
Proof: walk - as três abas mostram a mesma turma nas respectivas janelas

**C3** - As setas avançam e recuam exatamente um dia, uma semana ou um mês conforme a aba ativa (CAL-03)
Proof: walk - com cada aba ativa, a seta muda ?data em ±1 dia / ±7 dias (segunda seguinte/anterior) / ±1 mês

**C4** - O seletor de data leva a qualquer data, incluindo D+14 e além, sem limite de 7 dias (CAL-04)
Proof: walk - escolher a data de D+14 no seletor renderiza a ocorrência da turma daquela semana

**C5** - As contagens de toda visualização vêm da composição fonte única (RES-27), sem regra nova de cálculo (CAL-05)
Proof: run occ | ✓ occurrences > derives every count from the single composition source

**C6** - Ocorrência passada nunca materializada é omitida das três visualizações (CAL-06, AD-008)
Proof: run occ | ✓ occurrences > omits a past occurrence that was never materialized

**C7** - Ocorrência BLOQUEADA por feriado/recesso aparece marcada nas três visualizações (CAL-07, AD-014)
Proof: walk - com um feriado no banco de dev cobrindo um dia da semana, as três vistas mostram a ocorrência com selo de bloqueada

**C8** - Ocorrência CANCELADA aparece com selo de cancelada nas três visualizações (CAL-08)
Proof: walk - com uma ocorrência cancelada no banco de dev, as três vistas mostram o selo

**C9** - As vistas mantêm a composição do guia da marca: patinhos mini por slot, tokens, bordas 2px e sem overflow horizontal em 1280px (CAL-09, BRAND-08, AD-041, AD-042)
Proof: browser captures/admin-calendario-semana.running.png

**C10** - O painel da ocorrência lista os participantes com o vínculo de cada um (fixo, reposição, experimental) incluindo os registros de aviso de falta/cancelamento (CAL-10, CRD-09, AD-022)
Proof: run participants | ✓ participants > derives fixed, makeup, experimental and notices for the occurrence

**C11** - Clicar em um participante abre o cadastro do aluno em `/alunos/[id]` (CAL-11)
Proof: walk - clicar num participante fixo navega para /alunos/<id>

**C12** - Cancelamento pelo estúdio de ocorrência de hoje/futura: CANCELADA, reservas ativas canceladas (cancelledBy ESTUDIO), crédito RESERVADO da reposição devolvido com vencimento original e 1 crédito CANCELAMENTO_ESTUDIO por fixo afetado (CAL-12, CRD-28..30, AD-020, AD-025)
Proof: run credits | ✓ studio cancellation > cancels the occurrence and its active bookings

**C13** - Cancelar a mesma ocorrência novamente não duplica crédito nem altera reservas já canceladas (CAL-13, CRD-31/33)
Proof: run credits | ✓ studio cancellation > grants no duplicate credit when the cancellation repeats

**C14** - Cancelamento em ocorrência BLOQUEADA por feriado/recesso é recusado com mensagem clara (CAL-14, FER-09, AD-031)
Proof: run credits | ✓ studio cancellation > refuses the cancellation of a blocked occurrence (FER-09)

**C15** - Cancelamento em ocorrência de data passada é recusado com mensagem clara, sem alterar estado algum (CAL-15, AD-045)
Proof: run credits | ✓ studio cancellation > refuses the cancellation of a past occurrence (AD-045)

**C16** - Após cancelar, a tela exibe o resultado: ocorrência cancelada, reservas canceladas, créditos devolvidos e créditos gerados (CAL-16)
Proof: walk - cancelar uma ocorrência futura mostra os quatro contadores no formulário

**C17** - Ocorrência CANCELADA recusa novas reservas (CAL-17)
Proof: run bookings | ✓ bookings > refuses a booking on a cancelled occurrence

**C18** - Bloquear uma turma em uma data: ocorrências BLOQUEADAS, reservas ativas canceladas, crédito RESERVADO da reposição devolvido e nenhum crédito de estúdio (CAL-18, AD-026, AD-032)
Proof: run class-blocks | ✓ class date blocks > blocks a slot on a date cancelling bookings and returning the makeup credit without studio credits

**C19** - Remover o bloqueio: cobertas de hoje em diante voltam a AGENDADA e as reservas canceladas pelo bloqueio não são restauradas (CAL-19, AD-027)
Proof: run class-blocks | ✓ class date blocks > unblocks from today onward without restoring bookings

**C20** - Cancelamento pelo estúdio em ocorrência bloqueada por turma/data é recusado com mensagem clara (CAL-20, AD-031)
Proof: run class-blocks | ✓ class date blocks > refuses the studio cancellation while blocked

**C21** - Enquanto qualquer bloqueio (feriado, recesso ou turma/data) cobre a data a ocorrência segue BLOQUEADA e desbloqueia somente quando nenhum cobre (CAL-21, AD-028)
Proof: run class-blocks | ✓ class date blocks > stays blocked while any block covers the date

**C22** - A ação "Hoje" renderiza a janela da aba ativa contendo a data de hoje (CAL-22)
Proof: walk - navegar a qualquer data e usar "Hoje" volta para a janela corrente

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-14 - user: "Sim, pode executar" (aprova as tasks); user: "2 workers por lote (Recommended)" (aprova a delegacao em 2 lotes)
**Dispatched:** Batch 1 (Fases 1-2, T1-T6) -> worker batch-1, HEAD 014ac9d, returned (6 tasks, 403 testes verdes, 6 commits: 07f294d, 5b633c2, 2358177, 7947050, abb0e6c, 3135644); Batch 2 (Fases 3-4, T7-T13) -> worker batch-2, HEAD 3135644, pending
**Walked:** (none)

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1, T2
Phase 2:  T3, T4, T5, T6
Phase 3:  T7, T8
Phase 4:  T9, T10, T11, T12, T13
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**Batching**: 13 tasks → 2 batches: Batch 1 = Phases 1-3 (T1-T8), Batch 2 = Phase 4 (T9-T13). Offer-then-confirm before dispatching any worker.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 arquivo de domínio + testes | ✅ Granular |
| T2 | 2 guardas coesas (estado da ocorrência) em 2 services | ⚠️ coeso - mesma regra de ocorrência |
| T3 | 1 tabela (schema + migração) | ✅ Granular |
| T4 | 1 função de domínio + testes | ✅ Granular |
| T5 | 2 services de um mesmo módulo (cobertura) | ⚠️ coeso - um mecanismo |
| T6 | 3 funções de um service + actions | ⚠️ coeso - CRUD de um recurso |
| T7 | 1 extração (1 arquivo + import) | ✅ Granular |
| T8 | 1 service novo + testes | ✅ Granular |
| T9 | 1 componente + 1 chamador | ✅ Granular |
| T10 | page + nav + parametrização do grid | ⚠️ coeso - um wire-up |
| T11 | 2 vistas em 1 arquivo novo | ⚠️ coeso - mesmas células |
| T12 | 1 arquivo (painel) | ✅ Granular |
| T13 | 1 arquivo + actions | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | None | Phase 1 após T1 (ordem numérica, sem dep) | ✅ Match |
| T3 | None | início da Phase 2 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T3, T4 | T4 → T5 (T3 é ancestral de T4) | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | None | início da Phase 3 | ✅ Match |
| T8 | T5, T7 | nota "T8 ← T5, T7" | ✅ Match |
| T9 | None | início da Phase 4 | ✅ Match |
| T10 | T1, T8 | nota "T10 ← T1, T8" | ✅ Match |
| T11 | T9, T10 | nota "T11 ← T9, T10" | ✅ Match |
| T12 | T2, T10 | nota "T12 ← T2, T10" | ✅ Match |
| T13 | T6, T12 | nota "T13 ← T6, T12" | ✅ Match |

Nenhuma dependência aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domain puro | unit | unit | ✅ OK |
| T2 | Service com banco | integration | integration | ✅ OK |
| T3 | Schema / migração | none | none | ✅ OK |
| T4 | Domain puro | unit | unit | ✅ OK |
| T5 | Service com banco | integration | integration | ✅ OK |
| T6 | Service com banco | integration | integration | ✅ OK |
| T7 | Derivação pura | unit | unit | ✅ OK |
| T8 | Service com banco | integration | integration | ✅ OK |
| T9 | Kit UI | unit | unit | ✅ OK |
| T10 | Tela | none (build + walk) | none | ✅ OK |
| T11 | Tela | none (build + walk) | none | ✅ OK |
| T12 | Tela | none (build + walk) | none | ✅ OK |
| T13 | Tela | none (build + walk) | none | ✅ OK |
