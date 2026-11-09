# Core Créditos e Cancelamentos Specification

**Approved**: 2026-11-09 - user: "Aprovar o spec"

## Problem Statement

O Yogue-se Yoga atende alunos com horário fixo semanal. Quando um aluno
falta ou desiste, o estúdio precisa devolver a chance de treinar: ou o
aluno avisa com pelo menos 24h de antecedência e recebe um crédito para
agendar uma reposição, ou avisou tarde e não recebe nada. Hoje esse
controle é manual e não existe no sistema — a feature anterior (core
turmas e reservas) deixou a base pronta: turmas, ocorrências, composição
derivada de vagas e reserva transacional. Falta o dinheiro do módulo: a
entidade de crédito, a regra de 24h calculada no servidor, o agendamento
de reposição que consome o crédito, a devolução/cancelamento pelo admin e
o cancelamento de aula pelo estúdio (que gera crédito automático para todo
aluno fixo afetado). Esta feature entrega esse módulo e fecha a
consequência de AD-013: editar dia/horário de uma turma cancela as
ocorrências futuras antigas, e cada uma delas agora vira crédito.

## Goals

- [ ] Crédito de reposição como entidade persistida, com validade de 30 dias, origem e status auditáveis
- [ ] Regra de 24h calculada no servidor: com 24h exatas gera crédito, com 23h59 registra falta e não gera
- [ ] Agendamento de reposição que exige crédito válido, reserva o crédito e respeita o limite de 2 por semana no autoatendimento
- [ ] Cancelamento de aula pelo estúdio gera crédito automático por aluno fixo afetado, sem duplicidade
- [ ] Admin com tela mínima de créditos do aluno (conceder, devolver, cancelar, histórico)

## Out of Scope

