# Admin Base Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/admin-base/design.md`
**Status**: Approved
**Approved**: 2026-11-12 - user: "pode seguir" (aprovação do plano; modo de execução por lotes delegado ao padrão da skill)
**Build**: `npm run build; npm run lint`

(A suíte completa `npm test` é o gate Full - comando na tabela Gate Check Commands.)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convenção registrada: `*.test.ts` unit, `*.int.test.ts` integration com Testcontainers); sem AGENTS.md - strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain (validadores puros, senha, token) | unit | Todos os branches; 1:1 com os ACs; bordas do spec | `src/modules/**/domain/__tests__/*.test.ts` | `npx vitest run <grupo> --reporter=verbose` |
| Services (auth, plans, students, bookings) | integration | Todos os ACs de service + bordas; regra com 2 branches provada nos dois (L-015) | `src/modules/**/__tests__/*.int.test.ts` | `npx vitest run <grupo> --reporter=verbose` |
| Actions admin (auth, credits, classes) | integration | Guard + validação de entrada no servidor | `src/modules/{auth,credits,classes}/__tests__/*.int.test.ts` | `npx vitest run <grupo> --reporter=verbose` |
| Seed | integration | Idempotência do admin e dos alunos | `src/__tests__/seed.int.test.ts` | `npx vitest run src/__tests__/seed.int.test.ts --reporter=verbose` |
| Pages/screens | none (build gate + walk) | Cada critério de tela tem prova de walk | `src/app/**` | `npm run build; npm run lint` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit | `npx vitest run src/modules/auth/domain` |
| Full | Após tasks com integration (o comum) | `npm test` |
| Build | Tasks de tela e fim de fase | `npm run build; npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Fundação de dados e auth-core

Execução em ordem: T1, T2, T3, T4. O diagrama mostra dependências de dado:

```
T1 → T3
T2 → T3
T3 → T4
```

### Phase 2: Acesso

Execução em ordem: T5, T6.

```
T3 → T5
T5 → T6
```

### Phase 3: Regras de cadastro

Execução em ordem: T7, T8, T9, T10.

```
T1 → T7
T1 → T8
T1 → T9
T3 → T10
```

### Phase 4: Telas

Execução em ordem: T11, T12, T13.

```
T7 → T11
T10 → T11
T8 → T12
T10 → T12
T8 → T13
```

---

## Task Breakdown

### T1: Migração e schema (users, plans, students)

**What**: Criar `users` e `plans` e alterar `students` (phone, email único, birth_date, enrollment_date, plan_id, notes, user_id, enum com os 4 status, drop do unique de name) via `npm run db:generate`; atualizar `createStudents`/`clearTables` do fixtures e o seed dos alunos (conflito por e-mail, novos campos obrigatórios).
**Where**: `src/db/schema/students.ts`
**Depends on**: None
**Reuses**: convenções de `src/db/schema/credits.ts` (enums pg, timestamps), `src/test/fixtures.ts`
**Requirement**: STUD-01, STUD-03, STUD-04 (modelo de dados); PLAN-01 (tabela); PRD 12/13

**Done when**:

- [x] Migration aplica do zero no Postgres do Testcontainers (suíte inteira sobe o banco novo)
- [x] `students.status` aceita EXPERIMENTAL, AGUARDANDO_MATRICULA, ATIVO, INATIVO
- [x] Fixtures e seed atualizados; suíte 188+ testes verde
- [x] Gate: `npm test` + `npm run build; npm run lint`

**Tests**: integration
**Gate**: full
**Commit**: `feat(db): users, plans and student profile fields`

---

### T2: Domínio de auth - senha e token de sessão

**What**: `password.ts` (scrypt + salt aleatório, formato `scrypt:<salt>:<hash>`, verificação com timingSafeEqual) e `session-token.ts` (HMAC-SHA256, payload com userId/role/exp, base64url) com testes unit: round-trip, tamper, expirado, senha errada.
**Where**: `src/modules/auth/domain/password.ts`
**Depends on**: None
**Reuses**: nada (primeiro domínio de auth); estilo puro de `src/modules/credits/domain/credit-rules.ts`
**Requirement**: AUTH-05

**Done when**:

- [x] Hash nunca devolve a senha em claro; verify falha com senha errada
- [x] Token alterado ou expirado devolve `ok: false` com reason
- [x] ~8 testes unit novos verdes
- [x] Gate: quick

**Tests**: unit
**Gate**: quick
**Commit**: `feat(auth): password hashing and signed session token domain`

---

### T3: Serviços de auth - credenciais e sessão

**What**: `credentials.ts` (verifyCredentials com e-mail normalizado trim+lowercase e falha genérica para e-mail desconhecido ou senha errada) e `session.ts` (cookie `yoguese_session` httpOnly 7 dias, secure em produção; getSession; requireAdminSession com redirect) + helper de teste `src/test/auth.ts` (mock de next/headers + AUTH_SECRET de teste) + testes int de credenciais.
**Where**: `src/modules/auth/services/credentials.ts`
**Depends on**: T1, T2
**Reuses**: padrão de retorno `{ ok, value } | { error }` dos services existentes
**Requirement**: AUTH-02, AUTH-03, AUTH-04, AUTH-07

**Done when**:

- [x] E-mail desconhecido e senha errada falham com o mesmo erro genérico
- [x] requireAdminSession sem sessão redireciona; com sessão devolve o usuário
- [x] ~6 testes int novos verdes
- [x] Gate: full

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth): credentials and session services with admin guard`

