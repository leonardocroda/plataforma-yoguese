# Core Experimentais Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/core-experimentais/design.md`
**Status**: Approved
**Approved**: 2026-11-12 - user: "Aprovo - executar em lotes"
**Build**: `npm run build; npm run lint`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convenção registrada: `*.test.ts` unit e `*.int.test.ts` integration com Testcontainers); sem `AGENTS.md` - strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema/migração | integration | Enums, FK, índice único parcial e colunas novas | `src/db/__tests__/*.int.test.ts` | `npx vitest run src/db/__tests__/experimentals-schema.int.test.ts --reporter=verbose` |
| Domínio puro (telefone, validadores, regras, fuso) | unit | Todos os branches; 1:1 com os ACs; bordas 24h/23h59 | `src/modules/experimentals/domain/__tests__/*.test.ts` | `npx vitest run src/modules/experimentals/domain --reporter=verbose` |
| Services de experimental | integration | Todos os ACs de serviço + bordas; regra com 2 branches provada nos dois (L-015) | `src/modules/experimentals/services/__tests__/*.int.test.ts` | `npx vitest run src/modules/experimentals/services/__tests__/<grupo>.int.test.ts --reporter=verbose` |
| Actions (pública e admin) | integration | Caminho público sem sessão + guard em toda action admin | `src/modules/experimentais/__tests__/*.int.test.ts` | `npx vitest run src/modules/experimentals/__tests__/actions.int.test.ts --reporter=verbose` |
| Composição e hooks de cancelamento | integration | Aprovada conta/não conta; feriado, estúdio e edição de turma | `src/modules/{bookings,credits,classes}/**/__tests__/*.int.test.ts` | `npx vitest run src/modules/bookings/services/__tests__/composition-experimentals.int.test.ts src/modules/credits/services/__tests__/studio-cancellation-experimentals.int.test.ts src/modules/classes/services/__tests__/blocks-experimentals.int.test.ts --reporter=verbose` |
| Pages/screens | none (build gate + walk) | Cada critério de tela tem prova de walk | `src/app/**` | `npm run build; npm run lint` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit | `npx vitest run src/modules/experimentals/domain` |
| Full | Após tasks com integration (o comum) | `npm test` |
| Build | Tasks de tela e fim de fase | `npm run build; npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Dados e domínio

```
T1 → T3
T2 → T3
T1 → T4
T1 → T5
```

Execução em ordem: T1, T2, T3, T4, T5.

### Phase 2: Solicitação pública

```
T1 → T6
T2 → T6
T3 → T6
T5 → T6
T1 → T7
T5 → T7
T6 → T8
T7 → T9
T8 → T9
T9 → T10
```

Execução em ordem: T6, T7, T8, T9, T10.

### Phase 3: Operação administrativa

```
T5 → T11
T6 → T11
T11 → T12
T4 → T13
T11 → T13
T6 → T14
T11 → T15
T12 → T15
T13 → T15
T14 → T15
T14 → T16
T16 → T17
T15 → T18
T14 → T18
T7 → T18
```

Execução em ordem: T11, T12, T13, T14, T15, T16, T17, T18.

### Phase 4: Ocupação e conversão

```
T1 → T19
T19 → T20
T19 → T21
T1 → T22
T5 → T22
T22 → T23
T1 → T24
T3 → T24
T5 → T24
T11 → T24
T24 → T25
T25 → T26
T18 → T26
```

Execução em ordem: T19, T20, T21, T22, T23, T24, T25, T26.

---

## Task Breakdown

### T1: Schema, migração e fixtures

**What**: Criar `experimentals` e `experimental_reschedules` (enums, FK auto-referência, índice único parcial por telefone), adicionar `health_declaration`/`health_declaration_accepted_at` em `students`, exportar no índice, gerar a migração e atualizar `clearTables`.
**Where**: `src/db/schema/experimentals.ts`
**Depends on**: None
**Reuses**: `src/db/schema/sessions.ts` (enums, timestamps, índice parcial), `src/test/fixtures.ts`
**Requirement**: EXP-06, EXP-14, EXP-16, EXP-48, EXP-50

**Done when**:

- [x] Migração aplica do zero no Testcontainers e a suíte existente sobe
- [x] `experimentals` tem status `PENDENTE` default, pagamento `PENDENTE` default, `phone_normalized` e `duplicate_of_id`
- [x] Índice `experimentals_telefone_unico` aceita uma canônica e várias `DUPLICADA` do mesmo telefone
- [x] `students` aceita as colunas de declaração
- [x] Fixtures truncam as tabelas novas entre suites
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(db): experimentals and reschedule history schema`