| Feature | Reason |
| --- | --- |
| Botões da área do aluno (avisar não comparecimento, agendar reposição, meus créditos) e tela "Meus créditos" do aluno | Feature da área do aluno (AD-016); aqui ficam as regras e os serviços que eles vão consumir |
| Alteração de horário fixo pelo aluno (PRD 5.2) | Fluxo de aluno; requer auth |
| Fluxo de aprovação de experimentais (PRD módulo 8) | Feature própria |
| Autenticação, perfis e `USERS` (PRD seções 2, 12, 13) | Feature própria; o responsável pela alteração manual é registrado por rótulo até lá |
| Dashboard com indicadores de créditos (PRD 4.1) | Feature do painel admin |
| Notificações, e-mail/WhatsApp, pagamentos, relatórios, Pato Yoga Club | Fases 3/4 do PRD |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Limite de 2 reposições por semana conta a semana de qual data | Semana (seg–dom, America/Sao_Paulo) da data da ocorrência da reposição | Decisão do usuário (AD-024); a contagem usa as reservas MAKEUP ativas cuja ocorrência cai nessa semana | y |
| Quem registra o aviso de não comparecimento do aluno | O admin, em nome do aluno, na grade | A área do aluno está fora do escopo (AD-016); a regra de 24h é calculada pelo servidor no momento do registro (AD-023) | y |
| Registro pontual do cancelamento/falta de um aluno fixo | Uma linha `BOOKING` do tipo `FIXED` na ocorrência, com status `CANCELADA` ou `FALTA` | AD-008 já previa a linha `BOOKING` FIXED "só quando uma ocorrência específica precisa dela"; AD-022 evita tabela nova | y |
| O cancelamento pontual afeta o vínculo fixo do aluno | Não: o `FIXED_ENROLLMENT` continua ativo e o aluno segue contando como fixo nas ocorrências futuras | PRD 6.1 trata o cancelamento por aula ("cada aula fixa agendada"), não do vínculo semanal | y |
| Antecedência da regra de 24h | Medida do instante atual até o início da aula, no fuso America/Sao_Paulo | PRD 6.1 ("intervalo entre o horário atual e o início da aula") e PRD 3 (fuso do estúdio) | y |
| Fronteira de 24h | Exatamente 24h conta como antecedência válida e gera crédito; 23h59 não gera | PRD 6.1 ("igual ou superior a 24 horas") e PRD 15 ("Cancelamento com 24h exatas: Gera crédito") | y |
| Validade do crédito | 30 dias contados da geração, no fuso do estúdio | PRD 6.3 | y |
| Uso do crédito da reposição | Vira `UTILIZADO` quando passa o horário de término da ocorrência, sem etapa manual de presença | Decisão do usuário (AD-018): quem não avisa com 24h perde o crédito, então automático pelo horário basta | y |
| Agendamento manual de reposição pelo admin | Exige crédito válido e reserva o crédito; o limite de 2/semana não se aplica | Decisão do usuário (AD-019), mesma latitude do AD-011 | y |
| Cancelamento pelo estúdio com reposição reservada | O crédito da reposição volta a `DISPONIVEL` com o vencimento original | Decisão do usuário (AD-020) | y |
| "Devolver crédito" do admin | Volta o status para `DISPONIVEL` mantendo o `expires_at` original, a partir de `RESERVADO`, `UTILIZADO` ou `CANCELADO` | Decisão do usuário (AD-021), PRD 6.6 e PRD 15 ("Crédito devolvido: mantém vencimento original") | y |
| Crédito do estúdio para quem já avisou falta | Gera o crédito do estúdio mesmo assim; quem já tem crédito daquela ocorrência não recebe um segundo | Decisão do usuário (AD-025) | y |
| Créditos "próximos do vencimento" | Os `DISPONIVEL` que vencem nos próximos 7 dias | PRD 4.1 menciona o painel de créditos próximos do vencimento sem definir a janela; 7 dias é um default operacional | n |
| Responsável pela alteração manual de crédito | Registrado por rótulo (`admin_label`); `admin_user_id` fica reservado para a feature de auth | PRD 6.6 exige "Administrador responsável", mas `USERS`/auth não existem nesta slice (PRD 2 e 12) | n |
| Valores de enumeração do crédito e do status da reserva | Português maiúsculo no mesmo estilo dos enums já existentes no schema (`ATIVA`, `CANCELADA`, `AGENDADA`) | Consistência com o schema atual; os nomes vêm do vocabulário do PRD 6.2 | n |
| Vencimento de crédito já reservado | A reserva feita enquanto o crédito era válido permanece válida; o crédito é liquidado como `UTILIZADO` no fim da aula | Evitacancelar reserva já confirmada; o vencimento bloqueia novo uso, não quebra o que já foi agendado | n |
| Concessão manual de crédito | Admin pode conceder crédito a qualquer aluno (inclusive inativo), com validade de 30 dias | PRD 6.1: "conceder crédito manualmente em qualquer situação excepcional" | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Aviso de não comparecimento do aluno fixo ⭐ MVP

**User Story**: Como admin, quero registrar o aviso de não comparecimento de um aluno fixo em uma ocorrência, para que a vaga seja liberada e o crédito de reposição saia automaticamente conforme a regra de 24h.

**Why P1**: O crédito só existe a partir do cancelamento da aula fixa (PRD 6.1); é a origem de todo o dinheiro do módulo.

**Acceptance Criteria**:

1. WHEN o admin registra o aviso de não comparecimento de um aluno fixo em uma ocorrência THEN o sistema SHALL criar o registro do aluno naquela ocorrência e SHALL liberar a vaga <!-- event-driven -->
2. IF a antecedência entre o instante atual e o início da aula for igual ou superior a 24 horas THEN o sistema SHALL registrar o cancelamento daquela ocorrência para aquele aluno <!-- unwanted-behavior -->
3. IF a antecedência for inferior a 24 horas THEN o sistema SHALL registrar a falta naquela ocorrência para aquele aluno <!-- unwanted-behavior -->
4. WHEN o aviso é registrado com antecedência igual ou superior a 24 horas THEN o sistema SHALL gerar 1 crédito do aluno com origem CANCELAMENTO_AULA_FIXA, status DISPONIVEL e vencimento 30 dias após a geração <!-- event-driven -->
5. WHEN a antecedência é exatamente 24 horas THEN o sistema SHALL gerar o crédito <!-- event-driven -->
6. WHEN a antecedência é 23 horas e 59 minutos THEN o sistema SHALL registrar a falta e SHALL NOT gerar crédito <!-- event-driven -->
7. IF o aluno já tem registro de cancelamento ou falta na mesma ocorrência THEN o sistema SHALL recusar o novo aviso, sem gerar crédito adicional e sem duplicar o histórico <!-- unwanted-behavior -->
8. WHILE o aluno tiver cancelamento ou falta registrado em uma ocorrência THEN o sistema SHALL manter o vínculo fixo do aluno ativo para as ocorrências futuras <!-- state-driven -->
9. WHEN o aluno cancela ou falta em uma ocorrência THEN o sistema SHALL excluir o aluno da composição daquela ocorrência e as vagas disponíveis SHALL aumentar em 1 <!-- event-driven -->
10. The system SHALL registrar no histórico do aluno o cancelamento e a falta com data, hora, ocorrência, antecedência e responsável <!-- ubiquitous -->

