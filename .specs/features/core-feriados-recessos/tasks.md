# Core Feriados e Recessos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - domínio, serviços, ações e tela rascunhados na seção "Design (inline)" do spec; sem design.md separado
**Status**: Approved
**Approved**: 2026-11-10 - user: "aprovado"
**Build**: `npm run build; npm run lint`
**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose int.test`

---

## Test Coverage Matrix

> Gerada do codebase existente (149 testes: 37 unit + 112 integration em `src/**/__tests__/*.test.ts` e `*.int.test.ts`, Testcontainers em `src/test/postgres.ts`) e do spec - confirmar antes do Execute. Nenhum guideline de qualidade encontrado no repo: defaults fortes aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domínio do bloqueio (cobertura de datas e transição de status) | unit | Todos os branches; 1:1 com os ACs do spec; cada edge case com teste | `src/modules/bookings/domain/__tests__/*.test.ts` | Run unit |
| Serviço de reconcílio (efeito do bloqueio sobre ocorrências, reservas e créditos) | integration | Cada AC do serviço, incl. as guardas de passado, CANCELADA, sobreposição e dia da semana | `src/modules/bookings/services/__tests__/*.int.test.ts` | Run int |
| Serviços de feriados/recessos (cadastro, edição, remoção, listas) | integration | Cada AC, incl. colisão de data de feriado e fim < início do recesso | `src/modules/classes/services/__tests__/*.int.test.ts` | Run int |
| Integração com o cancelamento do estúdio (recusa em ocorrência bloqueada) | integration | O AC de recusa: status intacto, reservas intactas, nenhum crédito | `src/modules/credits/services/__tests__/*.int.test.ts` | Run int |
| Server actions de feriados/recessos | integration | Action: happy path + erro de validação (data duplicada, fim < início) | `src/modules/classes/__tests__/*.int.test.ts` | Run int |
| Regressão do core (materialização, reservas, composição, agenda) | integration | Suíte existente verde: nenhum comportamento do core quebra | `src/**/__tests__/*.int.test.ts` | Run int |
| UI admin mínima (render) | none | Julgada pelo walk (browser) + build gate; os ACs por trás da tela são testados nos serviços e nas actions | - | walk + Build |

## Gate Check Commands

> Geradas dos scripts do repo (`package.json`) - confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com unit tests apenas | `npx vitest run --exclude "**/*.int.test.ts"` |
| Full | Tasks com integration tests | `npx vitest run` |
| Build | Fim de fase ou task de UI | `npm run build; npm run lint` |

**Pre-requisito do `Run int`**: Docker rodando (Testcontainers cria um Postgres descartável por suite).

---

## Execution Plan

Phases ordenadas e sequenciais; tasks dentro da fase executam em ordem. Cada seta é o `Depends on` correspondente.

### Phase 1 - Domínio puro e reconcílio

```
T1 → T2
```

### Phase 2 - Gatilhos, gestão e recusa

```
T1 → T3
T2 → T4 → T5
T2 → T5
T6
```

### Phase 3 - Interface do admin

```
T4 → T7
T5 → T7
T7 → T8
```

---

## Task Breakdown

### T1: Domínio puro do bloqueio

**What**: funções puras que dizem se uma data está coberta por feriado ou recesso (extremos inclusos) contra bloqueios já carregados, e que resolvem a transição de status de uma ocorrência - BLOQUEADA, AGENDADA ou nada a fazer - com as guardas de passado, CANCELADA e dia da semana
**Where**: `src/modules/bookings/domain/blocks.ts` (novo)
**Depends on**: None
**Reuses**: `src/modules/bookings/domain/composition.ts` (padrão de domínio puro) e `src/modules/classes/domain/occurrences.ts` (datas do estúdio)
**Requirement**: FER-01, FER-02, FER-06, FER-07, FER-10, FER-11, FER-12, FER-13, FER-14

**Done when**:

- [x] `isDateCoveredByBlocks` aceita a data do feriado e o intervalo do recesso com extremos inclusos, e recusa o dia antes do início e o dia depois do fim
- [x] `resolveBlockTransition` devolve BLOQUEADA para ocorrência AGENDADA coberta, AGENDADA para BLOQUEADA descoberta com dia da semana válido, e null para: ocorrência no passado, CANCELADA, coberta que já é BLOQUEADA, descoberta que já é AGENDADA e BLOQUEADA cuja data não corresponde mais ao dia da semana da turma
- [x] A borda "hoje em diante" é testada: hoje é afetado, ontem não
- [x] Unit tests cobrem todos os branches e a borda (9 testes)
- [x] Gate check passa: `npx vitest run --exclude "**/*.int.test.ts"`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(blocos): transicao pura de bloqueio de ocorrencias`

---

### T2: Reconcílio do bloqueio sobre ocorrências e reservas

**What**: serviço que varre as ocorrências AGENDADA e BLOQUEADA de uma janela de datas, aplica a transição pura do T1 e, quando marca BLOQUEADA, cancela as reservas ativas (por estúdio) e devolve à DISPONIVEL o crédito RESERVADO de cada reposição cancelada com o vencimento original e a transação registrada - tudo em uma transação, idempotente
**Where**: `src/modules/bookings/services/blocks.ts` (novo)
**Depends on**: T1
**Reuses**: `src/modules/bookings/domain/blocks.ts` (T1), `src/modules/credits/services/credits.ts` (`returnCredit`), padrão de transação de `src/modules/bookings/services/bookings.ts` e fixture de `src/modules/bookings/services/__tests__/bookings.int.test.ts`
**Requirement**: FER-01, FER-02, FER-03, FER-04, FER-05, FER-10, FER-11, FER-12, FER-13, FER-14, FER-15

**Done when**:

- [ ] `reconcileBlockedOccurrences` marca BLOQUEADA as ocorrências AGENDADA cobertas da janela e cancela as reservas ativas delas com `cancelled_by = ESTUDIO`
- [ ] O crédito RESERVADO de uma reposição cancelada volta a DISPONIVEL com o `expires_at` original e a transação registrada com motivo
- [ ] Nenhuma linha de crédito é criada pelo reconcílio (fixos não recebem crédito)
- [ ] Ocorrência no passado e ocorrência CANCELADA não são alteradas
- [ ] Ocorrência BLOQUEADA descoberta volta a AGENDADA; se outro bloqueio ainda cobre a data, permanece BLOQUEADA; no passado permanece BLOQUEADA; se o dia da semana da turma mudou, permanece BLOQUEADA
- [ ] Desbloquear não restaura nenhuma reserva cancelada
- [ ] Rodar duas vezes não muda nada na segunda
- [ ] Testes de integração cobrem todos esses casos (10 testes)
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(blocos): reconcilio do bloqueio sobre ocorrencias e reservas`

---

### T3: Cobertura de bloqueio em fonte única

**What**: o `hasBlock` da materialização passa a consultar a mesma função pura de cobertura do T1, eliminando a segunda implementação da regra "a data cai em feriado ou recesso"
**Where**: `src/modules/bookings/services/sessions.ts` (modificar)
**Depends on**: T1
**Reuses**: `src/modules/bookings/domain/blocks.ts` (T1)
**Requirement**: FER-08

**Done when**:

- [ ] `materializeSession` decide o bloqueio pela função pura compartilhada; não existe segunda implementação da regra de cobertura
- [ ] Regressão: os testes existentes de materialização bloqueada (`sessions.int.test.ts`, `blocks.int.test.ts`) continuam verdes sem alteração
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `refactor(blocos): cobertura de bloqueio em fonte unica`

---

### T4: Cadastro de feriado e recesso dispara o reconcílio

