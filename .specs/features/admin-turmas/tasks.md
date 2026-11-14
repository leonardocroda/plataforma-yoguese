# Admin Turmas Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (escopo Médio — decisões registradas abaixo; spec aprovada em `.specs/features/admin-turmas/spec.md`)
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovado"
**Build**: `npm run build; npm run lint`
**Run turmas**: `npx vitest run src/modules/classes --reporter=verbose`
**Run sessions**: `npx vitest run src/modules/bookings/services/__tests__/sessions.int.test.ts --reporter=verbose`

---

## Decisões de design (inline)

- **Nenhuma mudança de schema.** Tudo vive sobre `CLASS_TYPES` e `CLASS_SLOTS` como estão.
- **Actions existentes reutilizadas como estão**: `createClassTypeAction`, `updateClassTypeAction`, `deactivateClassTypeAction`, `createSlotAction`, `updateSlotAction`, `deactivateSlotAction` — a UI não duplica regra (RES-01..05, RES-27).
- **Guards novos no serviço** (`classes.ts`), não nas actions: nome de modalidade vazio recusado; `createSlot` recusa modalidade inexistente e inativa com `field`. Padrão `Result<T>` mantido.
- **Listagem completa**: funções de leitura novas (`listAllClassTypes`, `listAllSlots`) trazendo ativas e inativas com status, ao lado de `listActiveSlots` que continua como está (grade e agenda pública não mudam).
- **Retorno de `updateSlot` estendido sem quebrar chamadores**: o valor ganha um campo opcional `scheduleEdit` com `cancelledOccurrences` e `grantedCredits` quando o dia/horário mudou (AD-013/AD-017) — é o que alimenta o feedback da tela (TURM-16). Chamadores atuais continuam compilando.
- **Telas**: página server `/turmas` + formulários client no padrão `planos/page.tsx` + `credit-forms.tsx`, com o kit da marca (`src/modules/ui`, AD-041/AD-042). Select de modalidade da nova turma usa o mesmo padrão de `listSelectablePlans` (PLAN-04): só ativas.
- **Sem sub-agentes**: 7 tasks cabem em um único lote inline.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convenção registrada: `*.test.ts` unit, `*.int.test.ts` integration com Testcontainers); sem AGENTS.md - strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Services (classes: guards, listagem, resumo de edição) | integration | Todas as regras novas 1:1 com os ACs; regra com 2 branches provada nos dois (L-015) | `src/modules/classes/services/__tests__/*.int.test.ts` | `npx vitest run src/modules/classes --reporter=verbose` |
| Regras existentes reutilizadas (validação de slot, guarda de capacidade, AD-013/AD-017) | integration | Provadas pelos testes que já existem — nenhum teste é apagado nem enfraquecido | `src/modules/classes/**/__tests__/*`, `src/modules/bookings/services/__tests__/sessions.int.test.ts` | `npx vitest run src/modules/classes --reporter=verbose` |
| Pages/forms (turmas) | none (build gate + walk) | Cada critério de tela tem prova de walk | `src/app/(admin)/turmas/**` | `npm run build; npm run lint` |
| Domain / schema | none | Nenhuma mudança nesta feature | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit | `npx vitest run src/modules/classes/domain` |
| Full | Após tasks com integration (o comum aqui) | `npm test` |
| Build | Tasks de tela e fim de fase | `npm run build; npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Servidor (guards, listagem, resumo da edição)

Tasks independentes; execução na ordem numérica.

```
T1 (independente)
T2 (independente)
T3 (independente)
```

### Phase 2: Telas

Dependências (cada linha é declarada no corpo da task):

```
T2 -> T4
T1 -> T5
T2 -> T5
T4 -> T5
T1 -> T6
T2 -> T6
T4 -> T6
T2 -> T7
T3 -> T7
T4 -> T7
```

---

## Task Breakdown

### T1: Guardas de servidor para modalidades e turma

**What**: em `createClassType`/`updateClassType`, recusar nome vazio ou em branco com erro do campo; em `createSlot`, recusar modalidade inexistente (já existe: `field classTypeId`) e modalidade INATIVA com erro do campo. Testes novos: nome em branco recusado, modalidade inativa recusada, modalidade inexistente recusada, e a criação de turma ATIVA com os dados submetidos. A recusa de campo obrigatório vazio ficou no validador de domínio (`validateSlot`), fonte única da validação: hoje horário vazio passava porque a comparação de `NaN` nunca é verdadeira.
**Where**: `src/modules/classes/services/classes.ts`, `src/modules/classes/domain/validators.ts`
**Depends on**: None
**Reuses**: `validateSlot`/`SlotValidationError` (`domain/validators.ts`), padrão `Result<T>` do próprio arquivo
**Requirement**: TURM-04, TURM-07, TURM-08, TURM-10, TURM-11

**Done when**:

- [x] Nome vazio/branco de modalidade recusado no servidor com `field: "name"`
- [x] `createSlot` com modalidade inexistente ou INATIVA recusa com `field: "classTypeId"`
- [x] Criação de turma válida grava ATIVA com modalidade, dia, horários
- [x] Suíte inteira verde (368 testes, +5 novos), sem teste enfraquecido
- [x] Gate: `npm test`

**Tests**: unit, integration
**Gate**: full
**Commit**: `feat(classes): server guards for modality name and inactive class type`

---

### T2: Listagem completa de modalidades e turmas

**What**: funções de leitura novas `listAllClassTypes` (todas, com status) e `listAllSlots` (todas, com status, dia, horários, capacidade e nome da modalidade), ordenadas por status e horário; `listActiveSlots` intocado.
**Where**: `src/modules/classes/services/classes.ts`
**Depends on**: None
**Reuses**: padrão de `listActiveSlots` (join com `classTypes`)
**Requirement**: TURM-02

**Done when**:

- [x] Listagens retornam ativas e inativas com status
- [x] Teste: fixture com turma ativa + turma inativa e modalidade inativa — ambas aparecem com status, e `listActiveSlots` segue só com as ativas
- [x] Gate: `npm test` (369 testes, +1)

**Tests**: integration
**Gate**: full
**Commit**: `feat(classes): full listing of class types and slots with status`

---

### T3: Resumo da edição de dia/horário e testes de ciclo de vida

**What**: estender o retorno de `updateSlot`: quando o dia ou o horário mudou, o valor traz `scheduleEdit: { cancelledOccurrences, grantedCredits }` (contagem de `cancelFutureSessions` + créditos gerados, AD-013/AD-017), sem quebrar o tipo para os chamadores atuais. Testes novos: desativar mantém a linha e o histórico e para as ocorrências futuras; reativar traz as ocorrências de volta e nunca ressuscita ocorrência CANCELADA; o resumo reporta 2 ocorrências canceladas e N créditos num cenário com fixos.
**Where**: `src/modules/classes/services/classes.ts`, `src/modules/bookings/services/sessions.ts`
**Depends on**: None
**Reuses**: `cancelFutureSessions` (`bookings/services/sessions.ts`), teste existente "editing the weekday cancels the old future occurrences and their bookings"
**Requirement**: TURM-15, TURM-16 (lado servidor), TURM-17, TURM-18

**Done when**:

- [x] `scheduleEdit` presente com contagens quando dia/horário muda; ausente quando não muda
- [x] Desativação preserva a linha e o histórico; nenhuma ocorrência nova
- [x] Reativação volta a gerar ocorrências; CANCELADAS permanecem CANCELADAS
- [x] Gate: `npm test` (373 testes, +4)

**Tests**: integration
**Gate**: full
**Commit**: `feat(classes): schedule-edit summary in slot update result`

---

### T4: Página /turmas e link no shell

**What**: página server `/(admin)/turmas/page.tsx` consumindo `listAllClassTypes` e `listAllSlots` no padrão visual das telas admin (skin da marca): lista de modalidades com status e lista de turmas com modalidade, dia da semana, horário início/término, capacidade e status. Mais a entrada `Turmas` em `NAV_LINKS` do `src/app/(admin)/layout.tsx`.
**Where**: `src/app/(admin)/turmas/page.tsx`
**Depends on**: T2
**Reuses**: padrão de `planos/page.tsx`, kit `src/modules/ui` (Button, Chip), guard herdado do layout (AUTH-01)
**Requirement**: TURM-01, TURM-02

**Done when**:

- [x] Nav "Turmas" alcança a página logada; deslogada a rota cai no login
- [x] Listagem mostra ativas e inativas com status, dia, horário e capacidade
- [x] Gate: `npm run build; npm run lint` (rota `/turmas` no build, 0 erros de lint)

**Tests**: none (regras provadas em T1/T2; tela provada por walk)
**Gate**: build
**Commit**: `feat(turmas): admin classes listing screen`

---

### T5: Formulário de modalidade

**What**: componente client com criar (nome) e editar/inativar por linha, chamando `createClassTypeAction`/`updateClassTypeAction`/`deactivateClassTypeAction`; feedback de sucesso e erro do campo no host único do padrão das telas admin.
**Where**: `src/app/(admin)/turmas/modality-forms.tsx`
**Depends on**: T1, T2, T4
**Reuses**: padrão de `credit-forms.tsx`, kit (Field, Button, Toast)
**Requirement**: TURM-03, TURM-05

**Done when**:

- [x] Criar modalidade pela tela funciona e ela aparece na listagem
- [x] Editar nome/status persiste e reflete
- [x] Gate: `npm run build; npm run lint`

**Tests**: none (regras provadas em T1; tela provada por walk)
**Gate**: build
**Commit**: `feat(turmas): modality create and edit forms`

---

### T6: Formulário de criação de turma

**What**: componente client com modalidade (só ATIVAS), dia da semana (1 a 7, domingo a sábado), horário início, horário término e capacidade opcional, chamando `createSlotAction`; erros do servidor exibidos por campo.
**Where**: `src/app/(admin)/turmas/turma-create-form.tsx`
**Depends on**: T1, T2, T4
**Reuses**: padrão de `booking-forms.tsx`, kit (Field, Button)
**Requirement**: TURM-06, TURM-08, TURM-09, TURM-10, TURM-11, TURM-12

**Done when**:

- [x] Criar turma com capacidade em branco grava 8 (RES-02)
- [x] Select não oferece modalidade inativa
- [x] Erros de servidor (fim ≤ início, dia inválido, capacidade < 1, modalidade) aparecem por campo
- [x] Turma criada aparece na listagem e a ocorrência na `/grade` da próxima data
- [x] Gate: `npm run build; npm run lint`

**Tests**: none (regras provadas em T1/T2; tela provada por walk)
**Gate**: build
**Commit**: `feat(turmas): class slot creation form`

---

### T7: Edição, desativação e reativação de turma com feedback

**What**: componente client por linha de turma: editar dia/horário/capacidade/status, desativar e reativar via `updateSlotAction`/`deactivateSlotAction`. Quando o retorno traz `scheduleEdit`, a tela informa quantas ocorrências foram canceladas e quantos créditos gerados (TURM-16); erro de capacidade cita a ocorrência mais afetada (TURM-14).
**Where**: `src/app/(admin)/turmas/turma-edit-forms.tsx`
**Depends on**: T2, T3, T4
**Reuses**: `scheduleEdit` (T3), padrão de `credit-forms.tsx`, kit (Field, Button, Toast)
**Requirement**: TURM-13, TURM-14, TURM-16, TURM-17, TURM-18

**Done when**:

- [x] Edição de dia/horário mostra o feedback de ocorrências canceladas e créditos
- [x] Desativar/reativar funcionam da tela, sem apagar registro
- [x] Erro de capacidade abaixo da ocupação aparece citando a data
- [x] Gate: `npm run build; npm run lint`

**Tests**: none (regras provadas em T3; tela provada por walk)
**Gate**: build
**Commit**: `feat(turmas): class slot edit, deactivate and reactivate with schedule feedback`

---

## Checks

**Run turmas**: `npx vitest run src/modules/classes --reporter=verbose`
**Run sessions**: `npx vitest run src/modules/bookings/services/__tests__/sessions.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - Logada, "Turmas" aparece no shell e alcança `/turmas`; deslogada, `/turmas` cai no `/login` (TURM-01)
Proof: walk - nav "Turmas" alcança /turmas logada; deslogada a rota redireciona ao login