**Independent Test**: turma com 2 fixos; admin registra aviso de um deles com 48h de antecedência e vê crédito gerado, vaga liberada e ocorrência com 1 fixo; registra aviso com 23h59 e vê falta sem crédito; repete o registro e vê recusa.

---

### P1: Crédito de reposição como entidade ⭐ MVP

**User Story**: Como admin, quero consultar os créditos de um aluno com origem, validade, status e histórico de alterações, para que eu saiba o que o aluno tem direito e o que já usou.

**Why P1**: Sem entidade de crédito não há validade, nem auditoria, nem devolução possível; o PRD 12 define CREDITS e CREDIT_TRANSACTIONS.

**Acceptance Criteria**:

1. The system SHALL persistir cada crédito com aluno, origem, data de geração, vencimento, status e as referências de origem e de uso quando houver <!-- ubiquitous -->
2. The system SHALL manter as origens CANCELAMENTO_AULA_FIXA, CANCELAMENTO_ESTUDIO e CONCESSAO_MANUAL e os status DISPONIVEL, RESERVADO, UTILIZADO, VENCIDO e CANCELADO <!-- ubiquitous -->
3. WHILE o instante atual for posterior ao vencimento do crédito THEN o sistema SHALL tratá-lo como VENCIDO e SHALL bloqueá-lo para uso em leitura e em agendamento <!-- state-driven -->
4. The system SHALL garantir no máximo 1 crédito por origem (reserva de origem ou ocorrência de origem) e recusar a criação duplicada <!-- ubiquitous -->
5. The system SHALL registrar toda alteração de status de um crédito com estado anterior, novo estado, motivo, responsável e data e hora <!-- ubiquitous -->
6. IF a alteração for manual e o motivo estiver vazio THEN o sistema SHALL recusar a operação <!-- unwanted-behavior -->
7. WHEN o horário de término da ocorrência da reposição passar THEN o sistema SHALL tratar o crédito da reserva como UTILIZADO, sem etapa manual de presença <!-- event-driven -->

**Independent Test**: conceder um crédito e ver a linha persistida com vencimento +30d; simular o vencimento e ver o status efetivo VENCIDO e o uso bloqueado; tentar alterar sem motivo e ver recusa.

---

### P1: Agendamento de reposição ⭐ MVP

**User Story**: Como aluno, quero agendar uma reposição usando meu crédito disponível, para que eu reponha a aula que perdi.

**Why P1**: É o propósito do crédito (PRD 6.4); sem agendamento o crédito não tem utilidade.

**Acceptance Criteria**:

