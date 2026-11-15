# Aluno Fixo: Remoção pela UI e Limite do Plano Tasks

**Design**: inline (escopo Médio — decisões registradas abaixo; spec aprovada em `.specs/features/aluno-fixo-limite/spec.md`)
**Status**: Approved
**Approved**: 2026-11-15 - user: "aprovado"

---

## Decisões de design (inline)

- **Sem mudança de schema.** `fixedEnrollments`, `plans`, `students` servem
  como estão: o limite usa `plans.weeklyFrequency` e o encerramento usa
  `endDate`, que já existem (RES-23).
- **Guards no serviço, não nas actions**: `createEnrollment`, `endEnrollment`,
  `updateStudent` e a conversão ganham as regras; as actions continuam finas.
  Padrão `Result<T>` com `error` + `field` mantido.
- **A fonte do limite é o plano atual da aluna** (`students.planId`), com
  status ATIVO ou INATIVO (assunção do spec). Sem plano: recusa específica
  ("Aluna sem plano não pode ser fixa.").
- **Contagem**: vínculos ATIVA com `endDate` nula ou `endDate > hoje`
  (mesma definição da listagem de "Horários fixos ativos" do perfil).
- **Fixture de teste estendida**: `createStudents` passa a vincular por padrão
  um plano de teste com `weeklyFrequency` alto (7), para os testes existentes
  de vínculo continuarem passando; as options permitem `weeklyFrequency`
  específica ou aluno sem plano nos testes novos. Nenhum teste existente é
  enfraquecido ou apagado.
- **Seed não muda**: as 4 alunas do seed continuam sem plano; o admin atribui
  plano pela UI (`/alunos`), e a regra nova vale a partir daí.
- **UI**: `endEnrollmentAction` (fina, `requireAdminSession`) + formulário
  client por vínculo ativo na seção "Horários fixos ativos" de
  `/alunos/[id]`, com campo de data pré-preenchido com hoje do estúdio
  (`todayInStudio`) e feedback no host único do padrão das telas admin
  (kit da marca, AD-041/AD-042). A grade não ganha remoção.
- **5 tasks, execução inline** — um único lote, sem sub-agentes de execução;
  o Verifier independente roda no fim (author ≠ verifier).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before