---

### T2: Normalização de telefone

**What**: `normalizePhone` (só dígitos, remove `55`) e `isValidPhone` (10 ou 11 dígitos).
**Where**: `src/modules/experimentals/domain/phone.ts`
**Depends on**: None
**Reuses**: `src/modules/credits/domain/credit-week.ts` (estilo puro)
**Requirement**: EXP-07, EXP-08, EXP-10

**Done when**:

- [x] Máscaras diferentes do mesmo número normalizam igual
- [x] `+55` é removido; 10 e 11 dígitos válidos; outros tamanhos inválidos
- [x] Gate: `npx vitest run src/modules/experimentals/domain`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(experimentals): normalize phone identity`

---

### T3: Validadores, constantes e termos

**What**: `HEALTH_DECLARATION`, `EXPERIMENTAL_PRICE_CENTS`, `validateExperimentalRequest`, `validateConversion`, `EXPERIMENTAL_STATUS_LABELS` e `PAYMENT_STATUS_LABELS`.
**Where**: `src/modules/experimentals/domain/validators.ts`
**Depends on**: T1, T2
**Reuses**: `src/modules/students/domain/validators.ts`
**Requirement**: EXP-02, EXP-03, EXP-06, EXP-07, EXP-27, EXP-32, EXP-33, EXP-51, EXP-52

**Done when**:

- [x] Declaração e preço são constantes exatas do PRD
- [x] Solicitação recusa nome vazio, telefone inválido e declaração não marcada
- [x] Conversão exige e-mail, nascimento, plano e ao menos um horário
- [x] Rótulos de status e pagamento são os termos do PRD
- [x] Gate: `npx vitest run src/modules/experimentals/domain`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(experimentals): request and conversion validators`

---

### T4: Regras de status, 24h e fuso do estúdio

**What**: `isTerminalStatus`, `canCancel`, `canReschedule`, `canConvert`, `cancellationKeepsRight` e `studioDateTimeToInstant`.
**Where**: `src/modules/experimentals/domain/rules.ts`
**Depends on**: T1
**Reuses**: `src/modules/classes/domain/occurrences.ts` (`STUDIO_TIMEZONE`)
**Requirement**: EXP-34, EXP-35, EXP-36, EXP-38, EXP-56

**Done when**:

- [x] 24h exatas mantêm o direito; 23h59 perdem
- [x] Status terminal recusa cancelar e reagendar
- [x] Conversão só a partir de `APROVADA` com ocorrência terminada
- [x] `studioDateTimeToInstant` respeita America/Sao_Paulo
- [x] Gate: `npx vitest run src/modules/experimentals/domain src/modules/classes/domain/__tests__/occurrences.test.ts`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(experimentals): status, 24h and studio time rules`

---

### T5: Composição conta a experimental aprovada

**What**: `getOccurrenceComposition` soma as `experimentals` com status `APROVADA` ao `experimentalCount`, sem contar os demais status.
**Where**: `src/modules/bookings/services/composition.ts`
**Depends on**: T1
**Reuses**: `src/modules/bookings/domain/composition.ts` (fórmula pura)
**Requirement**: EXP-41, EXP-42

**Done when**:

- [x] Aprovada ocupa vaga; pendente, recusada, cancelada, falta, convertida e duplicada não ocupam
- [x] Reservation `EXPERIMENTAL` existente continua contando (sem regressão)
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(bookings): approved experimentals occupy the occurrence`

---

### T6: Serviço de solicitação pública

**What**: `createExperimentalRequest` valida, materializa a ocorrência, confere vaga, bloqueia duplicidade canônica, grava `PENDENTE` e registra a tentativa `DUPLICADA` na corrida.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T1, T2, T3, T5
**Reuses**: `materializeSession`, `getOccurrenceComposition`
**Requirement**: EXP-06, EXP-07, EXP-08, EXP-09, EXP-10, EXP-11, EXP-14, EXP-15, EXP-16

**Done when**:

- [x] Solicitação válida nasce `PENDENTE` e não ocupa vaga
- [x] Telefone anterior não recusado bloqueia, mesmo com máscara diferente, e grava `DUPLICADA` ligada
- [x] Ocorrência passada, bloqueada, cancelada ou sem vaga é recusada no servidor
- [x] Duas submissões concorrentes do mesmo telefone geram uma solicitação e uma duplicada
- [x] Declaração e `requested_at` ficam gravados
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): public request with duplicate guard`

---

### T7: Leitura pública de ocorrências com vaga

**What**: `listExperimentalOccurrences` lista ocorrências futuras de turmas/modalidades ativas, `AGENDADA`, com vaga, sem dado pessoal, e devolve lista vazia quando não há opção.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T1, T5
**Reuses**: `listActiveSlots`, `occurrenceDates`, `getComposition`
**Requirement**: EXP-04, EXP-05, EXP-13, EXP-15, EXP-44

**Done when**:

- [x] Só aparece ocorrência futura, ativa e com vaga
- [x] Bloqueada/cancelada/inativa não aparece
- [x] A aprovada reduz a vaga ofertada
- [x] A opção pública não carrega nome nem telefone
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): public occurrence availability`