1. WHEN o aluno agenda uma reposição usando 1 crédito DISPONIVEL válido THEN o sistema SHALL criar a reserva do tipo MAKEUP, SHALL marcar o crédito como RESERVADO e SHALL vincular reserva e crédito <!-- event-driven -->
2. IF o aluno não tiver crédito DISPONIVEL válido THEN o sistema SHALL recusar o agendamento sem criar reserva e sem reservar crédito <!-- unwanted-behavior -->
3. IF no autoatendimento o aluno já tiver 2 reposições ativas na semana da ocorrência THEN o sistema SHALL recusar a nova reposição <!-- unwanted-behavior -->
4. The system SHALL contar para o limite as reservas MAKEUP ativas cuja data da ocorrência esteja na semana de segunda a domingo da ocorrência agendada <!-- ubiquitous -->
5. WHEN o admin agenda uma reposição manualmente THEN o sistema SHALL exigir 1 crédito DISPONIVEL válido do aluno, SHALL reservá-lo e SHALL NOT aplicar o limite semanal <!-- event-driven -->
6. IF duas reservas concorrentes usarem o mesmo crédito THEN exatamente uma SHALL ser confirmada e o crédito SHALL ficar reservado uma única vez <!-- unwanted-behavior -->
7. The system SHALL permitir agendar a reposição em qualquer modalidade de turma <!-- ubiquitous -->
8. The system SHALL informar a elegibilidade do aluno para agendar reposição e listar somente turmas com vaga disponível <!-- ubiquitous -->

**Independent Test**: aluno com 2 créditos agenda reposição numa turma de outra modalidade e vê o crédito RESERVADO; tentar de novo sem crédito e ver recusa; criar 2 reposições na semana e ver a terceira bloqueada; admin agenda reposição manual na semana cheia e ver que passa.

---

### P1: Cancelamento de reposição ⭐ MVP

**User Story**: Como aluno, quero cancelar uma reposição que não vou fazer, para que a vaga volte e eu não perca o crédito se avisar com tempo.

**Why P1**: Fecha o ciclo do crédito: quem devolve em cima do horário mantém o direito (PRD 6.5).

**Acceptance Criteria**:

1. WHEN o aluno cancela uma reposição com antecedência igual ou superior a 24 horas THEN o sistema SHALL cancelar a reserva, SHALL liberar a vaga e SHALL devolver o crédito a DISPONIVEL mantendo o vencimento original <!-- event-driven -->
2. WHEN o aluno cancela uma reposição com antecedência inferior a 24 horas THEN o sistema SHALL cancelar a reserva, SHALL liberar a vaga e SHALL cancelar definitivamente o crédito <!-- event-driven -->
3. The system SHALL NOT gerar crédito novo ao cancelar uma reposição <!-- ubiquitous -->

**Independent Test**: agendar reposição, cancelar com 48h e ver crédito DISPONIVEL com o mesmo vencimento; agendar outra, cancelar com 2h e ver crédito CANCELADO e nenhuma origem nova.

---

### P1: Cancelamento de aula pelo estúdio ⭐ MVP

**User Story**: Como admin, quero cancelar uma aula do estúdio, para que as reservas sejam desfeitas e todo aluno fixo afetado receba crédito automaticamente.

**Why P1**: PRD 7.3 marca o cancelamento pelo estúdio como gatilho de crédito; é a compensação que o estúdio deve ao aluno.

**Acceptance Criteria**:

1. WHEN o admin cancela uma ocorrência THEN o sistema SHALL marcá-la como CANCELADA, SHALL cancelar as reservas ativas dela e SHALL liberar a capacidade <!-- event-driven -->
2. WHEN o admin cancela uma ocorrência THEN o sistema SHALL gerar 1 crédito de origem CANCELAMENTO_ESTUDIO para cada aluno fixo afetado, com vencimento 30 dias após a geração <!-- event-driven -->
3. WHEN a ocorrência cancelada tinha uma reposição reservada THEN o sistema SHALL devolver o crédito da reposição a DISPONIVEL mantendo o vencimento original <!-- event-driven -->
4. IF o cancelamento da mesma ocorrência for repetido THEN o sistema SHALL NOT gerar créditos duplicados <!-- unwanted-behavior -->
5. WHEN o admin editar o dia da semana ou o horário de uma turma THEN o sistema SHALL cancelar as ocorrências futuras antigas, SHALL cancelar as reservas delas e SHALL gerar 1 crédito de origem CANCELAMENTO_ESTUDIO para cada aluno fixo afetado em cada ocorrência cancelada <!-- event-driven -->
6. IF o aluno já tinha cancelado ou faltado na ocorrência antes do cancelamento pelo estúdio THEN o sistema SHALL gerar o crédito do estúdio quando o aluno ainda não tiver crédito daquela ocorrência e SHALL NOT gerar um segundo crédito quando já tiver <!-- unwanted-behavior -->