---

### T4: Seed do admin e variáveis de ambiente

**What**: `seed.ts` cria/atualiza o primeiro admin (role ADMIN, hash do T2) a partir de ADMIN_EMAIL/ADMIN_PASSWORD, idempotente por e-mail (upsert); `.env.example` e README documentam AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD e o reset do banco local (novo schema quebra o volume antigo); teste int de idempotência do admin.
**Where**: `src/db/seed.ts`
**Depends on**: T3
**Reuses**: padrão onConflict do seed atual
**Requirement**: AUTH-08

**Done when**:

- [x] Rodar o seed duas vezes deixa exatamente 1 admin, com hash verificável
- [x] `.env.example` cobre as 3 variáveis novas
- [x] Gate: full

**Tests**: integration
**Gate**: full
**Commit**: `feat(db): seed the first admin from environment`

---

### T5: Tela de login e actions de auth

**What**: `/login` (`src/app/login/page.tsx`) com formulário e mensagem genérica de erro via useActionState; `loginAction` valida campos vazios/formato no servidor, autentica, grava o cookie e redireciona à /grade; `logoutAction` limpa o cookie e volta ao login; admin autenticado que abre /login é redirecionado à /grade.
**Where**: `src/app/login/page.tsx`
**Depends on**: T3
**Reuses**: estilo visual do `(site)/page.tsx` (paleta off-white/bege), padrão "use server"
**Requirement**: AUTH-02, AUTH-03, AUTH-04, AUTH-07

**Done when**:

- [x] Erro de credencial mostra exatamente "E-mail ou senha inválidos"
- [x] loginAction recusa campo vazio sem tocar cookies
- [x] Gate: full (int das actions com o mock de cookies) + build

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth): login page and auth server actions`

---

### T6: Shell do (admin) - guard, navegação e Sair

**What**: `(admin)/layout.tsx` exige sessão (getSession; sem sessão → redirect /login), nav para Grade, Alunos, Planos, Créditos e Feriados, identificação da admin logada pelo nome e formulário do logoutAction ("Sair").
**Where**: `src/app/(admin)/layout.tsx`
**Depends on**: T5
**Reuses**: header existente do layout atual (paleta #e8ded0)
**Requirement**: AUTH-01, AUTH-06, SHELL-01, SHELL-02

**Done when**:

- [x] Sem sessão, qualquer rota do (admin) redireciona ao login
- [x] Nav alcança as 5 telas; Sair encerra a sessão
- [x] Gate: build

**Tests**: none (prova de walk nos critérios de tela)
**Gate**: build
**Commit**: `feat(admin): guarded shell with navigation and logout`

---

### T7: Módulo plans - validators e services

**What**: validators puros (nome obrigatório, price > 0, weeklyFrequency >= 1) e services `createPlan`, `updatePlan`, `listPlans`, `listSelectablePlans` (ATIVO + o plano atual mesmo inativo) com testes unit dos validators e int dos services (criar, editar, validar, seletor com e sem plano inativo).
**Where**: `src/modules/plans/services/plans.ts`
**Depends on**: T1
**Reuses**: padrão de validators de `src/modules/classes/domain/validators.ts`
**Requirement**: PLAN-01, PLAN-02, PLAN-03, PLAN-04

**Done when**:

- [x] price <= 0 e weeklyFrequency < 1 recusados com erro por campo
- [x] listSelectablePlans omite INATIVO, mas mantém o plano atual de uma aluna em edição
- [x] ~10 testes novos verdes (unit + int)
- [x] Gate: full

**Tests**: integration
**Gate**: full
**Commit**: `feat(plans): plan services with selectable-plan rule`

---

### T8: Módulo students - cadastro completo e perfil

**What**: validators puros (campos do PRD 4.4; plano obrigatório quando status ATIVO; formato de e-mail e data) e services `createStudent`, `updateStudent`, `setStudentStatus`, `listStudents` (com plano) e `getStudentProfile` (cadastro + horários fixos ativos + créditos disponíveis com vencimento + histórico de reservas, via `listStudentBookings` nova em bookings) com testes (unit validators + int services: criar, editar, 4 status, e-mail duplicado, perfil agregado).
**Where**: `src/modules/students/services/students.ts`
**Depends on**: T1
**Reuses**: `enrollments.ts`, `listStudentCredits` (credits), padrão de validators de classes
**Requirement**: STUD-01, STUD-02, STUD-03, STUD-04, STUD-05, STUD-08; PLAN-05

**Done when**:

- [x] Falta de campo obrigatório recusa com erro específico do campo
- [x] E-mail duplicado recusa com mensagem própria
- [x] getStudentProfile devolve fixos, créditos com vencimento e histórico
- [x] ~14 testes novos verdes
- [x] Gate: full

**Tests**: integration
**Gate**: full
**Commit**: `feat(students): full student registration services and profile`

---

### T9: Composição ignora aluno inativo

**What**: a contagem de fixos da composição passa a filtrar `students.status = 'ATIVO'` (aluna Inativa deixa de ocupar vaga; reativação volta a contar por derivação, sem reescrever matrículas) com testes int dos dois branches (L-015).
**Where**: `src/modules/bookings/services/composition.ts`
**Depends on**: T1
**Reuses**: query existente de `fixedEnrollments` no mesmo arquivo
**Requirement**: STUD-06, STUD-07

**Done when**:

- [x] Matrícula ativa de aluna INATIVA não conta no fixedCount nem nas vagas
- [x] Voltando a ATIVO, a mesma matrícula conta novamente
- [x] Gate: full (suíte inteira - composição é usada em vários fluxos)

**Tests**: integration
**Gate**: full
**Commit**: `fix(bookings): composition counts only active students`

---

### T10: Guard nas actions existentes e adminLabel da sessão

**What**: `credits/actions.ts` e `classes/actions.ts` passam a começar com `requireAdminSession()`; o `adminLabel` dos services sai da sessão (nome da admin logada) no lugar do rótulo fixo "admin" (AD-016); testes de action atualizados com o helper de mock do T3.
**Where**: `src/modules/credits/actions.ts`
**Depends on**: T3
**Reuses**: `requireAdminSession` (T3), `src/test/auth.ts`
**Requirement**: AUTH-01 (defesa no servidor das actions), PRD 13.3

**Done when**:

- [x] Action sem sessão é recusada (teste com mock sem cookie)
- [x] Transações de crédito registram o nome da admin logada
- [x] Suíte de actions verdes com o mock
- [x] Gate: full

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth): admin guard on existing actions with session label`

---

### T11: Página /planos

**What**: actions do módulo plans (com guard) e página de listagem + formulário (criar, editar, inativar) no padrão visual das telas admin existentes; valor exibido vem do banco.
**Where**: `src/app/(admin)/planos/page.tsx`
**Depends on**: T7, T10
**Reuses**: padrão de `creditos/page.tsx` + `credit-forms.tsx`
**Requirement**: PLAN-01, PLAN-02, PLAN-03, PLAN-06