> Execute. Guidelines found: `vitest.config.ts` (convenção: `*.test.ts` unit,
> `*.int.test.ts` integration com Testcontainers); sem AGENTS.md - strong
> defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Services (enrollments: guards de plano e encerramento) | integration | Todas as regras novas 1:1 com os ACs; regra com 2 branches provada nos dois (L-015) | `src/modules/students/services/__tests__/enrollments.int.test.ts` | `npx vitest run src/modules/students/services/__tests__/enrollments.int.test.ts --reporter=verbose` |
| Services (students: guards de plano na edição) | integration | PLIM-05/06/07 com as duas branches | `src/modules/students/services/__tests__/students.int.test.ts` | `npx vitest run src/modules/students/services/__tests__/students.int.test.ts --reporter=verbose` |
| Services (experimentals: guarda de conversão) | integration | PLIM-04 com recusa e passagem | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` | `npx vitest run src/modules/experimentals/services/__tests__/conversion.int.test.ts --reporter=verbose` |
| Pages/forms (detalhe da aluna) | none (build gate + walk) | Cada critério de tela tem prova de walk | `src/app/(admin)/alunos/**` | `npm run build; npm run lint` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Full | Após tasks com integration (o comum aqui) | `npm test` |
| Build | Tasks de tela e fim de feature | `npm run build; npm run lint` |

---

## Task Breakdown

### T1: Guardas de encerramento em `endEnrollment`

**What**: em `endEnrollment`, recusar vínculo inexistente (já recusa: manter),
vínculo já encerrado (`endDate` marcada ou status INATIVA) e data de
encerramento anterior à `startDate` — cada recusa com erro claro e sem
alterar a linha. Testes novos: as três recusas; o encerramento por data
persistindo `endDate` já está provado pelos testes de RES-23 existentes.
**Where**: `src/modules/students/services/enrollments.ts`,
`src/modules/students/services/__tests__/enrollments.int.test.ts`
**Depends on**: None
**Reuses**: padrão `EnrollmentResult` do próprio arquivo
**Requirement**: FIX-03, FIX-05

**Done when**:

- [x] Encerramento de vínculo já encerrado recusa no servidor sem alterar nada
- [x] Data anterior à `startDate` recusa com erro claro
- [x] Encerramento válido em data continua gravando `endDate`
- [x] Gate: `npm test` (416 testes verdes, +2 novos)

**Tests**: integration
**Gate**: full
**Commit**: `feat(students): guards against re-ending or backdated enrollment ends`

---

### T2: Limite do plano na criação de vínculo

**What**: em `createEnrollment`, carregar aluna + plano: sem plano recusa
("Aluna sem plano não pode ser fixa."); com plano de frequência N, recusar o
vínculo N+1 com mensagem nomeando plano e contagem atual. A fixture
`createStudents` passa a vincular plano de teste por padrão (frequência 7)
com options para frequência específica ou sem plano — nenhum teste existente
enfraquecido.
**Where**: `src/modules/students/services/enrollments.ts`,
`src/test/fixtures.ts`,
`src/modules/students/services/__tests__/enrollments.int.test.ts`
**Depends on**: None
**Reuses**: `plans` schema, `todayInStudio`, contagem via query dos vínculos
ativos (mesma condição do perfil)
**Requirement**: PLIM-01, PLIM-02, PLIM-03

**Done when**:

- [x] Aluna com plano 2x fixa em 2 turmas tem a 3ª recusada nomeando plano e contagem
- [x] Aluna com plano 2x consegue os 2 vínculos normalmente (branch do meio)
- [x] Aluna sem plano recusa com a mensagem específica
- [x] Testes existentes de vínculo continuam verdes (fixture com plano default)
- [x] Gate: `npm test` (419 testes verdes, +3 novos)

**Tests**: integration
**Gate**: full
**Commit**: `feat(students): plan weekly frequency limits fixed enrollments`

---

### T3: Guardas de plano na edição da aluna

**What**: em `updateStudent`, quando a aluna tem vínculos fixos ativos:
trocar para plano com frequência menor que a contagem recusa; remover o plano
(planId nulo) recusa; sem vínculos ativos, qualquer edição de plano passa.
**Where**: `src/modules/students/services/students.ts`,
`src/modules/students/services/__tests__/students.int.test.ts`
**Depends on**: T2 (mesma contagem de vínculos ativos)
**Reuses**: contagem de vínculos ativos do T2, `planExists`
**Requirement**: PLIM-05, PLIM-06, PLIM-07

**Done when**:

- [x] Baixar a frequência abaixo dos vínculos ativos recusa nomeando contagem e limite
- [x] Limpar o plano com vínculos ativos recusa
- [x] Sem vínculos ativos, trocar/baixar/limpar o plano passa
- [x] Gate: `npm test` (422 testes verdes, +3 novos)

**Tests**: integration
**Gate**: full
**Commit**: `feat(students): plan edits respect active fixed enrollments`

---

### T4: Guarda de frequência na conversão de experimental

**What**: na conversão (AD-037), após carregar os horários escolhidos e o
plano (que já precisa ser ATIVO), recusar quando
`classSlotIds.length > plan.weeklyFrequency`, sem criar aluna nem vínculos.
**Where**: `src/modules/experimentals/services/conversion.ts`,
`src/modules/experimentals/services/__tests__/conversion.int.test.ts`
**Depends on**: None (mesma regra, entrada independente)
**Reuses**: validação de plano ativo que já existe na conversão
**Requirement**: PLIM-04

**Done when**:

- [x] Conversão com mais slots que a frequência do plano recusa nomeando o limite
- [x] Conversão com slots dentro da frequência continua criando aluna + vínculos
- [x] Gate: `npm test` (424 testes verdes, +2 novos)

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): conversion respects the plan weekly frequency`

---

### T5: Encerrar vínculo pela UI do detalhe da aluna

**What**: `endEnrollmentAction` (fina, `requireAdminSession`) chamando
`endEnrollment` com `enrollmentId` + `date`; componente client na seção
"Horários fixos ativos" de `/alunos/[id]` com um formulário por vínculo
(campo de data pré-preenchido com hoje do estúdio, botão "Encerrar"),
feedback de sucesso com a data e do erro do servidor, e refresh da lista
dependendo do estado inteiro (L-034).
**Where**: `src/modules/students/actions.ts`,
`src/app/(admin)/alunos/[id]/page.tsx`,
`src/app/(admin)/alunos/[id]/enrollment-forms.tsx`
**Depends on**: T1 (guards do serviço)
**Reuses**: `getStudentProfile` (já traz o `id` de cada vínculo), kit da
marca (Field, Button, Toast), padrão de `credit-forms.tsx`
**Requirement**: FIX-01, FIX-04

**Done when**:

- [x] Encerrar pela tela grava a data e o feedback cita o encerramento
- [x] A lista "Horários fixos ativos" recarrega sem o vínculo encerrado
- [x] Erro do servidor (data < início, já encerrado) aparece na tela
- [x] Gate: `npm run build; npm run lint` (build limpo, 0 erros de lint)

**Tests**: none (regras provadas em T1; tela provada por walk)
**Gate**: build
**Commit**: `feat(alunos): end a fixed enrollment from the student detail screen`

---

### T6: Perfil para de listar vínculo encerrado no próprio dia (achado de walk)

**What**: o walk do T5 expôs divergência pré-existente: `getStudentProfile`
usava `gte(endDate, hoje)` e listava como ativo um vínculo que a composição
já não conta no dia (RES-23). Corrigir para `gt` (deixa de contar a partir
do próprio dia), com critério novo FIX-06/07 no spec e teste cobrindo as
duas branches (endDate = hoje sai; endDate futura fica).
**Where**: `src/modules/students/services/students.ts`,
`src/modules/students/services/__tests__/students.int.test.ts`,
`.specs/features/aluno-fixo-limite/spec.md`
**Depends on**: T3, T5 (walk)
**Reuses**: `getStudentProfile`, `endEnrollment` por data
**Requirement**: FIX-06, FIX-07

**Done when**:

- [x] `endDate` = hoje não aparece mais em "Horários fixos ativos"
- [x] `endDate` futura continua na lista até a data chegar
- [x] Gate: `npm test`

**Tests**: `perfil deixa de listar o fixo encerrado no proprio dia (FIX-06)` (students.int.test.ts, integration)
**Gate**: full
**Commit**: `fix(students): profile stops listing a fixed enrollment ended today`

---

## Checks

**Run enrollments**: `npx vitest run src/modules/students/services/__tests__/enrollments.int.test.ts --reporter=verbose`
**Run students**: `npx vitest run src/modules/students/services/__tests__/students.int.test.ts --reporter=verbose`
**Run conversion**: `npx vitest run src/modules/experimentals/services/__tests__/conversion.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - Enviar o encerramento com a data informada grava `endDate` no vínculo e o serviço confirma (FIX-01)
Proof: run enrollments | ✓ enrollments > end_date removes the count after the end

**C2** - Um vínculo com `endDate` = D deixa de contar na composição a partir de D e a vaga se libera (FIX-02, RES-23)
Proof: run enrollments | ✓ enrollments > end_date removes the count after the end

**C3** - Data de encerramento anterior à `startDate` recusa com erro claro e não altera o vínculo (FIX-03)
Proof: run enrollments | ✓ enrollments > refuses an end date before the start date

**C4** - O encerramento concluído recarrega "Horários fixos ativos" sem o vínculo encerrado (FIX-04)
Proof: walk - o formulário de encerramento envia, a tela mostra o feedback com a data e a seção recarrega sem o vínculo

**C5** - Encerrar vínculo já encerrado (por data ou status) ou inexistente recusa no servidor (FIX-05)
Proof: run enrollments | ✓ enrollments > refuses ending an already ended or missing enrollment

**C6** - Aluna com plano de frequência N consegue N vínculos fixos ativos e não mais (PLIM-01)
Proof: run enrollments | ✓ enrollments > allows exactly the plan frequency of active enrollments

**C7** - O vínculo N+1 recusa nomeando o plano e a contagem atual (PLIM-02)
Proof: run enrollments | ✓ enrollments > refuses the enrollment beyond the plan frequency naming the plan and the count

**C8** - Aluna sem plano recusa o vínculo fixo com a mensagem específica (PLIM-03)
Proof: run enrollments | ✓ enrollments > refuses a fixed enrollment for a student without a plan

**C9** - Conversão com mais horários fixos que a frequência do plano recusa sem criar aluna nem vínculos (PLIM-04)
Proof: run conversion | ✓ conversion > recusa conversao com mais horarios fixos que a frequencia do plano (PLIM-04)

**C10** - Trocar a aluna para plano com frequência menor que os vínculos ativos recusa nomeando contagem e limite (PLIM-05)
Proof: run students | ✓ students > recusa plano com frequencia menor que os vinculos fixos ativos (PLIM-05)

**C11** - Remover o plano de uma aluna com vínculos fixos ativos recusa (PLIM-06)
Proof: run students | ✓ students > recusa remover o plano de aluna com vinculos fixos ativos (PLIM-06)

**C12** - Sem vínculos fixos ativos, trocar, baixar ou limpar o plano passa normalmente (PLIM-07)
Proof: run students | ✓ students > edita o plano livremente sem vinculos fixos ativos (PLIM-07)

**C13** - Vínculo com `endDate` = hoje deixa de aparecer em "Horários fixos ativos" (FIX-06)
Proof: run students | ✓ students > perfil deixa de listar o fixo encerrado no proprio dia (FIX-06)

**C14** - Vínculo com `endDate` futura continua em "Horários fixos ativos" até a data chegar (FIX-07)
Proof: run students | ✓ students > perfil deixa de listar o fixo encerrado no proprio dia (FIX-06)

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next
begins, and tasks within a phase execute in order.

### Phase 1: Servidor (guards)

```
T1 (independente)
T2 (independente)
T2 -> T3
T4 (independente)
```

Ordem de execução: T1, T2, T3, T4 (T3 depende da contagem de vínculos ativos
que T2 estabelece; T1/T2/T4 são independentes entre si).

### Phase 2: Telas

```
T1 -> T5
T3 -> T6
T5 -> T6
```

T6 nasceu de um achado de walk depois do T5: corrige o filtro de ativos do
perfil (`gt` em vez de `gte`) com critério e teste novos.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Guards de encerramento | 1 serviço, 1 conceito (recusas de encerramento) | ✅ Granular |
| T2: Limite na criação | 1 serviço + fixture, 1 conceito (limite do plano) | ✅ Granular |
| T3: Guards de plano na edição | 1 serviço, 1 conceito (invariante na edição) | ✅ Granular |
| T4: Guarda na conversão | 1 serviço, 1 conceito (limite na conversão) | ✅ Granular |
| T5: UI de encerramento | 1 action + 1 componente + ajuste na página | ✅ Granular |
| T6: Filtro de ativos do perfil | 1 filtro + critérios novos | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | raiz | ✅ Match |
| T2 | None | raiz | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | raiz | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Service (enrollments) | integration | integration | ✅ OK |
| T2 | Service (enrollments) + fixture | integration | integration | ✅ OK |
| T3 | Service (students) | integration | integration | ✅ OK |
| T4 | Service (experimentals) | integration | integration | ✅ OK |
| T5 | Page/form | none (build + walk) | none | ✅ OK |

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** nenhum.
**Dispatched:** (a preencher no fim)
**Walked:** walk do detalhe (`walk.mjs`, 10/10 asserts, chromium headless,
dev server 3002 com banco dedicado): login -> `/grade`; com plano 2x e dois
fixos ativos, o 3o vinculo pela grade recusa nomeando "Plano Walk 2x
2x/semana: a aluna ja esta fixa em 2 turmas" (PLIM-02 na tela); `/alunos` ->
detalhe da aluna lista os 2 vinculos com o formulario, data pre-preenchida
com hoje; encerrar com data anterior ao inicio recusa com `[role=alert]`
contendo "anterior" (FIX-03 na tela); encerrar em hoje grava `endDate`,
mostra "Horário fixo encerrado a partir de 2026-11-15." (FIX-01) e a seção
recarrega com 1 vinculo (FIX-04); a composicao da turma encerrada volta a
"8 vagas livres de 8" (FIX-02 na tela). O walk tambem expôs o achado que
virou T6 (perfil listava endDate = hoje como ativo).
