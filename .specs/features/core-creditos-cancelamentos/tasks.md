# Core Créditos e Cancelamentos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - schema, módulos e serviços rascunhados na seção "Design (inline)" do spec; sem design.md separado
**Status**: Approved
**Approved**: 2026-11-09 - user: "Aprovar as tasks"
**Build**: `npm run build; npm run lint`
**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose int.test`

---

## Test Coverage Matrix

> Gerada do codebase existente (feature `core-turmas-reservas`: 21 unit + 57 integration em `src/**/__tests__/*.test.ts` e `*.int.test.ts`, Testcontainers em `src/test/postgres.ts`) e do spec - confirmar antes do Execute. Nenhum guideline de qualidade encontrado no repo: defaults fortes aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domínio de créditos (antecedência 24h, status efetivo, semana) | unit | Todos os branches; 1:1 com os ACs do spec; cada edge case com teste | `src/**/__tests__/*.test.ts` | Run unit |
| Serviços de créditos (transações, ledger, não comparecimento, reposição, cancelamento do estúdio) | integration | Cada AC do serviço, incl. concorrência e fronteira de 24h | `src/**/__tests__/*.int.test.ts` | Run int |
| Integração com reservas e composição (crédito exigido na reserva MAKEUP, fixo cancelado fora da composição) | integration | Cada AC alterado + regressão dos ACs do core (nenhuma reserva existente quebra) | `src/**/__tests__/*.int.test.ts` | Run int |
| Migrations / schema | integration | Migration aplica limpo em Postgres vazio; índices únicos rejeitam duplicidade | `src/**/__tests__/*.int.test.ts` | Run int |
| Server actions de créditos | integration | Action: happy + erro de validação (motivo vazio, crédito ausente, recorrência negada) | `src/**/__tests__/*.int.test.ts` | Run int |
| UI admin mínima (render) | none | Julgada pelo walk (browser) + build gate; os ACs por trás dela são testados nos serviços e nas actions | - | walk + Build |

## Gate Check Commands

> Geradas dos scripts do repo (`package.json`) - confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com unit tests apenas | `npx vitest run --exclude "**/*.int.test.ts"` |
| Full | Tasks com integration tests | `npx vitest run` |
| Build | Fim de fase ou task de config/schema | `npm run build; npm run lint` |

**Pre-requisito do `Run int`**: Docker rodando (Testcontainers cria um Postgres descartável por suite).

---

## Execution Plan

Phases ordenadas e sequenciais; tasks dentro da fase executam em ordem. Cada seta é o `Depends on` correspondente.

### Phase 1 - Schema e migração

```
T1 → T3
T2 → T3
```

### Phase 2 - Domínio puro (unit, zero banco)

```
T4, T5, T6 (sem dependências entre elas)
```

### Phase 3 - Ledger, transações e cancelamento do fixo

```
T7 → T8 → T9
```

### Phase 4 - Integração com reservas, reposição e cancelamento pelo estúdio

```
T10 → T12 → T13 → T14
```

### Phase 5 - Interface mínima

```
T15 → T16 → T17
T15 → T18
```

---

## Task Breakdown

### T1: Schema de créditos e transações

**What**: tabelas `credits` (aluno, origem, sessão/reserva de origem, geração, vencimento, status, reserva de uso, responsável) e `credit_transactions` (crédito, ação, estado anterior, novo estado, motivo, responsável, data), com os enums de origem e status do PRD 6.2 e os índices únicos de origem
**Where**: `src/db/schema/credits.ts`
**Depends on**: None
**Reuses**: padrão de `src/db/schema/sessions.ts` (pgEnum, uuid, uniqueIndex) e o export agregado em `src/db/schema/index.ts`
**Requirement**: CRD-11, CRD-12, CRD-14

**Done when**:

- [ ] Enums `origem_credito` (CANCELAMENTO_AULA_FIXA, CANCELAMENTO_ESTUDIO, CONCESSAO_MANUAL) e `status_credito` (DISPONIVEL, RESERVADO, UTILIZADO, VENCIDO, CANCELADO) exportados
- [ ] `credits` com FK para `students`, `bookings` e `class_sessions`, `expires_at` e `generated_at` não nulos
- [ ] `credit_transactions` com `reason` não nulo e `previous_status`/`new_status`
- [ ] Índice único `(student_id, source, source_booking_id)` e `(student_id, source, source_session_id)` (parcial, quando a coluna não é nula)
- [ ] Export agregado em `src/db/schema/index.ts` atualizado
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(db): schema de creditos e transacoes`

---

### T2: Schema de reservas com falta e cancelamento

**What**: `bookings` ganha o status `FALTA`, `cancelled_at` e `cancelled_by` (ALUNO | ESTUDIO), e um índice único parcial `(student_id, class_session_id)` para `booking_type = FIXED`, que impede dois registros do mesmo aluno na mesma ocorrência
**Where**: `src/db/schema/sessions.ts`
**Depends on**: None
**Reuses**: enums e estilo de `src/db/schema/sessions.ts`
**Requirement**: CRD-02, CRD-03, CRD-07

**Done when**:

- [ ] `bookingStatusEnum` aceita `FALTA`
- [ ] `cancelled_at` e `cancelled_by` presentes em `bookings`
- [ ] Índice único parcial para `booking_type = FIXED` criado
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(db): status de falta e cancelamento nas reservas`