**Done when**:

- [x] Criar/editar/inativar plano funciona da tela
- [x] Valor mostrado é o gravado no banco
- [x] Gate: build

**Tests**: none (regras provadas no T7; tela provada por walk)
**Gate**: build
**Commit**: `feat(plans): admin plans screen`

---

### T12: Página /alunos - lista e formulário

**What**: actions do módulo students (com guard) e página de listagem (nome, status, plano) + formulário criar/editar com os campos do PRD 4.4, os 4 status e o seletor de planos via listSelectablePlans.
**Where**: `src/app/(admin)/alunos/page.tsx`
**Depends on**: T8, T10
**Reuses**: padrão de `grade/page.tsx` + `booking-forms.tsx`
**Requirement**: STUD-01, STUD-02, STUD-03, STUD-04, STUD-05; PLAN-04

**Done when**:

- [x] Criar aluna Ativa com plano funciona da tela
- [x] Seletor não oferece plano inativo
- [x] Gate: build

**Tests**: none (regras provadas no T8; tela provada por walk)
**Gate**: build
**Commit**: `feat(students): admin students list and registration form`

---

### T13: Detalhe do aluno

**What**: `/alunos/[id]` com dados cadastrais, horários fixos ativos, créditos disponíveis com vencimento e histórico de reservas (STUD-08), consumindo getStudentProfile.
**Where**: `src/app/(admin)/alunos/[id]/page.tsx`
**Depends on**: T8
**Reuses**: `getStudentProfile` (T8), padrão visual das telas admin
**Requirement**: STUD-08

**Done when**:

- [x] Detalhe mostra os 4 blocos de informação do perfil
- [x] Gate: build

**Tests**: none (dados provados no T8; tela provada por walk)
**Gate**: build
**Commit**: `feat(students): student detail screen with credits and history`

---

## Checks