**C2** - `/turmas` lista modalidades e turmas ativas e inativas com status, modalidade, dia, horário e capacidade (TURM-02)
Proof: walk - /turmas mostra a turma inativa e a ativa com status e dados completos

**C3** - Modalidade submetida com nome é criada ATIVA e aparece na listagem (TURM-03)
Proof: run turmas | ✓ classes > creates, edits and deactivates a class type

**C4** - Nome vazio/branco de modalidade é recusado no servidor com erro do campo, sem criar registro (TURM-04)
Proof: run turmas | ✓ classes > refuses a blank modality name on the server

**C5** - Edição de nome/status de modalidade persiste e reflete na listagem (TURM-05)
Proof: run turmas | ✓ classes > creates, edits and deactivates a class type

**C6** - Com modalidade INATIVA, o formulário de nova turma não a oferece (TURM-06)
Proof: walk - o select de modalidade da nova turma não lista a modalidade inativa

**C7** - Turma submetida com modalidade INATIVA é recusada no servidor com erro do campo (TURM-07)
Proof: run turmas | ✓ classes > refuses a slot under an inactive class type

**C8** - Turma válida é criada ATIVA com modalidade, dia 1-7 e horários informados (TURM-08)
Proof: run turmas | ✓ classes > creates an active slot with the submitted data