---

### T3: Migração das tabelas de crédito

**What**: migration Drizzle que cria `credits`, `credit_transactions`, o status `FALTA`, as colunas de cancelamento e o índice único parcial de `bookings`
**Where**: drizzle
**Depends on**: T1, T2
**Reuses**: `src/db/migrate.ts` (runner) e o helper de container em `src/test/postgres.ts`
**Requirement**: CRD-11, CRD-14

**Done when**:

- [ ] `npm run db:generate` gera a migration e `npm run db:migrate` aplica sobre Postgres vazio sem erro
- [ ] Teste de integração sobe o container, aplica as migrations e confirma que o índice único de `bookings` FIXED rejeita duas linhas do mesmo aluno na mesma ocorrência
- [ ] Teste de integração confirma que o índice único de origem do crédito rejeita dois créditos com a mesma origem
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(db): migration de creditos e ajuste de reservas`

---

### T4: Regras de antecedência e validade

**What**: funções puras que calculam a antecedência em horas entre o instante atual e o início da aula no fuso America/Sao_Paulo, dizem se a antecedência é elegível (24h ou mais) e calculam o vencimento do crédito (geração + 30 dias)
**Where**: `src/modules/credits/domain/credit-rules.ts`
**Depends on**: None
**Reuses**: `src/modules/classes/domain/occurrences.ts` (fuso do estúdio)
**Requirement**: CRD-02, CRD-03, CRD-04, CRD-05, CRD-06

**Done when**:

- [ ] `hoursUntilOccurrence` devolve a diferença em horas entre `now` e o início da ocorrência, no fuso America/Sao_Paulo
- [ ] `isEligibleForCredit` aceita 24 horas exatas e rejeita 23h59
- [ ] `creditExpiresAt` devolve a geração + 30 dias
- [ ] Unit tests cobrem: antecedência medida no fuso do estúdio, 24h exatas elegível, 23h59 não elegível, vencimento em 30 dias
- [ ] Gate check passa: `npx vitest run --exclude "**/*.int.test.ts"`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credits): regras de antecedencia de 24h e validade`

---

### T5: Status efetivo do crédito na leitura

**What**: função pura que resolve o status efetivo de um crédito na leitura - CANCELADO e UTILIZADO são terminais, RESERVADO com ocorrência encerrada vira UTILIZADO, vencimento vencido vira VENCIDO, senão vale o status persistido
**Where**: `src/modules/credits/domain/credit-status.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: CRD-13, CRD-44

**Done when**:

- [ ] `effectiveCreditStatus` aplica a ordem CANCELADO > UTILIZADO persistido > RESERVADO encerrado > VENCIDO > status persistido
- [ ] Unit tests cobrem: crédito vencido como VENCIDO, reserva com ocorrência encerrada como UTILIZADO, CANCELADO terminal, crédito válido como DISPONIVEL
- [ ] Gate check passa: `npx vitest run --exclude "**/*.int.test.ts"`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credits): status efetivo do credito na leitura`

---

### T6: Semana de segunda a domingo

**What**: funções puras que devolvem a semana (segunda a domingo, America/Sao_Paulo) de uma data e contam as reposições ativas dentro dela
**Where**: `src/modules/credits/domain/credit-week.ts`
**Depends on**: None
**Reuses**: `src/modules/classes/domain/occurrences.ts` (datas do estúdio)
**Requirement**: CRD-19, CRD-20

**Done when**:

- [ ] `weekKey` devolve o mesmo valor para as sete datas da mesma semana e valores diferentes para a semana seguinte
- [ ] `countWeeklyMakeups` conta só as reservas MAKEUP ativas cuja data de ocorrência cai na semana informada
- [ ] Unit tests cobrem: início da semana na segunda, virada de semana, contagem ignorando reposições de outra semana e reservas canceladas
- [ ] Gate check passa: `npx vitest run --exclude "**/*.int.test.ts"`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credits): semana de segunda a domingo e contagem de reposicoes`

---

### T7: Transações de crédito

**What**: serviço que grava a alteração de status de um crédito com estado anterior, novo estado, ação, motivo e responsável, e recusa alteração manual sem motivo
**Where**: `src/modules/credits/services/transactions.ts`
**Depends on**: T3, T4
**Reuses**: padrão de transação do `DbClient` dos serviços de `src/modules/bookings/services/`
**Requirement**: CRD-15, CRD-16

**Done when**:

- [ ] `recordCreditTransaction` grava crédito, ação, estado anterior, novo estado, motivo, responsável e data
- [ ] Alteração manual com motivo vazio é recusada, sem gravar nada
- [ ] Testes de integração cobrem: transação com estado anterior e novo estado, recusa sem motivo
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): transacoes de credito com motivo e responsavel`

---

### T8: Ledger de créditos

**What**: serviço de crédito com conceder, devolver, cancelar, liquidar (vencidos e utilizados), listar por aluno e listar os disponíveis que vencem nos próximos 7 dias, com trava de linha para impedir duplicidade e uso de crédito vencido
**Where**: `src/modules/credits/services/credits.ts`
**Depends on**: T3, T5, T7
**Reuses**: `src/modules/credits/services/transactions.ts`, `src/modules/credits/domain/credit-status.ts`
**Requirement**: CRD-11, CRD-12, CRD-13, CRD-14, CRD-34, CRD-35, CRD-36, CRD-37, CRD-38

**Done when**:

- [ ] `grantCredit` cria crédito DISPONIVEL com vencimento +30 dias e registra a transação
- [ ] `returnCredit` volta o status a DISPONIVEL mantendo o `expires_at` original, a partir de RESERVADO, UTILIZADO ou CANCELADO
- [ ] `cancelCredit` marca CANCELADO e registra a transação
- [ ] `listStudentCredits` devolve geração, vencimento, status, origem e as transações de cada crédito
- [ ] `listCreditsExpiringSoon` devolve só os DISPONIVEL que vencem nos próximos 7 dias
- [ ] Segunda crédito com a mesma origem é recusado (índice único + trava de linha)
- [ ] Crédito vencido é recusado para uso
- [ ] Testes de integração cobrem: conceder, devolver, cancelar, listar por aluno, vencimentos próximos, origem duplicada e crédito vencido bloqueado
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): ledger de creditos`

---

### T9: Aviso de não comparecimento do aluno fixo

**What**: serviço que registra, em nome do aluno, o aviso de não comparecimento numa ocorrência: cria o registro do aluno na ocorrência, classifica entre cancelamento (24h ou mais) e falta (menos de 24h), gera o crédito quando elegível e mantém o vínculo fixo ativo
**Where**: `src/modules/credits/services/cancellations.ts`
**Depends on**: T3, T4, T8
**Reuses**: `src/modules/credits/domain/credit-rules.ts`, `src/modules/credits/services/credits.ts`
**Requirement**: CRD-01, CRD-02, CRD-03, CRD-04, CRD-05, CRD-06, CRD-07, CRD-08, CRD-10

**Done when**:

- [ ] `registerNonAttendance` cria o registro do aluno na ocorrência e libera a vaga
- [ ] Antecedência de 24h ou mais registra cancelamento; menos de 24h registra falta
- [ ] Antecedência de 24h ou mais gera 1 crédito DISPONIVEL de origem CANCELAMENTO_AULA_FIXA com vencimento +30 dias
- [ ] 24h exatas geram crédito; 23h59 registram falta e não geram crédito
- [ ] Segundo aviso na mesma ocorrência é recusado, sem crédito novo e sem histórico duplicado
- [ ] O enrollment fixo do aluno continua ativo e o aluno segue contando como fixo nas ocorrências futuras
- [ ] O histórico do aluno guarda o cancelamento ou a falta com data, hora, ocorrência, antecedência e responsável
- [ ] Testes de integração cobrem todos esses casos
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): aviso de nao comparecimento do aluno fixo`

### T10: Reserva de reposição exige crédito

**What**: `createBooking` passa a exigir, no tipo MAKEUP, um crédito DISPONIVEL válido do aluno, e reserva o crédito (RESERVADO) vinculado à reserva criada
**Where**: `src/modules/bookings/services/bookings.ts`
**Depends on**: T8
**Reuses**: `src/modules/credits/services/credits.ts` (reserva de crédito com trava de linha)
**Requirement**: CRD-17, CRD-18, CRD-21

**Done when**:

- [ ] Reserva MAKEUP sem `creditId` é recusada, sem criar reserva
- [ ] Reserva MAKEUP com crédito DISPONIVEL válido cria a reserva, marca o crédito RESERVADO e liga `used_booking_id`
- [ ] Crédito vencido ou já reservado é recusado
- [ ] Reservas FIXED e EXPERIMENTAL seguem sem exigir crédito (regressão do core)
- [ ] Testes de integração cobrem: sem crédito, com crédito válido, crédito vencido e os tipos sem crédito
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(reservas): reposicao exige credito valido`

---

### T11: Composição desconta o fixo cancelado

**What**: `getOccurrenceComposition` subtrai do total os alunos fixos com registro de cancelamento ou falta na ocorrência, devolvendo uma vaga a mais
**Where**: `src/modules/bookings/services/composition.ts`
**Depends on**: T9
**Reuses**: `src/modules/bookings/domain/composition.ts` (fonte única da conta)
**Requirement**: CRD-09

**Done when**:

- [ ] Aluno fixo com registro CANCELADA ou FALTA na ocorrência não conta como fixo na composição daquela ocorrência
- [ ] O mesmo aluno segue contando como fixo nas ocorrências futuras
- [ ] Testes de integração cobrem: fixo cancelado fora da composição, vaga liberada e aluno fixo nas ocorrências seguintes
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(reservas): composicao desconta o fixo cancelado na ocorrencia`

---

### T12: Reposição — elegibilidade, agendamento e cancelamento

**What**: serviço de reposição com elegibilidade do aluno (crédito válido e abaixo do limite da semana), listagem de turmas-alvo com vaga, agendamento pelo autoatendimento (com limite de 2 por semana) e pelo admin (sem limite), e cancelamento com devolução do crédito (24h ou mais) ou cancelamento definitivo do crédito (menos de 24h)
**Where**: `src/modules/credits/services/makeups.ts`
**Depends on**: T6, T8, T10
**Reuses**: `src/modules/credits/domain/credit-week.ts`, `src/modules/bookings/services/bookings.ts` (criação da reserva), `src/modules/credits/services/credits.ts`
**Requirement**: CRD-17, CRD-19, CRD-20, CRD-21, CRD-22, CRD-23, CRD-24, CRD-25, CRD-26, CRD-27

**Done when**:

- [ ] `getMakeupEligibility` informa crédito válido disponível e se a semana da ocorrência ainda comporta reposição
- [ ] `listMakeupTargets` devolve só turmas com vaga
- [ ] Autoatendimento recusa a terceira reposição da semana, contando as reservas MAKEUP ativas da semana da ocorrência
- [ ] Agendamento pelo admin funciona com a semana já cheia
- [ ] Duas reservas concorrentes com o mesmo crédito confirmam exatamente uma, com o crédito reservado uma única vez
- [ ] Reposição funciona em qualquer modalidade de turma
- [ ] Cancelamento com 24h ou mais devolve o crédito a DISPONIVEL com o vencimento original; com menos de 24h cancela o crédito definitivamente
- [ ] Cancelar uma reposição não gera crédito novo
- [ ] Testes de integração cobrem todos esses casos
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): agendamento e cancelamento de reposicao`

---

### T13: Cancelamento de aula pelo estúdio

**What**: serviço que cancela uma ocorrência pelo estúdio, cancela as reservas ativas dela, devolve à DISPONIVEL o crédito das reposições canceladas e gera 1 crédito CANCELAMENTO_ESTUDIO por aluno fixo afetado, sem duplicar quando o cancelamento é repetido
**Where**: `src/modules/credits/services/cancellations.ts`
**Depends on**: T9, T12
**Reuses**: `src/modules/credits/services/credits.ts`, `src/modules/credits/services/makeups.ts`
**Requirement**: CRD-28, CRD-29, CRD-30, CRD-31, CRD-33

**Done when**:

- [ ] A ocorrência passa a CANCELADA e as reservas ativas dela são canceladas
- [ ] Cada aluno fixo afetado recebe 1 crédito DISPONIVEL de origem CANCELAMENTO_ESTUDIO com vencimento +30 dias
- [ ] O crédito de uma reposição cancelada volta a DISPONIVEL com o vencimento original
- [ ] Repetir o cancelamento da mesma ocorrência não gera créditos duplicados
- [ ] Aluno que já avisou falta (sem crédito) recebe o crédito do estúdio; aluno que já tem crédito daquela ocorrência não recebe um segundo
- [ ] Testes de integração cobrem todos esses casos
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(credits): cancelamento de aula pelo estudio`

---

### T14: Edição de dia/horário gera créditos

**What**: `cancelFutureSessions` gera 1 crédito CANCELAMENTO_ESTUDIO por aluno fixo afetado em cada ocorrência futura antiga que a edição de dia/horário cancela
**Where**: `src/modules/bookings/services/sessions.ts`
**Depends on**: T13
**Reuses**: `src/modules/credits/services/cancellations.ts`
**Requirement**: CRD-32