**What**: `createHoliday` e `createStudioClosure` passam a chamar o reconcílio sobre a janela da data criada (clampada para hoje em diante), com efeito imediato no cadastro
**Where**: `src/modules/classes/services/blocks.ts` (modificar)
**Depends on**: T2
**Reuses**: `src/modules/bookings/services/blocks.ts` (T2), testes existentes de `src/modules/classes/services/__tests__/blocks.int.test.ts`
**Requirement**: FER-01, FER-02, FER-05, FER-06, FER-07

**Done when**:

- [ ] Criar o feriado marca BLOQUEADA as ocorrências AGENDADA existentes daquela data (hoje em diante) e cancela as reservas ativas
- [ ] Criar o recesso marca BLOQUEADA as ocorrências de todas as datas do período, extremos inclusos
- [ ] Cadastrar bloqueio não cria crédito algum (fixo com vínculo ativo e reposição com crédito reservado: zero linhas de crédito novas)
- [ ] Feriado/recesso em data passada não altera ocorrência nenhuma
- [ ] Ocorrência CANCELADA não é tocada pelo cadastro
- [ ] Testes de integração cobrem todos esses casos pelo caminho do cadastro (3 testes novos)
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(blocos): cadastro de feriado e recesso bloqueia as ocorrencias`

---

### T5: Edição, remoção e listagem de feriados e recessos

**What**: serviços de edição e remoção - `updateHoliday` (recusa colisão com a data de outro feriado), `deleteHoliday`, `updateStudioClosure` (valida fim >= início, reprocessa as datas que entraram e as que saíram), `deleteStudioClosure` - e as listas para a tela
**Where**: `src/modules/classes/services/blocks.ts` (modificar)
**Depends on**: T2, T4
**Reuses**: `src/modules/bookings/services/blocks.ts` (T2), `createHoliday`/`createStudioClosure` existentes
**Requirement**: FER-10, FER-11, FER-12, FER-13, FER-14, FER-15, FER-16, FER-19, FER-20, FER-23

**Done when**:

- [ ] `updateHoliday` aplica data e nome novos e reprocessa os bloqueios: a data antiga desbloqueia e a nova bloqueia na mesma operação
- [ ] Editar o feriado para uma data de outro feriado é recusado, sem alterar nada
- [ ] `deleteHoliday` e `deleteStudioClosure` removem o registro e desbloqueiam as ocorrências de hoje em diante que não ficam mais cobertas
- [ ] `updateStudioClosure` valida fim >= início e reprocessa: datas que saíram do período desbloqueiam (respeitando outros bloqueios), datas que entraram bloqueiam
- [ ] `listHolidays` e `listStudioClosures` devolvem os registros para a tela
- [ ] Remover um de dois bloqueios sobrepostos mantém a ocorrência BLOQUEADA
- [ ] Ocorrência bloqueada no passado e com dia da semana alterado permanecem BLOQUEADA; nenhuma reserva cancelada é restaurada
- [ ] Testes de integração cobrem todos esses casos (8 testes novos)
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(blocos): edicao, remocao e listagem de feriados e recessos`

---

### T6: Recusa do cancelamento do estúdio em ocorrência bloqueada

**What**: `cancelOccurrenceByStudio` recusa a ocorrência BLOQUEADA por feriado/recesso: mantém o status, não cancela reservas e não gera crédito
**Where**: `src/modules/credits/services/cancellations.ts` (modificar)
**Depends on**: None
**Reuses**: guardas de status já existentes no serviço (CANCELADA), fixture de `src/modules/credits/services/__tests__/studio-cancellation.int.test.ts`
**Requirement**: FER-09

**Done when**:

- [ ] Cancelar pelo estúdio uma ocorrência BLOQUEADA devolve erro, mantém a ocorrência BLOQUEADA e não gera crédito
- [ ] O caminho da edição de dia/horário (`cancelFutureSessions`, que só seleciona AGENDADA) continua funcionando - regressão da suíte
- [ ] Teste de integração cobre a recusa (1 teste novo)
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): recusa cancelamento do estudio em ocorrencia bloqueada`

---

### T7: Server actions de feriados e recessos

**What**: server actions finas do admin - criar, editar e remover feriado; criar, editar e remover recesso - chamando os serviços sem repetir regra, devolvendo o resultado (ok/error e o efeito do reconcílio)
**Where**: `src/modules/classes/actions.ts` (modificar)
**Depends on**: T4, T5
**Reuses**: padrão das actions de `src/modules/classes/actions.ts` e `src/modules/credits/actions.ts` (import dinâmico do db, resultado do serviço devolvido)
**Requirement**: FER-17, FER-18, FER-21, FER-22, FER-24, FER-25

**Done when**:

- [ ] Action de criar feriado devolve o resultado do cadastro; action de criar recesso idem
- [ ] Data de feriado duplicada é recusada pela action com o erro do serviço
- [ ] Recesso com fim antes do início é recusado pela action
- [ ] Actions de editar feriado e editar recesso devolvem o resultado do reprocessamento
- [ ] Actions de remover feriado e remover recesso devolvem o resultado do desbloqueio
- [ ] Testes de integração cobrem: criação de feriado e recesso, as duas recusas, as duas edições e as duas remoções (8 testes novos)
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(admin): server actions de feriados e recessos`

---

### T8: Tela de feriados e recessos

**What**: página no route group `(admin)` em `/feriados` que lista os feriados (data, nome) e os recessos (início, fim, motivo), com formulários de cadastro e ações de editar e remover, apresentando o resultado de cada operação
**Where**: `src/app/(admin)/feriados/` (novo diretório)
**Depends on**: T7
**Reuses**: ações de `src/modules/classes/actions.ts` e o padrão de página + forms client de `src/app/(admin)/creditos/` (page.tsx + credit-forms.tsx com `useActionState`)
**Requirement**: FER-16, FER-17, FER-21, FER-24, FER-25

**Done when**:

- [ ] A tela lista os feriados com data e nome e os recessos com início, fim e motivo
- [ ] A tela cadastra feriado (data, nome) e recesso (início, fim, motivo) e apresenta o resultado da operação
- [ ] A tela edita e remove feriado e recesso, apresentando o resultado
- [ ] Erros de validação (data duplicada, fim < início) aparecem na tela
- [ ] Rota visitada no walk (browser) sem erro de render
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(admin): tela de feriados e recessos`

---

## Checks

**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose int.test`

**C1** - Cadastrar o feriado marca BLOQUEADA as ocorrências AGENDADA daquela data de hoje em diante (FER-01, AC 1)
Proof: run int | ✓ blocks > blocks the existing occurrences when the holiday is created
Proof: run int | ✓ block reconcile > blocks the occurrences of the window and cancels their active bookings
Proof: run unit | ✓ block transition > blocks a covered scheduled occurrence

**C2** - Cadastrar o recesso marca BLOQUEADA as ocorrências de todas as datas do período, extremos inclusos (FER-02, AC 2)
Proof: run int | ✓ blocks > blocks every date of the closure range when the closure is created
Proof: run unit | ✓ block transition > matches the holiday date and the inclusive closure range

**C3** - A ocorrência que passa a BLOQUEADA tem as reservas ativas canceladas e as vagas liberadas (FER-03, AC 3)
Proof: run int | ✓ block reconcile > blocks the occurrences of the window and cancels their active bookings

**C4** - O crédito RESERVADO da reposição cancelada volta a DISPONIVEL com o vencimento original e a transação registrada (FER-04, AC 4)
Proof: run int | ✓ block reconcile > returns the reserved makeup credit to DISPONIVEL keeping the original expiry

**C5** - Cadastrar feriado ou recesso não cria crédito algum (PRD 15 "Feriado | Não gera crédito") (FER-05, AC 5)
Proof: run int | ✓ blocks > creates no credit when a block is registered
Proof: run int | ✓ block reconcile > creates no credit when blocking