**Independent Test**: turma com 3 fixos e 1 reposição reservada; cancelar a ocorrência e ver 3 créditos de estúdio, 1 crédito devolvido e a reserva cancelada; repetir o cancelamento e ver que nada duplicou; editar o dia da turma e ver 1 crédito de estúdio por fixo por ocorrência antiga.

---

### P2: Administração de créditos

**User Story**: Como admin, quero conceder, devolver e cancelar créditos de um aluno, para que eu resolva situações excecionais sem mexer no banco.

**Why P1**: O PRD 6.6 dá esse poder ao admin e exige rastreabilidade de cada alteração manual.

**Acceptance Criteria**:

1. WHEN o admin concede crédito manual a um aluno THEN o sistema SHALL criar 1 crédito DISPONIVEL de origem CONCESSAO_MANUAL, com vencimento 30 dias após a geração, e SHALL registrar a transação <!-- event-driven -->
2. WHEN o admin devolve um crédito THEN o sistema SHALL voltar o status a DISPONIVEL mantendo o vencimento original e SHALL registrar a transação com o motivo <!-- event-driven -->
3. WHEN o admin cancela um crédito THEN o sistema SHALL marcar o crédito como CANCELADO e SHALL registrar a transação com o motivo <!-- event-driven -->
4. The system SHALL permitir consultar por aluno os créditos com data de geração, vencimento, status, origem e as transações de cada crédito <!-- ubiquitous -->
5. The system SHALL permitir consultar os créditos DISPONIVEL que vencem nos próximos 7 dias <!-- ubiquitous -->

**Independent Test**: conceder, devolver e cancelar créditos e conferir status e transações em cada passo; consultar a lista de vencimentos próximos.

---

### P2: Tela mínima do admin

**User Story**: Como admin, quero uma tela de créditos do aluno e as ações de cancelamento na grade, para que eu execute o fluxo do dia a dia sem abrir o banco.

**Why P1**: Sem UI o módulo não é operável; a área do aluno vem depois (AD-016).

**Acceptance Criteria**:

1. WHEN o admin abre a tela de créditos de um aluno THEN o sistema SHALL listar os créditos do aluno com geração, vencimento, status, origem e as transações de cada crédito <!-- event-driven -->
2. WHEN o admin concede, devolve ou cancela um crédito pela tela THEN o sistema SHALL exigir o motivo, SHALL aplicar a alteração e SHALL apresentar o novo status e a transação registrada <!-- event-driven -->
3. WHEN o admin registra na grade o aviso de não comparecimento de um aluno fixo THEN o sistema SHALL apresentar o resultado do registro, com o crédito gerado ou a falta sem crédito <!-- event-driven -->
4. WHEN o admin cancela uma aula na grade THEN o sistema SHALL apresentar o resultado do cancelamento, com as reservas canceladas e a quantidade de créditos gerados <!-- event-driven -->
5. WHEN o admin agenda uma reposição manual pela grade THEN o sistema SHALL exigir a escolha de um crédito DISPONIVEL válido do aluno antes de confirmar <!-- event-driven -->

**Independent Test**: abrir a tela de créditos de um aluno, conceder um crédito com motivo e ver a transação; pela grade, registrar um aviso e ver o crédito gerado.

---

## Design (inline)

Decisões de desenho conforme AD-004 (monolito modular) e AD-012
(identificadores em inglês). Nenhuma regra de negócio mora em `src/app/`.

### Schema

- `credits`: `id`, `student_id` (FK students), `source`, `source_booking_id`
  (FK bookings, nullable), `source_session_id` (FK class_sessions, nullable),
  `generated_at`, `expires_at`, `status`, `used_booking_id` (FK bookings,
  nullable), `admin_user_id` (uuid, nullable, reservado para a feature de
  auth), `admin_label` (text, responsável até lá).
  Índices: único `(student_id, source, source_booking_id)` quando
  `source_booking_id` não é nulo; único `(student_id, source,
  source_session_id)` quando `source_session_id` não é nulo; índice
  `(student_id, status)` para a consulta por aluno.