**Done when**:

- [ ] Editar o dia ou o horário da turma cancela as ocorrências futuras antigas, cancela as reservas delas e gera 1 crédito por fixo afetado em cada ocorrência cancelada
- [ ] O crédito gerado tem origem CANCELAMENTO_ESTUDIO e vencimento +30 dias
- [ ] Testes de integração cobrem: 8 ocorrências x 4 fixos = 32 créditos, e nenhuma ocorrência futura antiga sobrevive
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(reservas): edicao de dia e horario gera credito por ocorrencia`

---

### T15: Server actions de créditos

**What**: server actions finas que chamam os serviços de crédito sem repetir regra: conceder, devolver e cancelar crédito (com motivo obrigatório), registrar não comparecimento, cancelar aula e agendar reposição manual escolhendo o crédito do aluno
**Where**: `src/modules/credits/actions.ts`
**Depends on**: T8, T9, T12, T13
**Reuses**: serviços de `src/modules/credits/services/` e o padrão de actions de `src/modules/classes/actions.ts`
**Requirement**: CRD-34, CRD-35, CRD-36, CRD-40, CRD-41, CRD-42, CRD-43

**Done when**:

- [ ] Action de conceder crédito devolve o novo status e a transação registrada
- [ ] Action de devolver crédito devolve o novo status; action de cancelar crédito devolve o novo status
- [ ] Alteração manual sem motivo é recusada pela action
- [ ] Action de não comparecimento devolve o resultado do registro (crédito gerado ou falta sem crédito)
- [ ] Action de cancelar aula devolve as reservas canceladas e a quantidade de créditos gerados
- [ ] Action de reposição manual sem crédito escolhido é recusada; com crédito válido confirma
- [ ] Testes de integração cobrem: action de conceder, action sem motivo, action de não comparecimento, action de cancelar aula e action de reposição manual
- [ ] Gate check passa: `npx vitest run`

**Tests**: integration
**Gate**: full

**Commit**: `feat(admin): server actions de creditos`

---

### T16: Forms de crédito e cancelamento na grade

**What**: forms da grade para registrar não comparecimento de um aluno fixo, cancelar a aula do estúdio e agendar reposição manual exigindo a escolha de um crédito DISPONIVEL do aluno
**Where**: `src/app/(admin)/grade/booking-forms.tsx`
**Depends on**: T15
**Reuses**: actions de `src/modules/credits/actions.ts` e o padrão de forms de `src/app/(admin)/grade/booking-forms.tsx`
**Requirement**: CRD-41, CRD-42, CRD-43

**Done when**:

- [ ] Form de não comparecimento lista os alunos fixos da ocorrência e mostra o resultado do registro
- [ ] Form de cancelar aula mostra as reservas canceladas e a quantidade de créditos gerados
- [ ] Form de reposição manual lista os créditos DISPONIVEL do aluno e não confirma sem escolha
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(admin): forms de credito e cancelamento na grade`

---

### T17: Página da grade com participantes e resultado das ações

**What**: a página da grade mostra, por ocorrência, os participantes (fixos e reservas) e o resultado devolvido pelas novas actions
**Where**: `src/app/(admin)/grade/page.tsx`
**Depends on**: T16
**Reuses**: `src/modules/bookings/services/composition.ts` e as actions de `src/modules/credits/actions.ts`
**Requirement**: CRD-41, CRD-42

**Done when**:

- [ ] Cada ocorrência da grade lista os participantes: fixos e reservas
- [ ] O resultado das novas actions aparece na página (crédito gerado, falta sem crédito, reservas canceladas, quantidade de créditos)
- [ ] Rotas visitadas no walk (browser) sem erro de render
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(admin): grade lista participantes e resultado das acoes`

---

### T18: Tela de créditos do aluno

**What**: página no route group `(admin)` que lista os créditos de um aluno com geração, vencimento, status, origem e transações, e permite conceder, devolver e cancelar crédito com motivo
**Where**: `src/app/(admin)/creditos/page.tsx`
**Depends on**: T15
**Reuses**: actions de `src/modules/credits/actions.ts` e o padrão de página admin de `src/app/(admin)/grade/page.tsx`
**Requirement**: CRD-39, CRD-40

**Done when**:

- [ ] A tela lista os créditos do aluno com geração, vencimento, status, origem e as transações de cada crédito
- [ ] A tela permite conceder, devolver e cancelar crédito, exigindo o motivo
- [ ] Após a ação, a tela mostra o novo status e a transação registrada
- [ ] Rota visitada no walk (browser) sem erro de render
- [ ] Gate check passa: `npm run build; npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(admin): tela de creditos do aluno`

---

## Checks

**Run unit**: `npx vitest run --reporter=verbose --exclude "**/*.int.test.ts"`
**Run int**: `npx vitest run --reporter=verbose int.test`

**C1** - O aviso de não comparecimento cria o registro do aluno na ocorrência e libera a vaga (CRD-01, AC 1)
Proof: run int | ✓ non attendance > creates the occurrence record and releases the spot

**C2** - Antecedência de 24h ou mais registra cancelamento na ocorrência (CRD-02, AC 2)
Proof: run int | ✓ non attendance > records the cancellation when the notice is 24 hours or more
Proof: run unit | ✓ credit rules > measures the hours until the class start in the studio timezone

**C3** - Antecedência menor que 24h registra falta na ocorrência (CRD-03, AC 3)
Proof: run int | ✓ non attendance > records the absence when the notice is under 24 hours

**C4** - Antecedência de 24h ou mais gera 1 crédito DISPONIVEL CANCELAMENTO_AULA_FIXA com vencimento +30 dias (CRD-04, AC 4)
Proof: run int | ✓ non attendance > grants a credit when the notice is 24 hours or more
Proof: run unit | ✓ credit rules > sets the credit expiry 30 days after the generation

**C5** - Antecedência de exatamente 24 horas gera o crédito (CRD-05, AC 5)
Proof: run int | ✓ non attendance > grants a credit at exactly 24 hours
Proof: run unit | ✓ credit rules > treats exactly 24 hours as eligible

**C6** - Antecedência de 23h59 registra falta e não gera crédito (CRD-06, AC 6)
Proof: run int | ✓ non attendance > grants no credit at 23 hours 59 minutes
Proof: run unit | ✓ credit rules > treats 23 hours 59 minutes as not eligible

**C7** - Segundo aviso na mesma ocorrência é recusado, sem crédito novo e sem duplicar histórico (CRD-07, AC 7)
Proof: run int | ✓ non attendance > refuses a second notice for the same occurrence

**C8** - O cancelamento é pontual: o vínculo fixo do aluno continua ativo nas ocorrências futuras (CRD-08, AC 8)
Proof: run int | ✓ non attendance > keeps the fixed enrollment active for the next occurrences

**C9** - O aluno cancelado ou faltante sai da composição e a vaga disponível sobe em 1 (CRD-09, AC 9)
Proof: run int | ✓ composition > drops the fixed student who cancelled or missed the occurrence

**C10** - O histórico do aluno guarda o cancelamento ou a falta com data, hora, ocorrência, antecedência e responsável (CRD-10, AC 10)
Proof: run int | ✓ non attendance > records the notice in the student history

**C11** - O crédito persiste aluno, origem, geração, vencimento, status e as referências de origem e de uso (CRD-11, AC 1)
Proof: run int | ✓ credits > grants a manual credit with a 30 day expiry and a transaction

**C12** - As origens e os status do crédito são os do PRD 6.2 (CRD-12, AC 2)
Proof: run int | ✓ credits > keeps the documented origins and statuses

**C13** - Crédito vencido é tratado como VENCIDO e bloqueado para uso em leitura e agendamento (CRD-13, AC 3)
Proof: run int | ✓ credits > blocks the use of an expired credit
Proof: run unit | ✓ credit status > reports an expired credit as VENCIDO

**C14** - No máximo 1 crédito por origem; a criação duplicada é recusada (CRD-14, AC 4)
Proof: run int | ✓ credits > refuses a second credit for the same origin

**C15** - Toda alteração de status grava transação com estado anterior, novo estado, motivo, responsável e data (CRD-15, AC 5)
Proof: run int | ✓ credit transactions > records the previous status, the new status, the reason and the responsible

**C16** - Alteração manual sem motivo é recusada (CRD-16, AC 6)
Proof: run int | ✓ credit transactions > refuses a manual change without a reason

**C17** - A reposição cria a reserva MAKEUP, marca o crédito RESERVADO e vincula os dois (CRD-17, AC 1)
Proof: run int | ✓ bookings > reserves the credit and links it to the booking

**C18** - Agendamento sem crédito DISPONIVEL válido é recusado, sem criar reserva (CRD-18, AC 2)
Proof: run int | ✓ bookings > requires a valid credit for a makeup booking

**C19** - A terceira reposição da semana é recusada no autoatendimento (CRD-19, AC 3)
Proof: run int | ✓ makeups > blocks the third makeup of the week for the student self service
Proof: run unit | ✓ credit week > counts only the makeups of the monday to sunday week of the occurrence

**C20** - O limite conta as reservas MAKEUP ativas da semana da ocorrência, não da semana do pedido (CRD-20, AC 4)
Proof: run int | ✓ makeups > counts only the makeups of the occurrence week

**C21** - O agendamento manual pelo admin exige crédito válido e ignora o limite semanal (CRD-21, AC 5)
Proof: run int | ✓ makeups > lets the admin book a makeup without the weekly limit

**C22** - Duas reservas concorrentes com o mesmo crédito confirmam exatamente uma (CRD-22, AC 6)
Proof: run int | ✓ makeups > confirms one of two concurrent bookings with the same credit

**C23** - A reposição é permitida em qualquer modalidade de turma (CRD-23, AC 7)
Proof: run int | ✓ makeups > allows a makeup in any class type

**C24** - A elegibilidade é informada e só as turmas com vaga são listadas (CRD-24, AC 8)
Proof: run int | ✓ makeups > reports eligibility and lists only classes with a free spot

**C25** - Cancelar a reposição com 24h ou mais devolve o crédito a DISPONIVEL com o vencimento original (CRD-25, AC 1)
Proof: run int | ✓ makeups > returns the credit to DISPONIVEL when the makeup is cancelled 24 hours ahead

**C26** - Cancelar a reposição com menos de 24h cancela definitivamente o crédito (CRD-26, AC 2)
Proof: run int | ✓ makeups > cancels the credit when the makeup is cancelled under 24 hours

**C27** - Cancelar uma reposição não gera crédito novo (CRD-27, AC 3)
Proof: run int | ✓ makeups > grants no new credit when a makeup is cancelled

**C28** - Cancelar a ocorrência pelo estúdio cancela a ocorrência e as reservas ativas dela (CRD-28, AC 1)
Proof: run int | ✓ studio cancellation > cancels the occurrence and its active bookings

**C29** - Cada aluno fixo afetado recebe 1 crédito CANCELAMENTO_ESTUDIO com vencimento +30 dias (CRD-29, AC 2)
Proof: run int | ✓ studio cancellation > grants one credit per affected fixed student

**C30** - O crédito da reposição da ocorrência cancelada volta a DISPONIVEL com o vencimento original (CRD-30, AC 3)
Proof: run int | ✓ studio cancellation > returns the makeup credit to DISPONIVEL

**C31** - Repetir o cancelamento da mesma ocorrência não gera créditos duplicados (CRD-31, AC 4)
Proof: run int | ✓ studio cancellation > grants no duplicate credit when the cancellation repeats

**C32** - Editar dia/horário gera 1 crédito CANCELAMENTO_ESTUDIO por fixo afetado em cada ocorrência antiga cancelada (CRD-32, AC 5)
Proof: run int | ✓ sessions > grants one credit per fixed student per cancelled future occurrence on a schedule edit

**C33** - O crédito do estúdio é gerado para quem já avisou falta e não duplica para quem já tem crédito daquela ocorrência (CRD-33, AC 6)
Proof: run int | ✓ studio cancellation > grants the studio credit to a student who already missed
Proof: run int | ✓ studio cancellation > grants no second credit to a student who already has one for the occurrence

**C34** - Conceder crédito manual cria 1 crédito DISPONIVEL CONCESSAO_MANUAL com vencimento +30 dias e registra a transação (CRD-34, AC 1)
Proof: run int | ✓ credits > grants a manual credit with a 30 day expiry and a transaction

**C35** - Devolver crédito volta a DISPONIVEL mantendo o vencimento original (CRD-35, AC 2)
Proof: run int | ✓ credits > returns a credit to DISPONIVEL keeping the original expiry

**C36** - Cancelar crédito marca CANCELADO e registra a transação (CRD-36, AC 3)
Proof: run int | ✓ credits > cancels a credit and keeps the history

**C37** - A consulta por aluno devolve os créditos com geração, vencimento, status, origem e transações (CRD-37, AC 4)
Proof: run int | ✓ credits > lists the credits of a student with their transactions

**C38** - A consulta devolve os créditos DISPONIVEL que vencem nos próximos 7 dias (CRD-38, AC 5)
Proof: run int | ✓ credits > lists the available credits expiring in the next 7 days

**C39** - A tela de créditos do aluno lista os créditos com geração, vencimento, status, origem e as transações de cada crédito (CRD-39, AC 1)
Proof: walk - a tela de creditos do aluno lista os creditos do aluno com geracao, vencimento, status, origem e as transacoes de cada credito

**C40** - Conceder, devolver ou cancelar crédito pela tela exige o motivo, aplica a alteração e mostra o novo status e a transação (CRD-40, AC 2)
Proof: run int | ✓ credit actions > grants a credit from the admin action and returns the new status
Proof: run int | ✓ credit actions > returns a credit from the admin action and returns the new status
Proof: run int | ✓ credit actions > cancels a credit from the admin action and returns the new status

**C41** - Registrar o aviso de não comparecimento pela grade mostra o resultado: crédito gerado ou falta sem crédito (CRD-41, AC 3)
Proof: run int | ✓ credit actions > registers the non attendance from the admin action and returns the outcome

**C42** - Cancelar a aula pela grade mostra as reservas canceladas e a quantidade de créditos gerados (CRD-42, AC 4)
Proof: run int | ✓ credit actions > cancels the class from the admin action and returns the counts

**C43** - Agendar reposição manual pela grade exige a escolha de um crédito DISPONIVEL válido (CRD-43, AC 5)
Proof: run int | ✓ credit actions > refuses a manual makeup without a credit

**C44** - Passado o horário de término da ocorrência, o crédito da reserva vira UTILIZADO sem etapa manual (CRD-44, AC 7)
Proof: run unit | ✓ credit status > reports a reserved credit whose class ended as UTILIZADO

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-09 - user aprovou o spec ("Aprovar o spec") e as tasks ("Aprovar as tasks"); 2026-11-09 - user escolheu executar com sub-agents ("Usar 3 sub-agents (Recomendado)")
**Dispatched:** Batch 1 (Fases 1-2: T1-T6 - schema, migration e dominio puro) at HEAD 6e5f77f - sent 2026-11-09; returned: -
**Walked:** [each story's Independent Test as you did it - what the screen showed, and how the user reaches each state: sign-in, data, path]

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

T1 → T3
T2 → T3
T3 → T7
T4 → T7
T3 → T8
T5 → T8
T7 → T8
T3 → T9
T4 → T9
T8 → T9
T8 → T10
T9 → T11
T6 → T12
T8 → T12
T10 → T12
T9 → T13
T12 → T13
T13 → T14
T8 → T15
T9 → T15
T12 → T15
T13 → T15
T15 → T16
T16 → T17
T15 → T18
```