**C9** - Turma criada sem capacidade grava capacidade 8 (TURM-09)
Proof: run turmas | ✓ classes > default capacity is eight

**C10** - Fim ≤ início, dia fora de 1-7, capacidade < 1 ou campo obrigatório vazio são recusados no servidor nomeando o campo (TURM-10)
Proof: run turmas | ✓ classes > rejects an invalid slot on the server

**C11** - Modalidade inexistente é recusada com erro do campo modalidade (TURM-11)
Proof: run turmas | ✓ classes > refuses a slot whose class type does not exist with a field error

**C12** - Turma criada pela `/turmas` aparece na `/grade` a partir da próxima data do dia da semana (TURM-12)
Proof: walk - turma de quinta criada pela tela aparece na /grade da próxima quinta

**C13** - Edição de dia/horário/capacidade/status persiste e as ocorrências futuras refletem o novo estado (TURM-13)
Proof: run turmas | ✓ classes > editing or deactivating a class affects future occurrences

**C14** - Redução de capacidade abaixo da ocupação é recusada citando a ocorrência mais afetada (TURM-14)
Proof: run turmas | ✓ classes > rejects a capacity below the occupancy of a future occurrence

**C15** - Edição de dia/horário cancela as ocorrências futuras antigas, cancela as reservas e gera 1 crédito CANCELAMENTO_ESTUDIO por fixo afetado (TURM-15)
Proof: run sessions | ✓ sessions > grants one credit per fixed student per cancelled future occurrence on a schedule edit

