# Core Turmas e Reservas Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - arquitetura decidida em STATE.md (AD-004, monolito modular); sem design.md separado
**Status**: Approved
**Approved**: 2026-11-06 - user: "sim"
**Build**: `npm run build; npm run lint`
**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose "**/*.int.test.ts"`

---

## Test Coverage Matrix

> Gerada de um repositorio sem testes e sem guidelines - defaults fortes aplicados. Confirmado com o usuario em discuss: Vitest, Docker + Testcontainers, npm, Tailwind.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Dominio (datas, validadores, composicao) | unit | Todos os branches; 1:1 com os ACs do spec; cada edge case com teste | `src/**/__tests__/*.test.ts` | Run unit |
| Servicos (sessoes, reservas, enrollments, turmas) | integration | Cada AC do servico, incl. concorrencia | `src/**/__tests__/*.int.test.ts` | Run int |
| Migrations / schema | integration | Migration aplica limpo em Postgres vazio; seed carrega | `src/**/__tests__/*.int.test.ts` | Run int |
| Server actions / route publico | integration | Rota/acaaaa em escopo: happy + erro | `src/**/__tests__/*.int.test.ts` | Run int |
| UI admin minima | none | Julgada pelo walk (browser) + build gate; os ACs por tras dela sao testados nos servicos | - | walk + Build |
| Scaffold / config | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Gerados das decisões de scaffold - confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com unit tests apenas | `npx vitest run --exclude "**/*.int.test.ts"` |
| Full | Tasks com integration tests | `npx vitest run` + `npm run build` |
| Build | Fim de fase ou task de config | `npm run build; npm run lint` |

**Pre-requisito do `Run int`**: Docker rodando (Testcontainers cria um Postgres descartavel por suite).

---

## Execution Plan

Phases ordenadas e sequenciais; tasks dentro da fase executam em ordem. Cada seta e o `Depends on` correspondente.

### Fase 1: Fundacao (scaffold, schema, migrations)

```
T1 → T2
T1 → T3
T3 → T4
T3 → T5
T3 → T6
T3 → T7
T3 → T8
T5 → T6
T4 → T9
T5 → T9
T6 → T9
T7 → T9
T8 → T9
```

### Fase 2: Dominio puro (unit, zero banco)

```
T1 → T10
T10 → T12
```

(T11 nao tem dependencias)

### Fase 3: Servicos com banco (integration)

```
T9 → T13
T10 → T13
T12 → T13
T13 → T14
T13 → T15
T14 → T15
T13 → T16
T12 → T16
```

### Fase 4: Interface minima

```
T14 → T17
T15 → T17
T16 → T17
T16 → T18
T17 → T19
```

---

## Task Breakdown

### T1: Scaffold Next.js + TypeScript

**What**: criar o app Next.js (App Router) com TypeScript, ESLint, Tailwind e scripts `dev`/`build`/`lint` no npm
**Where**: `package.json`
**Depends on**: None
**Reuses**: `create-next-app` (App Router, TS, ESLint, Tailwind) - substituted by manual scaffold: create-next-app refuses a non-empty directory
**Requirement**: fundacao para todos os RES

**Done when**:

- [x] `npm run dev` sobe o app; `npm run build` e `npm run lint` passam
- [x] Route groups `(admin)` e `(site)` criados vazios

**Tests**: none
**Gate**: build

**Commit**: `chore(next): scaffold app com typescript, eslint e tailwind`

---

### T2: Setup Vitest

**What**: Vitest configurado com script `test` e um teste fuminha verdes
**Where**: `vitest.config.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: fundacao de testes do AD-003

**Done when**:

- [x] `npx vitest run` executa o teste fuminha (verde)
- [x] Convencão registrada: `*.test.ts` = unit, `*.int.test.ts` = integration

**Tests**: unit
**Gate**: quick

**Commit**: `chore(test): setup vitest`

---

### T3: Drizzle + client de banco

**What**: configurar Drizzle ORM (client Postgres, `drizzle.config.ts`, scripts `db:generate`/`db:migrate`), lendo `DATABASE_URL`
**Where**: `drizzle.config.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: fundacao do AD-002

**Done when**:

- [x] `npm run db:generate` gera migrations; `npm run db:migrate` aplica contra DATABASE_URL
- [x] Build passa

**Tests**: none
**Gate**: build

**Commit**: `chore(db): drizzle orm com migrations`

---

### T4: Schema de turmas