**Run auth-unit**: `npx vitest run src/modules/auth/domain --reporter=verbose`
**Run auth-int**: `npx vitest run src/modules/auth src/__tests__/seed.int.test.ts --reporter=verbose`
**Run plans**: `npx vitest run src/modules/plans --reporter=verbose`
**Run students**: `npx vitest run src/modules/students --reporter=verbose`
**Run composition**: `npx vitest run src/modules/bookings/services/__tests__/composition.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - Sem sessão, abrir /grade redireciona à tela de login (AUTH-01, AC 1)
Proof: walk - visit à /grade deslogada cai no /login

**C2** - Login válido inicia a sessão e leva à /grade (AUTH-02, AC 2)
Proof: walk - login com a credencial do seed termina na /grade

**C3** - E-mail desconhecido e senha errada falham com a mesma mensagem genérica, sem sessão (AUTH-03, AC 3)
Proof: run auth-int | ✓ auth actions > credencial invalida devolve exatamente a mensagem generica, sem sessao (AUTH-03)

**C4** - Campo vazio ou e-mail em formato inválido é recusado no servidor, sem criar sessão (AUTH-04, AC 4)
Proof: run auth-int | ✓ auth actions > recusa campo vazio e e-mail invalido no servidor, sem tocar cookies (AUTH-04)

**C5** - A senha é guardada somente como `scrypt:<salt>:<hash>`, nunca em claro (AUTH-05, AC 5)
Proof: run auth-unit | ✓ password > hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash

**C6** - "Sair" invalida a sessão e volta ao login (AUTH-06, AC 6)
Proof: walk - clique em Sair desloga e /grade volta a redirecionar

**C7** - Admin autenticado que abre /login é levado à /grade (AUTH-07, AC 7)
Proof: walk - logada, /login redireciona à /grade

**C8** - Seed duas vezes deixa exatamente 1 admin com hash verificável (AUTH-08, AC 8)
Proof: run auth-int | ✓ seed > admin idempotente com hash verificavel

**C9** - O shell oferece navegação para Grade, Alunos, Planos, Créditos e Feriados e a ação "Sair" (SHELL-01, AC 1)
Proof: walk - nav do (admin) alcança as 5 telas

**C10** - O shell identifica a administradora logada pelo nome (SHELL-02, AC 2)
Proof: walk - nome da admin aparece no header

**C11** - createStudent persiste nome, telefone, e-mail, nascimento, matrícula, plano e status (STUD-01, AC 1)
Proof: run students | ✓ students services > cria aluna com todos os campos

**C12** - Campo obrigatório ausente é recusado com erro específico do campo (STUD-02, AC 2)
Proof: run students | ✓ students services > recusa cadastro sem campo obrigatorio

**C13** - Os 4 status do PRD são aceitos no cadastro (STUD-03, AC 3)
Proof: run students | ✓ students services > aceita os 4 status do PRD

**C14** - E-mail já cadastrado é recusado com erro próprio (STUD-04, AC 4)
Proof: run students | ✓ students services > recusa e-mail duplicado

**C15** - updateStudent persiste as mudanças e elas aparecem na listagem/perfil (STUD-05, AC 5)
Proof: run students | ✓ students services > edita a aluna e a mudanca aparece na listagem (STUD-05)

**C16** - WHILE inativa, a aluna não conta como ocupação fixa da ocorrência (STUD-06, AC 6)
Proof: run composition | ✓ occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07)

**C17** - De volta a Ativa, a mesma matrícula volta a contar sem reescrever dados (STUD-07, AC 7)
Proof: run composition | ✓ occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07)

**C18** - getStudentProfile devolve cadastro, fixos ativos, créditos com vencimento e histórico (STUD-08, AC 8)
Proof: run students | ✓ students services > perfil agrega fixos creditos e historico

**C19** - createPlan persiste nome, valor, frequência, descrição e status (PLAN-01, AC 1)
Proof: run plans | ✓ plans services > cria plano completo

**C20** - price <= 0 e weeklyFrequency < 1 são recusados com erro por campo (PLAN-02, AC 2)
Proof: run plans | ✓ plans services > recusa valor e frequencia invalidos

**C21** - updatePlan persiste as mudanças e elas aparecem na listagem (PLAN-03, AC 3)
Proof: run plans | ✓ plans services > edita e reflete na listagem

**C22** - listSelectablePlans omite o plano INATIVO da seleção (PLAN-04, AC 4)
Proof: run plans | ✓ plans services > inativa via update e o seletor omite o plano (PLAN-04)

**C23** - Aluna com plano inativo mantém o plano visível no perfil (PLAN-05, AC 5)
Proof: run students | ✓ students services > perfil mostra o plano mesmo depois de inativado (PLAN-05)

**C24** - O valor do plano exibido na tela é o gravado no banco, sem tabela fixa no código (PLAN-06, AC 6)
Proof: walk - plano criado com valor X aparece na /planos com X

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-12 - user: "pode seguir" (aprovação do plano de tasks; modo de execução por lotes com sub-agentes, padrão da skill, delegado ao orquestrador)
**Dispatched:** 2026-11-12 - batch worker 1 (fases 1-2, T1-T6) em HEAD 8429c7d - **returned**: completo (T1 178bcac, T2 83aa007, T3 90fae50, T4 da7d220, T5 5ecff9b, T6 4996448; 223 testes verdes, 0 desvios)
**Dispatched:** 2026-11-12 - batch worker 2 (fases 3-4, T7-T13) em HEAD 4996448 - **returned**: completo (T7 a861700, T8 d064880, T9 7db69df, T10 27663c3, T11 37cdba7, T12 b753172, T13 ffecf6e; 261 testes verdes, 0 desvios)
**Walked:** 2026-11-12, chromium headless (playwright-core/msedge) contra dev server na 3000 - 26/26 PASS. Login seguro: /grade deslogada cai no /login (C1); senha errada mostra "E-mail ou senha inválidos" sem sessão (C3); login admin@yoguese.com leva a /grade (C2); logada, /login devolve a /grade (C7); Sair desloga e o guard volta (C6). Shell: nav Grade/Alunos/Planos/Créditos/Feriados + "Admin Yogue-se logada" (C9, C10). Planos: "Mensal 2x" criado por R$ 180,00 e exibido na listagem com o valor do banco (C24). Alunos: "Ana Walk" criada Ativa com plano Mensal 2x (STUD-01/03), reservada como fixa na ter 19h pela grade (Fixos 1 / Vagas 7); Inativar libera a vaga na grade (Vagas 8, STUD-06) e Reativar restaura (Vagas 7, STUD-07); detalhe /alunos/[id] mostra Dados cadastrais, Horários fixos ativos, Créditos disponíveis e Histórico de reservas (STUD-08). Achado do walk fechado: a reserva FIXED de aluna inativa contava na composição (branch sem teste) - fix 809b7f4 com teste dos dois branches, 262 testes verdes. Estado final do banco local: admin seedado, plano Mensal 2x, Ana Walk ativa com reserva fixa na ocorrência de ter 19h, 4 alunos de teste.

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:
  T1 → T3
  T2 → T3
  T3 → T4

Phase 2:
  T3 → T5
  T5 → T6

Phase 3:
  T1 → T7
  T1 → T8
  T1 → T9
  T3 → T10

Phase 4:
  T7 → T11
  T10 → T11
  T8 → T12
  T10 → T12
  T8 → T13
```