- `credit_transactions`: `id`, `credit_id` (FK credits), `action`,
  `previous_status`, `new_status`, `reason` (NOT NULL), `admin_user_id`
  (nullable), `admin_label` (NOT NULL), `created_at`.
- `bookings` (ajuste): `status` passa a aceitar `FALTA`; entram
  `cancelled_at` e `cancelled_by` (`ALUNO` | `ESTUDIO`); índice único
  parcial `(student_id, class_session_id)` para `booking_type = FIXED`,
  impedindo dois registros do mesmo aluno na mesma ocorrência.

### Regras de domínio (`src/modules/credits/domain/`, funções puras)

- `hoursUntilOccurrence(sessionDate, startTime, now)`: antecedência em
  horas, fuso America/Sao_Paulo.
- `isEligibleForCredit(hours)`: `hours >= 24`.
- `creditExpiresAt(generatedAt)`: geração + 30 dias.
- `effectiveCreditStatus(credit, now, occurrenceEnded)`: ordem CANCELADO >
  UTILIZADO persistido > RESERVADO com ocorrência encerrada > VENCIDO
  (agora > `expires_at`) > status persistido. Expiração e uso são
  calculados na leitura; o status persistido é cache (AD-007).
- `weekKey(date)`: semana de segunda a domingo no fuso do estúdio.
- `countWeeklyMakeups(bookings)`: reposições MAKEUP ativas da semana da
  ocorrência.

### Serviços (`src/modules/credits/services/`)

- `credits.ts`: `grantCredit`, `returnCredit`, `cancelCredit`,
  `listStudentCredits`, `listCreditsExpiringSoon`, `settleCredits`
  (liquidar vencidos/utilizados na leitura).
- `cancellations.ts`: `registerNonAttendance` (aviso de falta/cancelamento
  do fixo), `cancelOccurrenceByStudio` (cancela reservas, devolve créditos de
  reposição e gera créditos dos fixos afetados).
- `makeups.ts`: `bookMakeupByStudent` (autoatendimento: crédito válido +
  limite semanal), `bookMakeupByAdmin` (crédito válido, sem limite),
  `cancelMakeup` (>= 24h devolve, < 24h cancela), `getMakeupEligibility`,
  `listMakeupTargets` (só turmas com vaga).
- `transactions.ts`: registro de transação em toda alteração de status.

### Pontos de integração

- `src/modules/bookings/services/sessions.ts` (`cancelFutureSessions`):
  passa a gerar créditos por ocorrência cancelada (AD-017).
- `src/modules/bookings/services/composition.ts`
  (`getOccurrenceComposition`): subtrai do total os fixos com registro de
  cancelamento ou falta na ocorrência (AD-022).
- `src/modules/bookings/services/bookings.ts` (`createBooking`): tipo
  MAKEUP passa a exigir crédito válido e a reservá-lo (AD-019).
- `src/app/(admin)/grade`: registro de não comparecimento e cancelamento
  de aula.
- `src/app/(admin)/creditos`: tela de créditos do aluno.

### Transações e concorrência

- Reserva de crédito: `SELECT ... FOR UPDATE` na linha do crédito dentro
  da transação; o segundo contenders vê o status já RESERVADO e é
  recusado (CRD-22).
- Cancelamento pelo estúdio: transação com lock da ocorrência; cancela
  reservas ativas, devolve créditos de reposição e gera créditos dos fixos
  afetados; os índices únicos de origem impedem duplicidade em repetição
  (CRD-31).
- Edição de dia/horário: reusa o mesmo caminho de cancelamento por
  ocorrência, gerando 1 crédito por fixo afetado em cada ocorrência
  antiga (CRD-32).

---

## Edge Cases