**What**: tabelas `class_types` e `class_slots` (weekday 1-7, start/end time, capacity >= 1, status) conforme PRD 12
**Where**: `src/db/schema/turmas.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: RES-01, RES-02

**Done when**:

- [x] Tipos Drizzle exportados; FKs e constraints de integridade presentes
- [x] Export agregado em `src/db/schema/index.ts`

**Tests**: none
**Gate**: build

**Commit**: `feat(db): schema de modalidades e turmas`

---

### T5: Schema de alunos e enrollments

**What**: tabelas `students` (campos minimos para FK e seed) e `fixed_enrollments` (start_date, end_date, status) conforme PRD 12
**Where**: `src/db/schema/alunos.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: RES-20

**Done when**:

- [x] Tipos Drizzle exportados e agregados no index do schema

**Tests**: none
**Gate**: build

**Commit**: `feat(db): schema de alunos e horarios fixos`

---

### T6: Schema de sessoes e reservas

**What**: tabelas `class_sessions` (session_date, status, unica por slot+data) e `bookings` (student, session, tipo, status, timestamps) conforme PRD 12
**Where**: `src/db/schema/sessoes.ts`
**Depends on**: T3, T5
**Reuses**: -
**Requirement**: RES-14 a RES-19

**Done when**:

- [x] Unique constraint da sessao por (class_slot_id, session_date) presente
- [x] Tipos Drizzle exportados e agregados no index do schema

**Tests**: none
**Gate**: build

**Commit**: `feat(db): schema de ocorrencias e reservas`

---

### T7: Schema de feriados e recessos

**What**: tabelas `holidays` (unica por data) e `studio_closures` (periodo) conforme PRD 12
**Where**: `src/db/schema/bloqueios.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: RES-11 a RES-13

**Done when**:

- [x] Unique por data em holidays presente
- [x] Tipos Drizzle exportados e agregados no index do schema

**Tests**: none
**Gate**: build

**Commit**: `feat(db): schema de feriados e recessos`

---

### T8: Testcontainer de Postgres

**What**: helper que sobe um Postgres descartavel (Testcontainers), aplica migrations e devolve client, reutilizado por todos os `*.int.test.ts`
**Where**: `src/test/postgres.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: fundacao do AD-003/AD-002

**Done when**:

- [x] Um `*.int.test.ts` de fuminha sobe container, aplica migrations e consulta Postgres

**Tests**: integration
**Gate**: full

**Commit**: `chore(test): testcontainer de postgres para testes de integracao`

---

### T9: Migration inicial + seed

**What**: migration com as tabelas do core + seed de 2 modalidades (Superioga Classico, Superioga Intenso) e alunos de teste (assumption do spec)
**Where**: `src/db/seed.ts`
**Depends on**: T4, T5, T6, T7, T8
**Reuses**: `src/test/postgres.ts`
**Requirement**: assumption "Alunos e modalidades iniciais"; RES-05

**Done when**:

- [x] `npm run db:migrate` aplica tudo sobre o container vazio
- [x] Teste de integracao do seed carrega modalidades e alunos de teste

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): migration inicial do core e seed de modalidades`

---

### T10: Date utils do estudio (dominio)

**What**: funcoes puras de America/Sao_Paulo: datas de ocorrencia de um slot entre duas datas, proxima ocorrencia, teste de data passada/hoje
**Where**: `src/modules/turmas/domain/ocorrencias.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: RES-06, RES-10

**Done when**:

- [x] Todo branch coberto por unit tests (incl. virada de mes e horario de verao no calculo de datas)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(turmas): dominio de datas das ocorrencias`

---

### T11: Validadores de turma (dominio)

**What**: funcoes puras de validacao de slot: fim > inicio, weekday 1-7, capacity >= 1, mensagem por campo
**Where**: `src/modules/turmas/domain/validadores.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: RES-03, RES-04

**Done when**:

- [ ] Cada regra com unit test verde no Run unit

**Tests**: unit
**Gate**: quick

**Commit**: `feat(turmas): validadores de turma no servidor`

---

### T12: Calculadora de composicao (dominio)

**What**: funcao pura que recebe (capacity, enrollments ativos na data, bookings ativos por tipo) e devolve {fixos, reposicoes, experimentais, total, vagas}
**Where**: `src/modules/reservas/domain/composicao.ts`
**Depends on**: T10
**Reuses**: -
**Requirement**: RES-08, RES-09

**Done when**:

- [ ] Unit tests cobrem o exemplo do PRD (5 fixos + 2 reposicoes + 1 experimental = 8, vagas 0)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(reservas): calculo de composicao e vagas da ocorrencia`

---

### T13: Servico get-or-create de sessoes

**What**: servico que materializa `class_sessions` sob demanda (idempotente), marca BLOQUEADA em feriado/recesso e recusa materializar para agendamento em data passada
**Where**: `src/modules/reservas/services/sessoes.ts`
**Depends on**: T9, T10, T12
**Reuses**: `src/test/postgres.ts`
**Requirement**: RES-06, RES-07, RES-10

**Done when**:

- [ ] Integration tests: cria na primeira consulta e re-consulta sem duplicar; feriado/recesso bloqueia; data passada recusada

**Tests**: integration
**Gate**: full

**Commit**: `feat(reservas): get-or-create de ocorrencias com bloqueios`

---

### T14: Servico de reserva transacional

**What**: criar reserva (FIXED individual, MAKEUP ou EXPERIMENTAL) em transacao: capacidade no servidor, recusa sem vaga, dedup por aluno+sessao, segunda aula do aluno no mesmo dia permitida ao admin
**Where**: `src/modules/reservas/services/reservas.ts`
**Depends on**: T13
**Reuses**: `src/test/postgres.ts`
**Requirement**: RES-14 a RES-19

**Done when**:

- [ ] Integration test de concorrencia: reservas paralelas disputam a ultima vaga -> exatamente 1 confirmada, demais recusadas
- [ ] Dedup, passado, auditoria e same-day admin com testes verdes

**Tests**: integration
**Gate**: full

**Commit**: `feat(reservas): reserva transacional com garantia de vaga`

---

### T15: Servico de enrollments

**What**: criar enrollment com checagem de vagas na proxima ocorrencia; encerrar por data/status; recusa em turma cheia; historico por aluno
**Where**: `src/modules/alunos/services/enrollments.ts`
**Depends on**: T13, T14
**Reuses**: `src/test/postgres.ts`
**Requirement**: RES-20 a RES-24

**Done when**:

- [ ] Integration tests: criacao atualiza composicao; encerramento deixa de contar desde a data; turma cheia recusa serial

**Tests**: integration
**Gate**: full

**Commit**: `feat(alunos): servico de horarios fixos`

---

### T16: CRUD turmas/modalidades + servico de composicao

**What**: servico CRUD de class_types/class_slots com validacoes (RES-03/04/05) e o servico unico de leitura de composicao por (slot, data)
**Where**: `src/modules/turmas/services/turmas.ts`
**Depends on**: T13, T12
**Reuses**: `src/modules/reservas/domain/composicao.ts`, `src/test/postgres.ts`
**Requirement**: RES-01, RES-02, RES-05, RES-27

**Done when**:

- [ ] Integration tests: CRUD com validacoes e leitura de composicao verdes

**Tests**: integration
**Gate**: full

**Commit**: `feat(turmas): crud de turmas e leitura de composicao`

---

### T17: Server actions do admin

**What**: server actions finas para turma, modalidade, reserva e enrollment que chamam os servicos (sem auth nesta slice) e devolvem erros de validacao
**Where**: `src/modules/turmas/actions.ts`
**Depends on**: T14, T15, T16
**Reuses**: servicos dos modulos
**Requirement**: RES-03 (Propagate), RES-14

**Done when**:

- [ ] Teste de integracao da action de turma: sucesso e erro de validacao propagado

**Tests**: integration
**Gate**: full

**Commit**: `feat(admin): server actions para turmas e reservas`

---

### T18: Endpoint publico de agenda

**What**: route GET que devolve data, horario, modalidade e vagas para um periodo, sem dados pessoais e sem slots inativos
**Where**: `src/app/(site)/api/agenda/route.ts`
**Depends on**: T16
**Reuses**: servico de composicao de T16
**Requirement**: RES-25, RES-26

**Done when**:

- [ ] Integration test do route: happy path, slot inativo ausente, nomes ausentes

**Tests**: integration
**Gate**: full

**Commit**: `feat(site): agenda publica sem dados pessoais`

---

### T19: Tela admin minima

**What**: pagina no route group `(admin)` que lista a grade da semana, composicao por ocorrencia (fixos/reposicoes/experimentais/vagas) e formularios minimos de reserva manual e enrollment
**Where**: `src/app/(admin)/grade/page.tsx`
**Depends on**: T17
**Reuses**: actions e servicos de T16/T17
**Requirement**: RES-05, RES-08, RES-27 (visual); walk valida

**Done when**:

- [ ] Composicao exibida por ocorrencia (as tres perguntas do negocio)
- [ ] Form de reserva grava via action; erro de vaga mostra mensagem clara
- [ ] Rotas/junturas visitadas no walk (browser) sem erro de render

**Tests**: none
**Gate**: build

**Commit**: `feat(admin): tela minima de grade e reserva`

---

## Checks

**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose "**/*.int.test.ts"`