**C6** - Ocorrência coberta no passado não é alterada: hoje é afetado, ontem não (FER-06, AC 6)
Proof: run int | ✓ block reconcile > leaves past occurrences untouched
Proof: run unit | ✓ block transition > treats today as affected and yesterday as not

**C7** - Ocorrência coberta já CANCELADA permanece CANCELADA, sem tocar nas reservas históricas (FER-07, AC 7)
Proof: run int | ✓ block reconcile > leaves cancelled occurrences untouched
Proof: run unit | ✓ block transition > ignores a covered cancelled occurrence

**C8** - Enquanto a data está coberta por feriado ou recesso, nova reserva na ocorrência é recusada (FER-08, AC 8)
Proof: run int | ✓ bookings > rejects a booking in an occurrence blocked by holiday or closure

**C9** - Cancelamento pelo estúdio em ocorrência BLOQUEADA é recusado: status mantido, reservas intactas, nenhum crédito (FER-09, AC 9)
Proof: run int | ✓ studio cancellation > refuses the cancellation of a blocked occurrence

**C10** - Remover o feriado devolve a AGENDADA as ocorrências BLOQUEADA da data de hoje em diante não mais cobertas (FER-10, AC 1)
Proof: run int | ✓ blocks > unblocks the occurrences when the holiday is deleted
Proof: run int | ✓ block reconcile > restores uncovered blocked occurrences to AGENDADA
Proof: run unit | ✓ block transition > reopens an uncovered blocked occurrence

**C11** - Remover ou encurtar o recesso devolve a AGENDADA as ocorrências das datas que deixaram de ser cobertas (FER-11, AC 2)
Proof: run int | ✓ blocks > unblocks the occurrences when the closure is deleted
Proof: run int | ✓ blocks > blocks new dates and releases removed dates when the closure is edited

**C12** - Enquanto qualquer outro bloqueio cobre a data, a ocorrência permanece BLOQUEADA (FER-12, AC 3)
Proof: run int | ✓ block reconcile > keeps the occurrence blocked while another block covers the date
Proof: run int | ✓ blocks > keeps the occurrence blocked when one of two overlapping blocks is removed

**C13** - O desbloqueio não altera ocorrência bloqueada no passado (FER-13, AC 4)
Proof: run int | ✓ block reconcile > keeps a past blocked occurrence blocked when unblocking
Proof: run unit | ✓ block transition > keeps a past blocked occurrence blocked

**C14** - O desbloqueio não devolve a AGENDADA ocorrência cuja data não corresponde mais ao dia da semana da turma (FER-14, AC 5)
Proof: run int | ✓ block reconcile > keeps the occurrence blocked when the slot weekday changed
Proof: run unit | ✓ block transition > keeps the occurrence blocked when the weekday no longer matches

**C15** - O desbloqueio não restaura as reservas canceladas pelo bloqueio (FER-15, AC 6)
Proof: run int | ✓ block reconcile > restores no booking when unblocking

**C16** - A tela /feriados lista os feriados com data e nome e os recessos com início, fim e motivo (FER-16, AC 1)
Proof: run int | ✓ blocks > lists holidays and studio closures
Proof: walk - a tela /feriados lista os feriados com data e nome e os recessos com inicio, fim e motivo

**C17** - Cadastrar feriado pela tela grava, aplica o bloqueio e apresenta o resultado da operação (FER-17, AC 2)
Proof: run int | ✓ admin actions > creates a holiday from the block action and returns the outcome
Proof: walk - cadastrar feriado na tela /feriados grava, bloqueia e apresenta o resultado da operacao

**C18** - Feriado em data já cadastrada é recusado pela tela com o erro apresentado (FER-18, AC 3)
Proof: run int | ✓ admin actions > refuses a holiday on a duplicated date

**C19** - Editar o feriado aplica data e nome novos e reprocessa os bloqueios das datas afetadas (FER-19, AC 4)
Proof: run int | ✓ blocks > moves the block when the holiday is edited
Proof: run int | ✓ admin actions > edits a holiday from the block action and reprocesses the blocks