Setas = dependências de dado. Ordem de execução dentro de cada fase: T1, T2, T3, T4 | T5, T6 | T7, T8, T9, T10 | T11, T12, T13.

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**How phase-based execution works:**

At Execute, the agent counts total tasks and packs phases into **task-budgeted batches** (~7 tasks per worker, whole phases). Packing here: Batch 1 = Phases 1-2 (T1-T6, 6 tasks); Batch 2 = Phases 3-4 (T7-T13, 7 tasks). Batches run sequentially; each worker executes ALL its tasks in order and reports a compact summary. See [sub-agents.md](sub-agents.md) in the skill.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 migração + adaptação de fixtures/seed (mesma entrega de dados) | ✅ Granular (coeso: a suíte só fica verde com os três juntos) |
| T2 | 2 funções puras do mesmo domínio | ✅ Granular |
| T3 | 2 services do mesmo domínio + helper de teste | ✅ Granular |
| T4 | 1 função do seed + docs de env | ✅ Granular |
| T5 | 1 rota + 1 arquivo de actions | ✅ Granular |
| T6 | 1 arquivo (layout) | ✅ Granular |
| T7 | 1 módulo backend | ✅ Granular |
| T8 | 1 módulo backend | ✅ Granular |
| T9 | 1 função de service | ✅ Granular |
| T10 | 2 arquivos de actions + testes | ✅ Granular (mesma mudança de guard) |
| T11 | 1 rota | ✅ Granular |
| T12 | 1 rota | ✅ Granular |
| T13 | 1 rota | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | início Phase 1 | ✅ |
| T2 | None | T1 → T2 (ordem sequencial, sem dependência de dado) | ✅ |
| T3 | T1, T2 | T2 → T3 (T1 anterior na fase) | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T3 | T4 → T5 (T3 anterior) | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T1 | T6 → T7 (T1 anterior) | ✅ |
| T8 | T1 | T7 → T8 | ✅ |
| T9 | T1 | T8 → T9 | ✅ |
| T10 | T3 | T9 → T10 | ✅ |
| T11 | T7, T10 | T10 → T11 (T7 anterior) | ✅ |
| T12 | T8, T10 | T11 → T12 | ✅ |
| T13 | T8 | T12 → T13 | ✅ |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | schema/migration + seed | integration | integration | ✅ |
| T2 | domain | unit | unit | ✅ |
| T3 | services | integration | integration | ✅ |
| T4 | seed | integration | integration | ✅ |
| T5 | actions + page | integration (actions) | integration | ✅ |
| T6 | page/layout | none | none (walk) | ✅ |
| T7 | domain + services | integration | integration | ✅ |
| T8 | domain + services | integration | integration | ✅ |
| T9 | services | integration | integration | ✅ |
| T10 | actions | integration | integration | ✅ |
| T11 | page | none | none (walk) | ✅ |
| T12 | page | none | none (walk) | ✅ |
| T13 | page | none | none (walk) | ✅ |