**C1** - Turma criada pelo admin fica ativa com dia/horario/modalidade (RES-01, AC 1)
Proof: run unit | ✓ validadores > aceita turma valida

**C2** - Turma sem capacidade gravada recebe 8 (RES-02, AC 2)
Proof: run int | ✓ turmas > capacidade default e oito

**C3** - Fim<=inicio, weekday fora de 1-7 ou capacidade < 1 recusam com o campo apontado (RES-03, AC 3)
Proof: run unit | ✓ validadores > recusa fim menor ou igual ao inicio

**C4** - Editar/desativar turma reflete nas ocorrencias futuras (RES-04, AC 4)
Proof: run int | ✓ turmas > desativar turma altera ocorrencias futuras

**C5** - Duas modalidades do PRD seedadas (RES-05, AC 5)
Proof: run int | ✓ seed > duas modalidades do PRD

**C6** - Get-or-create materializa a ocorrencia de (slot, data) sob demanda (RES-06, AC 1)
Proof: run int | ✓ sessoes > cria na primeira consulta e reconsulta sem duplicar

**C7** - Feriado/recesso deixa a ocorrencia BLOQUEADA e recusa reservas (RES-07, AC 2)
Proof: run int | ✓ sessoes > feriado bloqueia a ocorrencia

**C8** - Composicao da ocorrencia: fixos/reposicoes/experimentais/total/vagas (RES-08, AC 3)
Proof: run int | ✓ composicao > exemplo do PRD 5+2+1 cap 8 vagas zero

**C9** - Enrollment ativo conta como fixo; encerrado deixa de contar (RES-09, AC 4)
Proof: run int | ✓ enrollments > encerrado sai do contador da data

**C10** - Data passada: apenas leitura (RES-10, AC 5)
Proof: run int | ✓ sessoes > recusa materializar data passada

**C11** - Feriado cadastrado bloqueia as ocorrencias da data (RES-11, AC 1)
Proof: run int | ✓ feriados > cria bloqueio da data

**C12** - Recesso com extremos inclusos gera bloqueio no intervalo (RES-12, AC 2)
Proof: run int | ✓ feriados > recesso inclui extremos

**C13** - Feriado duplicado para a mesma data recusado (RES-13, AC 3)
Proof: run int | ✓ feriados > recusa data repetida

**C14** - Reserva manual em ocorrencia com vaga confirma e ocupa a vaga (RES-14, AC 1)
Proof: run int | ✓ reservas > confirma com vaga disponivel

**C15** - Ocorrencia sem vaga recusa sem estado parcial (RES-15, AC 2)
Proof: run int | ✓ reservas > recusa sem vaga com mensagem clara

**C16** - Reservas concorrentes na ultima vaga: exatamente uma confirmada (RES-16, AC 3; teste do PRD)
Proof: run int | ✓ reservas > concorrencia na ultima vaga confirma uma

**C17** - Reserva duplicada mesmo aluno+sessao recusada (RES-17, AC 4)
Proof: run int | ✓ reservas > recusa duplicada na mesma sessao

**C18** - Reserva em data passada recusada (RES-18, AC 5)
Proof: run int | ✓ reservas > recusa data passada

**C19** - Reserva confirmada registrada com student, session, tipo, status e timestamps (RES-19, AC 6)
Proof: run int | ✓ reservas > registra dados de auditoria

**C20** - Admin marca segunda aula do aluno no mesmo dia (RES-16, AC 5; AD-011)
Proof: run int | ✓ reservas > segunda aula no mesmo dia com admin

**C21** - Enrollment criado com vaga fica ativo a partir da data inicial (RES-20, AC 1)
Proof: run int | ✓ enrollments > cria e conta do start_date

**C22** - Enrollment sem vaga na proxima ocorrencia recusado (RES-21, AC 2)
Proof: run int | ✓ enrollments > recusa turma cheia na proxima ocorrencia