---

### T8: Action pública da solicitação

**What**: `requestExperimentalAction` sem sessão, fina, chamando o serviço e devolvendo `ok/value` ou `error/field`.
**Where**: `src/modules/experimentals/actions.ts`
**Depends on**: T6
**Reuses**: `src/modules/classes/actions.ts` (padrão de action)
**Requirement**: EXP-06, EXP-29

**Done when**:

- [x] Action pública funciona sem cookie de sessão
- [x] Erros de campo chegam à tela com a mensagem do serviço
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): public request action`

---

### T9: Tela pública do formulário

**What**: Página `/experimental` com modalidade, opções de data/horário/vagas, preço, declaração exata, estados vazio/erro/sucesso e formulário cliente.
**Where**: `src/app/(site)/experimental/`
**Depends on**: T7, T8
**Reuses**: `src/app/(admin)/alunos/student-forms.tsx` (useActionState), CSS do projeto
**Requirement**: EXP-02, EXP-03, EXP-04, EXP-05, EXP-12, EXP-13

**Done when**:

- [x] Campos, R$ 45,00 e declaração exata aparecem antes do envio
- [x] Só ocorrências com vaga; filtro por modalidade
- [x] Sem vaga mostra estado vazio e não envia
- [x] Envio válido mostra confirmação de aprovação e contato via WhatsApp
- [x] Nenhum dado de outra pessoa aparece
- [x] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(site): experimental request form`

---

### T10: Botão na home do site

**What**: Controle "Agendar aula experimental" na home atual levando a `/experimental`.
**Where**: `src/app/(site)/page.tsx`
**Depends on**: T9
**Reuses**: `next/link`
**Requirement**: EXP-01

**Done when**:

- [x] O controle aparece e alcança o formulário
- [x] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(site): link to the experimental form`

---

### T11: Aprovação e recusa

**What**: `approveExperimental` (transação com `SELECT ... FOR UPDATE`, recomposição e `APROVADA`) e `refuseExperimental` (`RECUSADA`).
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T5, T6
**Reuses**: padrão transacional de `createBooking`
**Requirement**: EXP-20, EXP-21, EXP-22, EXP-23

**Done when**:

- [x] Aprovação com vaga ocupa; sem vaga/bloqueada/cancelada recusa e mantém `PENDENTE`
- [x] Duas aprovações concorrentes na última vaga confirmam uma
- [x] Recusa mantém o registro consultável e libera o telefone
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): approve and refuse requests`

---

### T12: Troca de data/horário e reagendamento

**What**: `changeExperimentalOccurrence` (pendente/aprovada, troca atômica) e `rescheduleExperimental` (cancelada com direito → aprovada), gravando `experimental_reschedules`.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T11
**Reuses**: `getOccurrenceComposition`, tabela `experimental_reschedules`
**Requirement**: EXP-24, EXP-39, EXP-40, EXP-47

**Done when**:

- [x] Troca de pendente mantém pendente; de aprovada troca a vaga atomicamente; sem vaga recusa mantendo a anterior
- [x] Reagendamento com vaga grava a ocorrência anterior e vira `APROVADA`
- [x] Reagendamento sem vaga mantém o direito
- [x] O direito só se exerce no mesmo registro; nova solicitação do telefone é recusada
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): change occurrence and reschedule`

---

### T13: Cancelamento, falta, pagamento e contato

**What**: `cancelExperimental` (24h), `registerNoShow`, `registerPayment` e `registerWhatsAppContact`.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T4, T11
**Reuses**: `studioDateTimeToInstant`, `cancellationKeepsRight`
**Requirement**: EXP-25, EXP-26, EXP-34, EXP-35, EXP-36, EXP-37, EXP-38

**Done when**:

- [x] 24h exatas → `CANCELADA_COM_DIREITO`; 23h59 → `CANCELADA_SEM_DIREITO`
- [x] Cancelamento depois do início recusado; falta só depois do início
- [x] Status terminal recusa cancelamento
- [x] Pagamento nos quatro status e contato com timestamp
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): cancellation, no-show and payment`