- IF a antecedência for exatamente 24 horas THEN o sistema SHALL gerar o crédito (CRD-05)
- IF a antecedência for 23 horas e 59 minutos THEN o sistema SHALL registrar a falta e SHALL NOT gerar crédito (CRD-06)
- IF o crédito vencer antes da aula já reservada THEN a reserva SHALL permanecer válida e o crédito SHALL ser liquidado como UTILIZADO no fim da aula
- IF o admin cancelar uma ocorrência e depois o aluno avisar não comparecimento nessa mesma ocorrência THEN o sistema SHALL recusar o aviso, porque a ocorrência já está CANCELADA
- IF o aluno avisar não comparecimento numa ocorrência no passado THEN o sistema SHALL recusar o registro
- IF o studio cancelar uma ocorrência com 2 reposições reservadas THEN o sistema SHALL devolver os 2 créditos, cada um com o seu vencimento original
- IF o admin conceder crédito com motivo em branco THEN o sistema SHALL recusar sem criar crédito
- IF duas reposições forem agendadas no mesmo minuto para a mesma semana THEN o sistema SHALL aplicar o limite de 2, contando as reservas ativas da semana da ocorrência

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CRD-01 | P1: Aviso de não comparecimento | - | Pending |
| CRD-02 | P1: Aviso de não comparecimento | - | Pending |
| CRD-03 | P1: Aviso de não comparecimento | - | Pending |
| CRD-04 | P1: Aviso de não comparecimento | - | Pending |
| CRD-05 | P1: Aviso de não comparecimento | - | Pending |
| CRD-06 | P1: Aviso de não comparecimento | - | Pending |
| CRD-07 | P1: Aviso de não comparecimento | - | Pending |
| CRD-08 | P1: Aviso de não comparecimento | - | Pending |
| CRD-09 | P1: Aviso de não comparecimento | - | Pending |
| CRD-10 | P1: Aviso de não comparecimento | - | Pending |
| CRD-11 | P1: Crédito de reposição | - | Pending |
| CRD-12 | P1: Crédito de reposição | - | Pending |
| CRD-13 | P1: Crédito de reposição | - | Pending |
| CRD-14 | P1: Crédito de reposição | - | Pending |
| CRD-15 | P1: Crédito de reposição | - | Pending |
| CRD-16 | P1: Crédito de reposição | - | Pending |
| CRD-17 | P1: Agendamento de reposição | - | Pending |
| CRD-18 | P1: Agendamento de reposição | - | Pending |
| CRD-19 | P1: Agendamento de reposição | - | Pending |
| CRD-20 | P1: Agendamento de reposição | - | Pending |
| CRD-21 | P1: Agendamento de reposição | - | Pending |
| CRD-22 | P1: Agendamento de reposição | - | Pending |
| CRD-23 | P1: Agendamento de reposição | - | Pending |
| CRD-24 | P1: Agendamento de reposição | - | Pending |
| CRD-25 | P1: Cancelamento de reposição | - | Pending |
| CRD-26 | P1: Cancelamento de reposição | - | Pending |
| CRD-27 | P1: Cancelamento de reposição | - | Pending |
| CRD-28 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-29 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-30 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-31 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-32 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-33 | P1: Cancelamento pelo estúdio | - | Pending |
| CRD-34 | P2: Administração de créditos | - | Pending |
| CRD-35 | P2: Administração de créditos | - | Pending |
| CRD-36 | P2: Administração de créditos | - | Pending |
| CRD-37 | P2: Administração de créditos | - | Pending |
| CRD-38 | P2: Administração de créditos | - | Pending |
| CRD-39 | P2: Tela mínima do admin | - | Pending |
| CRD-40 | P2: Tela mínima do admin | - | Pending |
| CRD-41 | P2: Tela mínima do admin | - | Pending |
| CRD-42 | P2: Tela mínima do admin | - | Pending |
| CRD-43 | P2: Tela mínima do admin | - | Pending |
| CRD-44 | P1: Crédito de reposição | - | Pending |

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 6.3 e 13.11: "O sistema deverá executar uma rotina automática de atualização dos créditos vencidos" | Expiração e uso são calculados na leitura; o `status` persistido é cache, sem cron | y - AD-007 |
| PRD 5.1 e 6.1: fixos materializados como reservas recorrentes e cancelamento da aula fixa | Fixos seguem derivados de `FIXED_ENROLLMENTS`; o cancelamento pontual do fixo é um registro `BOOKING` do tipo FIXED na ocorrência, sem alterar o vínculo semanal | y - AD-008, AD-022 |
| PRD 6.4: "Máximo de duas reposições por aluno de segunda a domingo" | A semana contada é a da data da ocorrência da reposição, não a da data do pedido | y - AD-024 |
| PRD 4.6 e 6.4: agendamento manual de reposição sem validação de crédito | O agendamento manual pelo admin exige crédito válido e reserva o crédito; o limite semanal vale só para o autoatendimento | y - AD-010, AD-019 |
| PRD 6.4: "Ao concluir a aula, registrar como utilizado" | O crédito vira UTILIZADO pelo horário de término da ocorrência, sem etapa manual de presença | y - AD-018 |
| PRD 6.1 e 9.4: "Exibir crédito na área do aluno" e botão "agendar reposição" | A UI do aluno fica para a feature da área do aluno; aqui ficam as regras e os serviços que ela consumirá | y - AD-016 |
| PRD 7.3: "Gerar automaticamente um crédito para cada aluno fixo afetado" | O crédito do estúdio é gerado também para quem já avisou falta e não é duplicado para quem já tem crédito daquela ocorrência | y - AD-025 |
| PRD 6.5 e 7.3: cancelamento pelo estúdio cancela as reservas da ocorrência | O cancelamento pelo estúdio devolve à DISPONIVEL o crédito da reposição cancelada, e a devolução pelo admin mantém o vencimento original | y - AD-020, AD-021 |