**C23** - Composicao excedente recusada antes de persistir (RES-22, AC 3)
Proof: run int | ✓ enrollments > capacidade checada antes de gravar

**C24** - end_date/inativo deixa de contar a partir da data (RES-23, AC 4)
Proof: run int | ✓ enrollments > end_date remove contagem apos o fim

**C25** - Historico de enrollments consulta por aluno (RES-24, AC 5)
Proof: run int | ✓ enrollments > historico do aluno

**C26** - Agenda publica: data/horario/modalidade/vagas sem dados pessoais (RES-25, AC 1)
Proof: run int | ✓ agenda > periodo sem dados pessoais

**C27** - Slot inativo ausente da agenda publica (RES-26, AC 2)
Proof: run int | ✓ agenda > slot inativo fora da lista

(RES-27, AC 1 - servico unico: exercitado por C8 e C26; sem teste proprio)

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-06 - user autorizou T1 como desbloqueio do build gate ("T1 primeiro, gate depois") e 3 batch workers para o restante ("3 batch workers")
**Dispatched:** batch A (fase 1 restante: T2-T9) at HEAD 1cc7e73 - sent 2026-11-06; returned: 2026-11-06, T2-T9 todos commitados, gates verdes vitest 5/5 + build + lint, desvios: auto-correção de fuminha próprio do T8, seed fixado em 4 alunos (spec-precision gap registrado), sem script db:seed
Batch B (fases 2-3: T10-T16) at HEAD e3b0cfa - sent 2026-11-06; returned: pending
**Walked:** none yet

---

## Phase Execution Map

```
Fase 1 → Fase 2 → Fase 3 → Fase 4

T1 → T2
T1 → T3
T3 → T4
T3 → T5
T3 → T6
T3 → T7
T3 → T8
T5 → T6
T4 → T9
T5 → T9
T6 → T9
T7 → T9
T8 → T9
T1 → T10
T10 → T12
T9 → T13
T10 → T13
T12 → T13
T13 → T14
T13 → T15
T14 → T15
T13 → T16
T12 → T16
T14 → T17
T15 → T17
T16 → T17
T16 → T18
T17 → T19
```

Execution e estritamente sequencial - um worker trabalha uma task por vez, em ordem.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 scaffold | manifest + gerador | OK |
| T2 vitest | 1 config + 1 teste | OK |
| T3 drizzle | 1 config | OK |
| T4-T7 schema | 1 arquivo cada (2 tabelas coesas) | OK |
| T8 testcontainer | 1 helper | OK |
| T9 migration+seed | 1 seed | OK |
| T10-T12 dominio | 1 funcao cada | OK |
| T13-T16 servicos | 1 servico cada | OK |
| T17 actions | 1 arquivo de actions | OK |
| T18 endpoint | 1 route | OK |
| T19 tela | 1 pagina | OK |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram shows | Status |
| --- | --- | --- | --- |
| T1 | None | inicio | OK |
| T2 | T1 | T1→T2 | OK |
| T3 | T1 | T1→T3 | OK |
| T4 | T3 | T3→T4 | OK |
| T5 | T3 | T3→T5 | OK |
| T6 | T3, T5 | T3→T6, T5→T6 | OK |
| T7 | T3 | T3→T7 | OK |
| T8 | T3 | T3→T8 | OK |
| T9 | T4, T5, T6, T7, T8 | arrows to T9 | OK |
| T10 | T1 | T1→T10 | OK |
| T11 | None | inicio | OK |
| T12 | T10 | T10→T12 | OK |
| T13 | T9, T10, T12 | arrows to T13 | OK |
| T14 | T13 | T13→T14 | OK |
| T15 | T13, T14 | arrows to T15 | OK |
| T16 | T13, T12 | arrows to T16 | OK |
| T17 | T14, T15, T16 | arrows to T17 | OK |
| T18 | T16 | T16→T18 | OK |
| T19 | T17 | T17→T19 | OK |

Nota: o diagrama da Execution Plan lista a mesma relacao dos `Depends on` - nenhuma dependencia aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T2 | smoke de config | unit | unit | OK |
| T8, T9 | migrations / schema | integration | integration | OK |
| T10-T12 | dominio | unit | unit | OK |
| T13-T17 | servicos / actions | integration | integration | OK |
| T18 | route | integration | integration | OK |
| T19 | UI | none | none | OK |