**C20** - Edição do feriado que colide com a data de outro feriado é recusada com o erro apresentado (FER-20, AC 5)
Proof: run int | ✓ blocks > refuses to edit a holiday onto another holiday date

**C21** - Cadastrar recesso pela tela grava, aplica o bloqueio e apresenta o resultado da operação (FER-21, AC 6)
Proof: run int | ✓ admin actions > creates a studio closure from the block action and returns the outcome
Proof: walk - cadastrar recesso na tela /feriados grava, bloqueia e apresenta o resultado da operacao

**C22** - Recesso com fim antes do início é recusado com o erro apresentado (FER-22, AC 7)
Proof: run int | ✓ blocks > refuses a closure whose end is before its start
Proof: run int | ✓ admin actions > refuses a closure with an end before the start

**C23** - Editar o recesso aplica os valores novos e reprocessa os bloqueios das datas afetadas (FER-23, AC 8)
Proof: run int | ✓ blocks > blocks new dates and releases removed dates when the closure is edited
Proof: run int | ✓ admin actions > edits a studio closure from the block action and reprocesses the blocks

**C24** - Remover o feriado pela tela remove o registro, desbloqueia as ocorrências e apresenta o resultado (FER-24, AC 9)
Proof: run int | ✓ admin actions > deletes a holiday from the block action and unblocks the occurrences
Proof: walk - remover feriado na tela /feriados desbloqueia as ocorrencias e apresenta o resultado

**C25** - Remover o recesso pela tela remove o registro, desbloqueia as ocorrências e apresenta o resultado (FER-25, AC 10)
Proof: run int | ✓ admin actions > deletes a studio closure from the block action and unblocks the occurrences
Proof: walk - remover recesso na tela /feriados desbloqueia as ocorrencias e apresenta o resultado

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-10 - user aprovou o spec ("aprovo"); as 7 decisões de produto e a da coluna `status` estão nos AD-026 a AD-033 de `.specs/STATE.md` e em `context.md`
**Dispatched:** -
**Walked:** -

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 ------→ T2
Phase 2:  T1 ------→ T3
          T2 ------→ T4 ------→ T5
          T2 -----------------→ T5
          T6
Phase 3:  T4 ------→ T7 ←------ T5
          T7 ------→ T8
```

Execution is strictly sequential - um worker trabalha uma task por vez, em ordem. 8 tasks cabem em um único batch: execução inline, sem sub-agents de batch.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 arquivo de domínio | OK |
| T2 | 1 arquivo de serviço (novo) | OK |
| T3 | 1 arquivo de serviço (refactor) | OK |
| T4 | 1 arquivo de serviço (2 funções existentes ganham o gatilho) | OK |
| T5 | 1 arquivo de serviço (6 funções coesas do CRUD) | OK |
| T6 | 1 arquivo de serviço (1 guarda) | OK |
| T7 | 1 arquivo de actions | OK |
| T8 | 1 diretório de tela (página + forms client coesos) | OK |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | OK |
| T2 | T1 | T1→T2 | OK |
| T3 | T1 | T1→T3 | OK |
| T4 | T2 | T2→T4 | OK |
| T5 | T2, T4 | T2→T5, T4→T5 | OK |
| T6 | None | início | OK |
| T7 | T4, T5 | T4→T7, T5→T7 | OK |
| T8 | T7 | T7→T8 | OK |

Nenhuma dependência aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | domínio do bloqueio | unit | unit | OK |
| T2 | serviço de reconcílio | integration | integration | OK |
| T3 | regressão do core (materialização) | integration | integration | OK |
| T4, T5 | serviços de feriados/recessos | integration | integration | OK |
| T6 | integração com cancelamento do estúdio | integration | integration | OK |
| T7 | server actions | integration | integration | OK |
| T8 | UI admin mínima (render) | none (walk + build) | none | OK |