---

### T14: Leitura administrativa e busca por telefone

**What**: `listExperimentals` (com filtro por telefone normalizado), `getExperimental` (detalhe com ocorrência e aluna convertida) e leitura de tentativas duplicadas.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T6
**Reuses**: joins de `listStudentBookings`
**Requirement**: EXP-17, EXP-18, EXP-19, EXP-49, EXP-60

**Done when**:

- [x] Lista traz nome, telefone, ocorrência, status, pagamento e data
- [x] Busca por telefone devolve todas as tentativas, inclusive duplicada/recusada/cancelada/convertida
- [x] Detalhe traz declaração, timestamps e aluna convertida
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): admin reads and phone search`

---

### T15: Actions administrativas

**What**: Actions de aprovar, recusar, trocar ocorrência, reagendar, cancelar, falta, pagamento e contato, todas com `requireAdminSession`.
**Where**: `src/modules/experimentals/actions.ts`
**Depends on**: T11, T12, T13, T14
**Reuses**: `src/modules/classes/actions.ts`
**Requirement**: EXP-28, EXP-29

**Done when**:

- [x] Cada action admin exige sessão `ADMIN` no servidor
- [x] Erros do serviço chegam à tela
- [x] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): admin actions with guard`

---

### T16: Tela de listagem administrativa

**What**: Página `/experimentais` com busca por telefone, status/pagamento, dados da ocorrência, estado vazio e link para o detalhe.
**Where**: `src/app/(admin)/experimentais/page.tsx`
**Depends on**: T14
**Reuses**: `src/app/(admin)/feriados/page.tsx` (layout de lista)
**Requirement**: EXP-17, EXP-18, EXP-30

**Done when**:

- [x] Lista mostra nome, telefone, data/horário, modalidade, status, pagamento e data da solicitação
- [x] Busca por telefone filtra pelo normalizado
- [x] Sem solicitações mostra estado vazio
- [x] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(admin): experimentals list`

---

### T17: Link de navegação do admin

**What**: Adicionar "Experimentais" à navegação do shell `(admin)`.
**Where**: `src/app/(admin)/layout.tsx`
**Depends on**: T16
**Reuses**: `NAV_LINKS` existente
**Requirement**: EXP-17

**Done when**:

- [ ] A tela fica alcançável pelo shell
- [ ] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(admin): experimentals navigation link`

---

### T18: Tela de detalhe e ações do admin

**What**: Página `/experimentais/[id]` com dados completos e formulários de aprovar, recusar, trocar data/horário, reagendar, pagamento, WhatsApp, cancelar, falta e confirmações.
**Where**: `src/app/(admin)/experimentais/[id]/`
**Depends on**: T15, T14, T7
**Reuses**: `src/app/(admin)/creditos/credit-forms.tsx` (formulários de ação)
**Requirement**: EXP-19, EXP-24, EXP-29, EXP-31, EXP-32, EXP-33, EXP-49

**Done when**:

- [ ] Detalhe mostra todos os dados e timestamps
- [ ] Cada ação mostra sucesso/erro sem perder a tela
- [ ] Recusar, cancelar sem direito, falta e converter pedem confirmação
- [ ] Status e pagamento usam os termos exatos
- [ ] Duplicada aparece somente leitura
- [ ] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(admin): experimental detail and actions`

---

### T19: Helper de cancelamento por ocorrência

**What**: `cancelExperimentalsForOccurrence(tx, sessionId, now)` transforma `PENDENTE`/`APROVADA` em `CANCELADA_COM_DIREITO`, grava `cancelled_at` e devolve quantas cancelou.
**Where**: `src/modules/experimentals/services/cancellations.ts`
**Depends on**: T1
**Reuses**: apenas schema `experimentals`
**Requirement**: EXP-45

**Done when**:

- [ ] Só pendente/aprovada mudam; status terminal fica intacto
- [ ] A vaga é liberada pela mudança de status
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): cancel experimentals by occurrence`

---

### T20: Hook no cancelamento pelo estúdio

**What**: `cancelOccurrenceByStudio` chama o helper depois de cancelar as reservas.
**Where**: `src/modules/credits/services/cancellations.ts`
**Depends on**: T19
**Reuses**: helper de T19
**Requirement**: EXP-45

**Done when**:

- [ ] Cancelamento pelo estúdio cancela a experimental com direito
- [ ] O comportamento existente de reservas/créditos não muda
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(credits): cancel experimentals with the studio cancellation`

---

### T21: Hook no bloqueio por feriado/recesso

**What**: `applyBlockTransition` chama o helper ao bloquear a ocorrência; desbloquear não restaura.
**Where**: `src/modules/bookings/services/blocks.ts`
**Depends on**: T19
**Reuses**: helper de T19
**Requirement**: EXP-45, EXP-46

**Done when**:

- [ ] Feriado/recesso cancela pendente e aprovada com direito
- [ ] Remover o bloqueio não restaura a experimental
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(bookings): block cancels experimentals with right kept`

---

### T22: Leitura das aprovadas por sessão

**What**: `listApprovedExperimentalsBySession(db, sessionIds)` para a grade.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T1, T5
**Reuses**: schema `experimentals`
**Requirement**: EXP-43

**Done when**:

- [ ] Devolve só `APROVADA`, com nome e sessão
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): list approved experimentals by session`

---

### T23: Grade lista a experimental aprovada

**What**: A grade do admin inclui as experimentais aprovadas na lista de participantes com o vínculo "experimental".
**Where**: `src/app/(admin)/grade/page.tsx`
**Depends on**: T22
**Reuses**: `occurrenceParticipants`
**Requirement**: EXP-43

**Done when**:

- [ ] A aprovada aparece na ocorrência com nome e vínculo experimental
- [ ] A contagem da grade continua vindo da composição
- [ ] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(admin): show experimentals on the grade`

---

### T24: Serviço de conversão

**What**: `convertExperimental` transacional: valida status/fim da aula, plano, e-mail, horários e vaga; cria aluna e matrículas; atualiza a experimental.
**Where**: `src/modules/experimentals/services/experimentals.ts`
**Depends on**: T1, T3, T5, T11
**Reuses**: `validateStudent`, `normalizeEmail`, `emailTaken`, `planExists`, `nextOccurrence`, `getOccurrenceComposition`
**Requirement**: EXP-50, EXP-51, EXP-52, EXP-53, EXP-54, EXP-55, EXP-56, EXP-57, EXP-58, EXP-59, EXP-60, EXP-61

**Done when**:

- [ ] Cria aluna `ATIVO`, copia declaração e grava as matrículas fixas
- [ ] E-mail duplicado/inválido, plano inexistente/inativo e horário lotado recusam sem criar nada
- [ ] Antes do fim da aula ou status não aprovado recusa
- [ ] Segunda conversão recusa; `attended_at` e `converted_student_id` gravam
- [ ] Aluna não recebe `user_id`
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): convert experimental into an active student`

---

### T25: Action de conversão

**What**: `convertExperimentalAction` com `requireAdminSession`, fina sobre o serviço.
**Where**: `src/modules/experimentals/actions.ts`
**Depends on**: T24
**Reuses**: `src/modules/experimentals/actions.ts` (padrão de T15)
**Requirement**: EXP-28, EXP-29

**Done when**:

- [ ] Action exige sessão `ADMIN`
- [ ] Erros de campo chegam à tela
- [ ] Gate: `npm test`

**Tests**: integration
**Gate**: full
**Commit**: `feat(experimentals): conversion action`

---

### T26: Formulário de conversão

**What**: Formulário na tela de detalhe com e-mail, nascimento, plano e horário(s) fixo(s), confirmação e feedback.
**Where**: `src/app/(admin)/experimentais/[id]/`
**Depends on**: T25, T18
**Reuses**: `src/app/(admin)/alunos/student-forms.tsx`
**Requirement**: EXP-31, EXP-50, EXP-57, EXP-60

**Done when**:

- [ ] O formulário oferece planos ativos e horários ativos
- [ ] Conversão pede confirmação e mostra sucesso/erro
- [ ] A aluna convertida fica linkada no detalhe
- [ ] Gate: `npm run build; npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(admin): convert experimental form`

---

## Checks

**Run exp-unit**: `npx vitest run src/modules/experimentals/domain src/modules/classes/domain/__tests__/occurrences.test.ts --reporter=verbose`
**Run exp-schema**: `npx vitest run src/db/__tests__/experimentals-schema.int.test.ts --reporter=verbose`
**Run exp-composition**: `npx vitest run src/modules/bookings/services/__tests__/composition-experimentals.int.test.ts --reporter=verbose`
**Run exp-requests**: `npx vitest run src/modules/experimentals/services/__tests__/requests.int.test.ts --reporter=verbose`
**Run exp-occurrences**: `npx vitest run src/modules/experimentals/services/__tests__/occurrences.int.test.ts --reporter=verbose`
**Run exp-approval**: `npx vitest run src/modules/experimentals/services/__tests__/approval.int.test.ts --reporter=verbose`
**Run exp-reschedule**: `npx vitest run src/modules/experimentals/services/__tests__/reschedule.int.test.ts --reporter=verbose`
**Run exp-cancellation**: `npx vitest run src/modules/experimentals/services/__tests__/cancellation.int.test.ts --reporter=verbose`
**Run exp-reads**: `npx vitest run src/modules/experimentals/services/__tests__/reads.int.test.ts --reporter=verbose`
**Run exp-hooks**: `npx vitest run src/modules/credits/services/__tests__/studio-cancellation-experimentals.int.test.ts src/modules/classes/services/__tests__/blocks-experimentals.int.test.ts --reporter=verbose`
**Run exp-conversion**: `npx vitest run src/modules/experimentals/services/__tests__/conversion.int.test.ts --reporter=verbose`
**Run exp-actions**: `npx vitest run src/modules/experimentals/__tests__/actions.int.test.ts --reporter=verbose`
**Build**: `npm run build; npm run lint`

**C1** - A home do site leva ao formulário de experimental (EXP-01, AC 1)
Proof: walk - home do site leva ao formulário de experimental

**C2** - O formulário mostra nome, telefone, modalidade, dia/horário, declaração e R$ 45,00 antes do envio (EXP-02, AC 2)
Proof: walk - formulário mostra campos, R$ 45,00 e a declaração exata

**C3** - A declaração aparece com o texto exato do PRD e é obrigatória (EXP-03, AC 3)
Proof: walk - declaração exata do PRD visível e obrigatória

**C4** - Só ocorrências futuras, ativas e com vaga aparecem, com modalidade e vagas (EXP-04, AC 4)
Proof: walk - formulário filtra por modalidade e mostra data, horário e vagas

**C5** - Sem ocorrência com vaga, o formulário mostra estado vazio e não envia (EXP-05, AC 5)
Proof: walk - formulário sem vaga mostra estado vazio e não envia

**C6** - Envio válido cria solicitação `PENDENTE` com pagamento `PENDENTE` (EXP-06, AC 6)
Proof: run exp-requests | ✓ creates a pending request without occupying

**C7** - Nome, telefone, declaração ou ocorrência inválidos são recusados com erro do campo (EXP-07, AC 7)
Proof: run exp-unit | ✓ recusa nome vazio, telefone invalido e declaracao nao aceita

**C8** - Telefone com experimental anterior não recusada é bloqueado (EXP-08, AC 8)
Proof: run exp-requests | ✓ bloqueia telefone com experimental anterior mesmo com mascara diferente

**C9** - A tentativa bloqueada é gravada como `DUPLICADA` ligada à existente (EXP-09, AC 9)
Proof: run exp-requests | ✓ registra a tentativa bloqueada como duplicada

**C10** - O telefone é normalizado (dígitos, sem `55`) antes de comparar e gravar (EXP-10, AC 10)
Proof: run exp-unit | ✓ mascara e codigo do pais nao mudam a identidade do telefone

**C11** - Solicitação `PENDENTE` não ocupa vaga (EXP-11, AC 11)
Proof: run exp-requests | ✓ creates a pending request without occupying

**C12** - O envio mostra confirmação de aprovação pendente e contato via WhatsApp (EXP-12, AC 12)
Proof: walk - envio válido mostra confirmação de aprovação e WhatsApp

**C13** - A página pública não exibe dado de outra pessoa (EXP-13, AC 13)
Proof: run exp-occurrences | ✓ opcao publica nao carrega nome nem telefone de ninguem

**C14** - Duas submissões concorrentes do mesmo telefone geram uma solicitação e uma duplicada (EXP-14, AC 14)
Proof: run exp-requests | ✓ duas submissoes concorrentes geram uma solicitacao e uma duplicada

**C15** - Ocorrência bloqueada, cancelada, passada, sem vaga ou inativa é recusada no envio (EXP-15, AC 15)
Proof: run exp-requests | ✓ nao cria solicitacao sem vaga ou em ocorrencia bloqueada

**C16** - A declaração exibida e o `requested_at` ficam gravados (EXP-16, AC 16)
Proof: run exp-schema | ✓ experimental guarda a declaracao e o instante da solicitacao

**C17** - `/experimentais` lista as solicitações com os dados e status (EXP-17, AC 17)
Proof: walk - /experimentais lista as solicitações com status e pagamento

**C18** - A busca por telefone devolve todas as tentativas (EXP-18, AC 18)
Proof: run exp-reads | ✓ busca por telefone devolve todas as tentativas

**C19** - O detalhe mostra os dados completos e a aluna convertida (EXP-19, AC 19)
Proof: run exp-reads | ✓ detalhe mostra os dados e a aluna convertida

**C20** - Aprovação com vaga grava `APROVADA` e ocupa a vaga (EXP-20, AC 20)
Proof: run exp-approval | ✓ aprova com vaga e ocupa a ocorrencia

**C21** - Aprovação sem vaga/bloqueada/cancelada recusa e mantém `PENDENTE` (EXP-21, AC 21)
Proof: run exp-approval | ✓ recusa aprovacao sem vaga, bloqueada ou cancelada e mantem pendente

**C22** - Duas aprovações na última vaga confirmam uma (EXP-22, AC 22)
Proof: run exp-approval | ✓ duas aprovacoes concorrentes na ultima vaga confirmam uma

**C23** - Recusar grava `RECUSADA`, mantém o registro e libera o telefone (EXP-23, AC 23)
Proof: run exp-requests | ✓ recusada libera o telefone para nova solicitacao

**C24** - Alterar data/horário revalida e troca a vaga atomicamente (EXP-24, AC 24)
Proof: run exp-approval | ✓ troca de data de pendente mantem pendente e de aprovada troca a vaga

**C25** - O pagamento grava exatamente `PENDENTE`, `PAGO`, `ISENTO` ou `REEMBOLSADO` (EXP-25, AC 25)
Proof: run exp-approval | ✓ registra pagamento nos quatro status

**C26** - O contato via WhatsApp grava e exibe o instante (EXP-26, AC 26)
Proof: run exp-approval | ✓ registra contato via WhatsApp

**C27** - R$ 45,00 aparece no formulário e no detalhe administrativo (EXP-27, AC 27)
Proof: run exp-unit | ✓ declaracao e preco sao os textos fixos do PRD

**C28** - Toda action administrativa exige sessão `ADMIN` no servidor (EXP-28, AC 28)
Proof: run exp-actions | ✓ toda action admin exige sessao de ADMIN

**C29** - Cada action mostra sucesso ou erro sem perder a lista (EXP-29, AC 29)
Proof: walk - action mostra sucesso ou erro sem perder a lista

**C30** - `/experimentais` sem solicitações mostra estado vazio (EXP-30, AC 30)
Proof: walk - /experimentais sem solicitações mostra estado vazio

**C31** - Recusar, cancelar sem direito, falta e converter pedem confirmação (EXP-31, AC 31)
Proof: walk - recusar, cancelar sem direito, falta e converter pedem confirmação

**C32** - Os status aparecem com os termos exatos do PRD (EXP-32, AC 32)
Proof: run exp-unit | ✓ termos de status e pagamento sao os do PRD

**C33** - O pagamento aparece com os termos exatos do PRD (EXP-33, AC 33)
Proof: run exp-unit | ✓ termos de status e pagamento sao os do PRD

**C34** - Cancelamento com 24h exatas vira `CANCELADA_COM_DIREITO` e libera a vaga (EXP-34, AC 34)
Proof: run exp-cancellation | ✓ cancelamento com 24h exatas vira cancelada com direito

**C35** - Cancelamento com 23h59 vira `CANCELADA_SEM_DIREITO` e encerra o direito (EXP-35, AC 35)
Proof: run exp-cancellation | ✓ cancelamento com 23h59 vira cancelada sem direito

**C36** - Falta depois do início grava `FALTA`, libera a vaga e encerra o direito (EXP-36, AC 36)
Proof: run exp-cancellation | ✓ falta depois do inicio encerra o direito e libera a vaga

**C37** - Cancelamento depois do início é recusado e aponta a falta (EXP-37, AC 37)
Proof: run exp-cancellation | ✓ cancelamento depois do inicio e recusado

**C38** - Status terminal recusa cancelar e reagendar (EXP-38, AC 38)
Proof: run exp-unit | ✓ status terminal recusa cancelar e reagendar

**C39** - Reagendar `CANCELADA_COM_DIREITO` com vaga grava a ocorrência anterior e vira `APROVADA` (EXP-39, AC 39)
Proof: run exp-reschedule | ✓ reagenda cancelada com direito com vaga e grava a ocorrencia anterior

**C40** - Reagendamento sem vaga recusa e mantém status e direito (EXP-40, AC 40)
Proof: run exp-reschedule | ✓ reagendamento sem vaga recusa e mantem o direito

**C41** - A composição conta as experimentais `APROVADA` (EXP-41, AC 41)
Proof: run exp-composition | ✓ aprovada ocupa a vaga e pendente nao ocupa

**C42** - Os demais status não contam na ocupação (EXP-42, AC 42)
Proof: run exp-composition | ✓ cancelada com direito, falta e convertida liberam a vaga

**C43** - A grade lista a aprovada como participante experimental (EXP-43, AC 43)
Proof: run exp-reads | ✓ grade lista a aprovada como participante experimental

**C44** - A agenda pública desconta a experimental aprovada (EXP-44, AC 44)
Proof: run exp-occurrences | ✓ a aprovada reduz a vaga ofertada

**C45** - Feriado, cancelamento do estúdio e edição de turma cancelam pendente/aprovada com direito (EXP-45, AC 45)
Proof: run exp-hooks | ✓ bloqueio, cancelamento e edicao de turma cancelam a experimental com direito

**C46** - Remover o bloqueio não restaura a experimental cancelada (EXP-46, AC 46)
Proof: run exp-hooks | ✓ desbloquear nao restaura a experimental cancelada

**C47** - O direito ao reagendamento só se exerce no mesmo registro (EXP-47, AC 47)
Proof: run exp-reschedule | ✓ o direito so se exerce no mesmo registro

**C48** - Uma solicitação `RECUSADA` não bloqueia nova solicitação (EXP-48, AC 48)
Proof: run exp-requests | ✓ recusada libera o telefone para nova solicitacao

**C49** - A tentativa `DUPLICADA` é somente leitura (EXP-49, AC 49)
Proof: walk - tentativa duplicada aparece como Tentativa duplicada e sem ações

**C50** - A conversão cria aluna `ATIVO` com plano, horários fixos e declaração copiada (EXP-50, AC 50)
Proof: run exp-conversion | ✓ cria aluna ativa com plano, horarios fixos e declaracao copiada

**C51** - A conversão exige e-mail, nascimento, plano ativo e ao menos um horário (EXP-51, AC 51)
Proof: run exp-unit | ✓ conversao exige email, nascimento, plano e ao menos um horario

**C52** - E-mail inválido ou duplicado (ignorando caixa) recusa sem criar nada (EXP-52, AC 52)
Proof: run exp-conversion | ✓ email duplicado ou invalido recusa e nao cria nada

**C53** - Plano inexistente ou inativo recusa com erro do campo (EXP-53, AC 53)
Proof: run exp-conversion | ✓ plano inexistente ou inativo e recusado

**C54** - Um horário fixo sem vaga recusa a conversão nomeando o horário (EXP-54, AC 54)
Proof: run exp-conversion | ✓ um horario lotado recusa a conversao inteira

**C55** - A conversão é transacional: aluna, matrículas e status juntos ou nada (EXP-55, AC 55)
Proof: run exp-conversion | ✓ um horario lotado recusa a conversao inteira

**C56** - Conversão antes do fim ou status não `APROVADA` é recusada (EXP-56, AC 56)
Proof: run exp-conversion | ✓ conversao antes do fim ou status nao aprovado e recusada

**C57** - Conversão grava `CONVERTIDA`, `converted_student_id` e `attended_at` (EXP-57, AC 57)
Proof: run exp-conversion | ✓ cria aluna ativa com plano, horarios fixos e declaracao copiada

**C58** - A aluna convertida aparece em `/alunos` e ocupa vaga (EXP-58, AC 58)
Proof: run exp-conversion | ✓ aluna convertida aparece na listagem e ocupa vaga

**C59** - Uma segunda conversão é recusada (EXP-59, AC 59)
Proof: run exp-conversion | ✓ segunda conversao e recusada

**C60** - O histórico da experimental continua consultável com a aluna (EXP-60, AC 60)
Proof: run exp-reads | ✓ detalhe mostra os dados e a aluna convertida

**C61** - A aluna convertida não recebe login nesta versão (EXP-61, AC 61)
Proof: run exp-conversion | ✓ aluna convertida nao recebe login nesta versao

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** batch 1 (Fases 1-2, T1-T10) RETORNADO - 10 tasks, 10 commits (fc64e38, b088fb3, 8847e1c, 95d7e99, a0519a8, 18353cb, 09d6f70, eab6e0a, be30a5a, bef8d35), 298 testes verdes. 1a tentativa morreu por limite de uso no meio da T1 (sem commit) e foi retomada do estado parcial em disco. batch 2 (Fase 3, T11-T18): T11 e T12 commitadas (e7628a2, fa86c60); o worker caiu no meio da T13 (servico + testes em disco, sem commit) e a continuacao foi despachada a partir de fa86c60 - running
**Walked:** none

---

## Phase Execution Map

```
Phase 1: T1, T2, T3, T4, T5
Phase 2: T6, T7, T8, T9, T10
Phase 3: T11, T12, T13, T14, T15, T16, T17, T18
Phase 4: T19, T20, T21, T22, T23, T24, T25, T26
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.