**C16** - A edição de dia/horário concluída informa na tela quantas ocorrências foram canceladas e quantos créditos gerados (TURM-16)
Proof: walk - o feedback da edição mostra as contagens de ocorrências canceladas e créditos

**C17** - Desativar marca INATIVA sem apagar registro; histórico permanece; nenhuma ocorrência nova (TURM-17)
Proof: run turmas | ✓ classes > deactivating keeps the slot row and stops future occurrences

**C18** - Reativar traz as ocorrências futuras de volta e ocorrências CANCELADAS não ressuscitam (TURM-18)
Proof: run turmas | ✓ classes > reactivating brings back future occurrences and never resurrects cancelled ones

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** nenhum.
**Dispatched:** [cada sub-agent antes de ser enviado - at which `HEAD`, and `returned` when it does]
**Walked:** 2026-11-14, chromium headless (playwright-core) contra o dev server na 3001, rota `/turmas`, 18 gestos exercitados: login do admin -> `/grade`; link "Turmas" do shell -> `/turmas`; listagem com 2 modalidades do seed; nome de modalidade em branco recusado no servidor com erro no campo; modalidade "Walk Yôga" criada e aparecendo na listagem; nome editado ("Walk Yôga Editada") refletido; status Inativa refletido; seletor de nova turma oferecendo so "Superioga Clássico | Superioga Intenso" (a inativa fora); turma criada sem capacidade gravando 8 vagas; fim antes do inicio recusado no campo "endTime"; edicao de dia devolvendo o feedback "Turma atualizada. 0 ocorrencias canceladas na grade antiga e 0 creditos gerados."; turma desativada (chip Inativa, linha preservada) e reativada (chip Ativa); turma recem-criada aparecendo na `/grade`; deslogada, `/turmas` redireciona ao `/login`. Sem pageerrors.
**Achado do walk:** o `useEffect` de refresh dependia do booleano `state.ok`: a segunda operacao bem-sucedida nao atualizava a listagem (a modalidade ficou INATIVA no banco e a tela seguia "Ativa"). Corrigido nos tres formularios (dependencia do estado inteiro) e reconferido no walk.