## Sources

- `PRD.md.txt` (SRS Yogue-se V1.0) - binding - seções 3 (capacidade, fuso do estúdio, semana de segunda a domingo), 4.1 (painel de créditos), 4.4 (histórico de cancelamentos e faltas), 4.6 (agendamento manual), 5.1 (horários fixos recorrentes), 6.1 (cancelamento de aula fixa, 24h, crédito automático), 6.2 (origens e status do crédito), 6.3 (validade de 30 dias, bloqueio após vencimento), 6.4 (agendamento de reposição, crédito válido, limite de 2 por semana, qualquer modalidade, turmas com vagas), 6.5 (cancelamento de reposição, devolve/perde crédito), 6.6 (administração de créditos, motivo e responsável), 7.3 (cancelamento de aula pelo estúdio, crédito automático, sem duplicidade), 9.4 (meus créditos), 12 (entidades CREDITS e CREDIT_TRANSACTIONS), 13.9 (prevenção de créditos duplicados), 15 (casos de aceite do módulo de créditos), 17 (fonte única).

---

## Success Criteria

- [ ] Teste do PRD "Cancelamento com 24h exatas: Gera crédito" passa como teste Vitest
- [ ] Teste do PRD "Cancelamento com 23h59: Não gera crédito" passa como teste Vitest
- [ ] Teste do PRD "Crédito após 30 dias: Fica indisponível" passa como teste Vitest
- [ ] Teste do PRD "Agendamento sem crédito: É bloqueado" passa como teste Vitest
- [ ] Teste do PRD "Terceira reposição na semana: É bloqueada" passa como teste Vitest
- [ ] Teste do PRD "Reposição em outra modalidade: Permitida" passa como teste Vitest
- [ ] Teste do PRD "Cancelamento de reposição com 24h: Devolve crédito" passa como teste Vitest
- [ ] Teste do PRD "Cancelamento de reposição com menos de 24h: Perde crédito" passa como teste Vitest
- [ ] Teste do PRD "Crédito devolvido: Mantém vencimento original" passa como teste Vitest
- [ ] Teste do PRD "Cancelamento pelo estúdio: Gera crédito automático" passa como teste Vitest
- [ ] Editar dia/horário de uma turma gera 1 crédito de estúdio por fixo por ocorrência futura antiga cancelada
- [ ] Nenhum crédito é gerado em duplicidade no cancelamento repetido de uma ocorrência
- [ ] A tela de créditos do aluno mostra a lista com validade, status e transações