Execution is strictly sequential - um worker trabalha uma task por vez, em ordem.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 arquivo de schema (2 tabelas coesas) | OK |
| T2 | 1 arquivo de schema | OK |
| T3 | 1 migration + 1 teste de integração | OK |
| T4 | 1 arquivo de domínio | OK |
| T5 | 1 arquivo de domínio | OK |
| T6 | 1 arquivo de domínio | OK |
| T7 | 1 arquivo de serviço | OK |
| T8 | 1 arquivo de serviço | OK |
| T9 | 1 arquivo de serviço | OK |
| T10 | 1 arquivo de serviço existente | OK |
| T11 | 1 arquivo de serviço existente | OK |
| T12 | 1 arquivo de serviço | OK |
| T13 | 1 arquivo de serviço existente | OK |
| T14 | 1 arquivo de serviço existente | OK |
| T15 | 1 arquivo de actions | OK |
| T16 | 1 arquivo de forms | OK |
| T17 | 1 página | OK |
| T18 | 1 página | OK |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram shows | Status |
| --- | --- | --- | --- |
| T1 | None | inicio | OK |
| T2 | None | inicio | OK |
| T3 | T1, T2 | T1→T3, T2→T3 | OK |
| T4 | None | inicio | OK |
| T5 | None | inicio | OK |
| T6 | None | inicio | OK |
| T7 | T3, T4 | T3→T7, T4→T7 | OK |
| T8 | T3, T5, T7 | T3→T8, T5→T8, T7→T8 | OK |
| T9 | T3, T4, T8 | T3→T9, T4→T9, T8→T9 | OK |
| T10 | T8 | T8→T10 | OK |
| T11 | T9 | T9→T11 | OK |
| T12 | T6, T8, T10 | T6→T12, T8→T12, T10→T12 | OK |
| T13 | T9, T12 | T9→T13, T12→T13 | OK |
| T14 | T13 | T13→T14 | OK |
| T15 | T8, T9, T12, T13 | T8→T15, T9→T15, T12→T15, T13→T15 | OK |
| T16 | T15 | T15→T16 | OK |
| T17 | T16 | T16→T17 | OK |
| T18 | T15 | T15→T18 | OK |

Nenhuma dependencia aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1, T2 | schema | none (build gate) | none | OK |
| T3 | migrations / schema | integration | integration | OK |
| T4, T5, T6 | domínio de créditos | unit | unit | OK |
| T7, T8, T9 | serviços de créditos | integration | integration | OK |
| T10, T11 | integração com reservas/composição | integration | integration | OK |
| T12, T13, T14 | serviços de créditos / reservas | integration | integration | OK |
| T15 | server actions | integration | integration | OK |
| T16, T17, T18 | UI admin mínima (render) | none (walk + build) | none | OK |