---

## Phase Execution Map

```
Phase 1 -> Phase 2

Phase 1: T1, T2 e T3 independentes, executados na ordem numerica.
Phase 2: T4, depois T5, depois T6, depois T7.

T1 -> T5
T1 -> T6
T2 -> T4
T2 -> T5
T2 -> T6
T2 -> T7
T3 -> T7
T4 -> T5
T4 -> T6
T4 -> T7
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

7 tasks no total: um único lote — execução inline na janela principal, sem sub-agentes.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Guardas de servidor | 1 arquivo, 1 conceito (validação de entrada) | ✅ Granular |
| T2: Listagem completa | 2 funções de leitura no mesmo arquivo | ✅ Granular |
| T3: Resumo da edição + ciclo de vida | 1 arquivo, 1 retorno estendido + testes | ✅ Granular |
| T4: Página /turmas + link | 1 página (+ 1 linha de nav) | ✅ Granular |
| T5: Formulário de modalidade | 1 componente | ✅ Granular |
| T6: Formulário de criação | 1 componente | ✅ Granular |
| T7: Edição/desativação/reativação | 1 componente | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | raiz | ✅ Match |
| T2 | None | raiz | ✅ Match |
| T3 | None | raiz | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T1, T2, T4 | T1→T5, T2→T5, T4→T5 | ✅ Match |
| T6 | T1, T2, T4 | T1→T6, T2→T6, T4→T6 | ✅ Match |
| T7 | T2, T3, T4 | T2→T7, T3→T7, T4→T7 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Service (classes) | integration | integration | ✅ OK |
| T2 | Service (classes) | integration | integration | ✅ OK |
| T3 | Service (classes) | integration | integration | ✅ OK |
| T4 | Page | none (build + walk) | none | ✅ OK |
| T5 | Page/form | none (build + walk) | none | ✅ OK |
| T6 | Page/form | none (build + walk) | none | ✅ OK |
| T7 | Page/form | none (build + walk) | none | ✅ OK |
