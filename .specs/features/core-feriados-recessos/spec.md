# Core Feriados e Recessos Specification

**Approved**: 2026-11-10 - user: "aprovo"

## Problem Statement

O PRD 7.1/7.2 manda o sistema bloquear as turmas nos feriados e recessos sem
gerar crédito, e o PRD 15 exige o teste "Feriado | Não gera crédito". Hoje a
base existe mas está inoperável de ponta a ponta: as tabelas `holidays` e
`studio_closures` e os serviços de criação existem sem tela nem server action
(o admin não consegue cadastrar nada), o bloqueio só marca a ocorrência
BLOQUEADA na leitura (uma ocorrência já materializada continua AGENDADA até
alguém tocá-la), não existe regra para as reservas já feitas nas datas
bloqueadas — a reserva fica ativa numa aula que não vai acontecer e o crédito
da reposição viraria UTILIZADO pela liquidação do fim da aula (AD-018) — e não
existe caminho de desbloqueio: removido o feriado, a ocorrência fica
BLOQUEADA para sempre.

## Goals

- [ ] Feriado e recesso bloqueiam as ocorrências das datas correspondentes de hoje em diante, com efeito imediato no cadastro (não só na próxima leitura)
- [ ] Nenhum crédito é criado por feriado ou recesso — o critério do PRD 15 "Feriado | Não gera crédito" passa como teste Vitest
- [ ] Reservas já feitas nas datas bloqueadas são canceladas e o crédito da reposição volta a DISPONIVEL com o vencimento original
- [ ] Remover ou editar o bloqueio devolve as ocorrências a AGENDADA automaticamente, sem restaurar reservas
- [ ] Tela do admin `/feriados` lista, cria, edita e remove feriados e recessos, com o resultado de cada operação

## Out of Scope

| Feature | Reason |
| --- | --- |
| Bloqueio de horário específico de turma (PRD 4.3 "bloquear horários") | Decisão do usuário (AD-032): vai para o painel admin (AD-009); hoje o efeito equivalente é desativar a turma na grade |
| Notificação ao aluno sobre a reserva cancelada pelo bloqueio | Módulo de notificações é fase posterior; sem infra nesta slice |
| Seed de feriados nacionais brasileiros | Decisão do usuário (AD-030): o admin cadastra à mão (PRD 7.1) |
| Efeito retroativo de bloqueio em ocorrências passadas | Decisão do usuário (AD-029): efeito só para frente |
| Dashboard (PRD 4.1) e calendário administrativo (PRD 4.2) | Feature do painel admin |
| Autenticação e perfis (PRD 2, 13) | Feature própria; responsável registrado por rótulo quando aplicável (AD-016) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Reserva já feita quando o bloqueio é cadastrado | Reservas ativas canceladas (por estúdio), vaga volta, crédito RESERVADO da reposição volta a DISPONIVEL com o vencimento original; nenhum crédito novo | Decisão do usuário (AD-026); evita o crédito virar UTILIZADO por aula que não acontece (AD-018) e a vaga ocupada à toa; precedente AD-020 | y |
| Desbloqueio | Ocorrência BLOQUEADA volta sozinha a AGENDADA ao remover/editar o bloqueio (hoje em diante; CANCELADA não ressuscita); reservas canceladas não são restauradas | Decisão do usuário (AD-027); o aluno remarca com o crédito de volta | y |
| Recesso sobreposto a recesso ou feriado | Permitido, sem unificar; a data fica bloqueada enquanto qualquer bloqueio a cobrir | Decisão do usuário (AD-028); bloquear é idempotente | y |
| Feriado/recesso em data passada | Permitido como registro histórico; o bloqueio só altera ocorrências de hoje em diante | Decisão do usuário (AD-029) | y |
| Feriados nacionais | Cadastrados à mão pelo admin, sem seed | Decisão do usuário (AD-030); PRD 7.1 dá o cadastro ao admin | y |
| Cancelamento pelo estúdio em ocorrência bloqueada | Recusado com erro claro, sem gerar crédito | Decisão do usuário (AD-031); PRD 7.3 geraria créditos que o feriado veda (PRD 7.1) | y |
| Bloqueio de horário específico de turma (PRD 4.3) | Fora desta feature; painel admin (AD-009) | Decisão do usuário (AD-032) | y |
| Coluna `status` do PRD 12 em HOLIDAYS/STUDIO_CLOSURES | Não incluída; remoção física do registro | Decisão do usuário (AD-033): o desbloqueio é a remoção/edição (AD-027); nenhuma regra do PRD usa status de bloqueio | y |
| Rota e título da tela | `/feriados`, "Feriados e recessos", no grupo (admin) | Padrão das telas existentes (`/grade`, `/creditos`) | n |
| Cancelamento de reserva pelo bloqueio | Registrado com `cancelled_by = ESTUDIO` | O fechamento é decisão do estúdio; o enum já existe no schema | n |
| Mecanismo do bloqueio/desbloqueio | Reconcílio determinístico por janela: após toda criação/edição/remoção, as ocorrências da janela são reprocessadas por uma transição pura de status | Uma única regra de transição, idempotente; a materialização preguiçosa atual permanece como retaguarda | n |
| Responsável pelas ações da tela | Rótulo fixo `admin`, sem auth | Mesma latitude das telas existentes (AD-016) | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Bloqueio de datas por feriado e recesso ⭐ MVP

**User Story**: Como admin, quero cadastrar um feriado ou recesso e ver as turmas daquelas datas bloqueadas de imediato, para que ninguém reserve aula que o estúdio não vai dar e nenhum crédito seja gerado.

**Why P1**: É a regra central do PRD 7.1/7.2 e o critério de aceitação do PRD 15 ("Feriado | Não gera crédito"); sem efeito imediato o admin cadastra o feriado e a grade continua parecendo aberta.

**Acceptance Criteria**:

1. WHEN um feriado é cadastrado THEN o sistema SHALL marcar como BLOQUEADA toda ocorrência AGENDADA daquela data que seja de hoje em diante <!-- event-driven -->
2. WHEN um recesso é cadastrado THEN o sistema SHALL marcar como BLOQUEADA toda ocorrência AGENDADA de cada data do período, extremos inclusos, que seja de hoje em diante <!-- event-driven -->
3. WHEN uma ocorrência passa a BLOQUEADA pelo cadastro do bloqueio THEN o sistema SHALL cancelar as reservas ativas dela e SHALL liberar as vagas <!-- event-driven -->
4. WHEN a ocorrência bloqueada tinha reposição com crédito RESERVADO THEN o sistema SHALL devolver o crédito a DISPONIVEL mantendo o vencimento original e SHALL registrar a transação <!-- event-driven -->
5. WHEN um feriado ou recesso é cadastrado THEN o sistema SHALL NOT criar crédito algum para qualquer aluno <!-- event-driven -->
6. IF a ocorrência coberta pelo bloqueio estiver no passado THEN o sistema SHALL mantê-la como está, sem alterar status nem reservas <!-- unwanted-behavior -->
7. IF a ocorrência coberta já estiver CANCELADA THEN o sistema SHALL mantê-la CANCELADA, sem tocar em suas reservas históricas <!-- unwanted-behavior -->
8. WHILE a data estiver coberta por feriado ou recesso THEN o sistema SHALL recusar nova reserva na ocorrência <!-- state-driven -->
9. IF o admin cancela pelo estúdio uma ocorrência BLOQUEADA THEN o sistema SHALL recusar a operação, SHALL manter a ocorrência BLOQUEADA e SHALL NOT gerar crédito <!-- unwanted-behavior -->

**Independent Test**: turma com ocorrência AGENDADA e uma reposição reservada com crédito; cadastrar o feriado daquela data e ver a ocorrência BLOQUEADA, a reserva CANCELADA, o crédito DISPONIVEL com o vencimento original e zero linhas de crédito criadas; tentar reservar na data e ver recusa; tentar cancelar a ocorrência pelo estúdio e ver recusa.

---

### P1: Desbloqueio ⭐ MVP

**User Story**: Como admin, quero que remover ou editar um feriado/recesso reabra as turmas daquelas datas automaticamente, para que um erro de cadastro não deixe aulas bloqueadas para sempre.

**Why P1**: Sem caminho de volta, todo erro de digitação numa data vira ocorrência BLOQUEADA permanente; a remoção/edição é o desbloqueio decidido (AD-027).

**Acceptance Criteria**:

1. WHEN um feriado é removido THEN o sistema SHALL devolver a AGENDADA toda ocorrência BLOQUEADA daquela data que seja de hoje em diante e que não seja mais coberta por nenhum outro bloqueio <!-- event-driven -->
2. WHEN um recesso é removido ou encurtado THEN o sistema SHALL devolver a AGENDADA as ocorrências BLOQUEADA das datas que deixaram de ser cobertas e que sejam de hoje em diante <!-- event-driven -->
3. WHILE a data continuar coberta por qualquer outro bloqueio THEN o sistema SHALL manter a ocorrência BLOQUEADA <!-- state-driven -->
4. IF a ocorrência bloqueada estiver no passado THEN o desbloqueio SHALL mantê-la BLOQUEADA <!-- unwanted-behavior -->
5. IF a data da ocorrência não corresponder mais ao dia da semana da turma THEN o desbloqueio SHALL mantê-la BLOQUEADA <!-- unwanted-behavior -->
6. WHEN o desbloqueio devolve uma ocorrência a AGENDADA THEN o sistema SHALL NOT restaurar as reservas canceladas pelo bloqueio <!-- event-driven -->

**Independent Test**: cadastrar feriado, ver a ocorrência BLOQUEADA; remover o feriado e ver a ocorrência AGENDADA sem nenhuma reserva restaurada; cadastrar recesso sobre a mesma data junto com o feriado, remover só o feriado e ver a ocorrência continuar BLOQUEADA.

---

### P2: Gestão de feriados e recessos (tela do admin)

**User Story**: Como admin, quero cadastrar, editar, remover e listar feriados e recessos numa tela, para que eu administre os fechamentos do estúdio sem abrir o banco.

**Why P2**: As regras já rodam no servidor; a tela é o meio operacional (mesmo padrão da UI mínima do admin, AD-016).

**Acceptance Criteria**:

1. WHEN o admin abre a tela de feriados e recessos THEN o sistema SHALL listar os feriados com data e nome e os recessos com início, fim e motivo <!-- event-driven -->
2. WHEN o admin cadastra um feriado pela tela THEN o sistema SHALL gravar data e nome, SHALL aplicar o bloqueio e SHALL apresentar o resultado da operação <!-- event-driven -->
3. IF já existir feriado cadastrado na mesma data THEN o sistema SHALL recusar o cadastro e SHALL apresentar o erro <!-- unwanted-behavior -->
4. WHEN o admin edita um feriado THEN o sistema SHALL aplicar a data e o nome novos e SHALL reprocessar os bloqueios das datas afetadas <!-- event-driven -->
5. IF a edição do feriado colidir com a data de outro feriado THEN o sistema SHALL recusar a edição e SHALL apresentar o erro <!-- unwanted-behavior -->
6. WHEN o admin cadastra um recesso pela tela THEN o sistema SHALL gravar início, fim e motivo, SHALL aplicar o bloqueio e SHALL apresentar o resultado da operação <!-- event-driven -->
7. IF o fim do recesso for antes do início THEN o sistema SHALL recusar o cadastro e SHALL apresentar o erro <!-- unwanted-behavior -->
8. WHEN o admin edita um recesso THEN o sistema SHALL aplicar os valores novos e SHALL reprocessar os bloqueios das datas afetadas <!-- event-driven -->
9. WHEN o admin remove um feriado pela tela THEN o sistema SHALL remover o registro, SHALL desbloquear as ocorrências e SHALL apresentar o resultado da operação <!-- event-driven -->
10. WHEN o admin remove um recesso pela tela THEN o sistema SHALL remover o registro, SHALL desbloquear as ocorrências e SHALL apresentar o resultado da operação <!-- event-driven -->

**Independent Test**: abrir `/feriados`, cadastrar feriado com data e nome e ver na lista; tentar cadastrar a mesma data e ver o erro; editar o recesso encurtando-o e ver as datas refletidas; remover o feriado e ver a grade reabrir as ocorrências.

---

## Design (inline)

Decisões de desenho conforme AD-004 (monolito modular) e AD-012
(identificadores em inglês). Nenhuma regra de negócio mora em `src/app/`.

### Schema

- Nenhuma migration nova. `holidays` (data única + nome) e `studio_closures`
  (start_date, end_date, reason) já existem e bastam. A coluna `status` do
  PRD 12 não é incluída (AD-033): a remoção física é o desbloqueio.

### Domínio puro (`src/modules/bookings/domain/blocks.ts`)

- `isDateCoveredByBlocks(date, blocks)`: a data cai em feriado cadastrado ou
  dentro de um recesso (extremos inclusos), avaliada contra os bloqueios já
  carregados.
- `resolveBlockTransition({ date, currentStatus, slotWeekday, isCovered,
  today })`: devolve a transição da ocorrência — `null` (nada a fazer),
  `"BLOQUEADA"` ou `"AGENDADA"`. Regras: ocorrência CANCELADA nunca muda;
  ocorrência no passado nunca muda; coberta e AGENDADA vira BLOQUEADA; não
  coberta e BLOQUEADA volta a AGENDADA só se o dia da semana da data ainda
  corresponder à turma (guarda para a edição de dia/horário do AD-013); os
  demais casos ficam como estão.

### Serviços

- `src/modules/classes/services/blocks.ts` (estende o existente): CRUD dos
  bloqueios — `updateHoliday` (data + nome, recusa colisão com outro feriado),
  `deleteHoliday`, `updateStudioClosure` (valida fim >= início),
  `deleteStudioClosure`, `listHolidays`, `listStudioClosures`. Toda mutação
  bem-sucedida dispara o reconcílio sobre a janela de datas afetada (união do
  antes e do depois, na edição).
- `src/modules/bookings/services/blocks.ts` (novo): `reconcileBlockedOccurrences`
  — carrega os bloqueios uma vez, varre as ocorrências com status AGENDADA ou
  BLOQUEADA na janela, aplica a transição pura por ocorrência e, quando marca
  BLOQUEADA, cancela as reservas ativas (cancelledBy ESTUDIO) e devolve à
  DISPONIVEL o crédito RESERVADO de cada reposição cancelada, com o vencimento
  original e a transação registrada. Idempotente: rodar duas vezes não muda
  nada na segunda.
- `src/modules/bookings/services/sessions.ts`: o `hasBlock` interno passa a
  usar a cobertura de `isDateCoveredByBlocks` contra os bloqueios carregados —
  fonte única da regra de cobertura (L-005); a materialização preguiçosa
  permanece como retaguarda do reconcílio.

### Pontos de integração

- `src/modules/credits/services/cancellations.ts`
  (`cancelOccurrenceByStudio`): recusa ocorrência BLOQUEADA com erro claro,
  sem cancelar reservas e sem gerar crédito (AD-031). O caminho da edição de
  dia/horário (`cancelFutureSessions`) só seleciona AGENDADA, então não é
  afetado.
- `src/modules/classes/actions.ts` (estende o existente): ações finas do admin
  — criar/editar/remover feriado, criar/editar/remover recesso, listar.
- `src/app/(admin)/feriados/page.tsx` + formulários client: tela "Feriados e
  recessos" com as duas listas e os formulários, apresentando o resultado de
  cada operação (padrão da tela `/creditos`).

### Transações e concorrência

- O reconcílio roda em uma transação por chamada: as mutações de status,
  cancelamento de reservas e devolução de créditos da janela acontecem juntas
  ou nada acontece. A devolução do crédito reusa `returnCredit`, que já grava
  a transação com motivo e responsável.
- A criação/edição/remoção do bloqueio grava a linha e chama o reconcílio na
  sequência; se o reconcílio falhar, a materialização preguiçosa atual cobre o
  bloqueio na próxima leitura — nunca o contrário (desbloqueio sem reconcílio
  deixaria a ocorrência BLOQUEADA, e é por isso que toda remoção/edição passa
  obrigatoriamente por ele).
- Duas ações admin simultâneas sobre bloqueios são idempotentes: a segunda
  reconciliada não encontra transições a fazer.

---

## Edge Cases

- IF o feriado cadastrado for hoje THEN a ocorrência de hoje SHALL ser bloqueada; se a data for ontem, nada é alterado (borda do "hoje em diante")
- IF o feriado for cadastrado para uma data sem ocorrência materializada THEN nada há para marcar; a próxima materialização já nasce BLOQUEADA (comportamento existente)
- IF dois recessos cobrem a mesma data e um é removido THEN a ocorrência permanece BLOQUEADA (FER-12)
- IF o recesso for editado encurtando o período THEN as datas liberadas voltam a AGENDADA e as que permanecem cobertas continuam BLOQUEADA
- IF a edição do feriado mover o bloqueio de uma data para outra THEN a data antiga desbloqueia e a nova bloqueia na mesma operação
- IF o admin remover um feriado cuja ocorrência bloqueada já passou THEN a ocorrência permanece BLOQUEADA (FER-13)
- IF o crédito devolvido pelo bloqueio já estiver com vencimento passado THEN volta a DISPONIVEL e a leitura o resolve como VENCIDO (AD-007)
- IF o recesso cobrir uma data que já tem feriado THEN uma única ocorrência bloqueada, um único bloqueio aplicado (idempotência, já coberta e re-verificada)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FER-01 | P1: Bloqueio de datas | - | Pending |
| FER-02 | P1: Bloqueio de datas | - | Pending |
| FER-03 | P1: Bloqueio de datas | - | Pending |
| FER-04 | P1: Bloqueio de datas | - | Pending |
| FER-05 | P1: Bloqueio de datas | - | Pending |
| FER-06 | P1: Bloqueio de datas | - | Pending |
| FER-07 | P1: Bloqueio de datas | - | Pending |
| FER-08 | P1: Bloqueio de datas | - | Pending |
| FER-09 | P1: Bloqueio de datas | - | Pending |
| FER-10 | P1: Desbloqueio | - | Pending |
| FER-11 | P1: Desbloqueio | - | Pending |
| FER-12 | P1: Desbloqueio | - | Pending |
| FER-13 | P1: Desbloqueio | - | Pending |
| FER-14 | P1: Desbloqueio | - | Pending |
| FER-15 | P1: Desbloqueio | - | Pending |
| FER-16 | P2: Gestão pela tela | - | Pending |
| FER-17 | P2: Gestão pela tela | - | Pending |
| FER-18 | P2: Gestão pela tela | - | Pending |
| FER-19 | P2: Gestão pela tela | - | Pending |
| FER-20 | P2: Gestão pela tela | - | Pending |
| FER-21 | P2: Gestão pela tela | - | Pending |
| FER-22 | P2: Gestão pela tela | - | Pending |
| FER-23 | P2: Gestão pela tela | - | Pending |
| FER-24 | P2: Gestão pela tela | - | Pending |
| FER-25 | P2: Gestão pela tela | - | Pending |

**Coverage:** 25 total, 0 mapped to tasks yet, 25 unmapped (mapeados na fase de Tasks).

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 12: HOLIDAYS e STUDIO_CLOSURES têm coluna `status` | Coluna não incluída; remoção física do registro, que é o próprio desbloqueio | y - AD-033 |
| PRD 7.1/7.2 sem detalhe sobre reservas já feitas | Reservas ativas das ocorrências bloqueadas são canceladas e o crédito da reposição volta com o vencimento original | y - AD-026 |
| PRD 7.1/7.2 sem detalhe sobre desbloqueio | Remover/editar o bloqueio devolve as ocorrências a AGENDADA automaticamente, sem restaurar reservas | y - AD-027 |
| PRD 4.3: "criar, editar, bloquear ou desativar horários" | O bloqueio de horário específico de turma fica para o painel admin; nesta fatia o bloqueio é por data | y - AD-032 |

## Sources

- `PRD.md.txt` (SRS Yogue-se V1.0) - binding - seções 2.1 (admin cadastra feriados e recessos, bloqueia horários), 3 (fuso America/Sao_Paulo), 4.3 (bloquear horários - fora do escopo), 6.4 ("não permitir agendamento em horário bloqueado"), 7.1 (feriados bloqueiam turmas, sem crédito para fixos), 7.2 (recessos, sem crédito), 7.3 (cancelamento pelo estúdio - recusado em ocorrência bloqueada), 12 (entidades HOLIDAYS e STUDIO_CLOSURES), 13.7 (controle transacional), 14 (feedback claro das operações), 15 ("Feriado | Não gera crédito"), 17 (fonte única de dados).
- `.specs/STATE.md` - AD-008, AD-013, AD-014, AD-016 a AD-018, AD-020, AD-021, AD-025 (decisões que esta feature preserva e reutiliza).

---

## Success Criteria

- [ ] O teste do PRD 15 "Feriado | Não gera crédito" passa como teste Vitest
- [ ] Cadastrar feriado/recesso bloqueia imediatamente as ocorrências de hoje em diante e cancela as reservas ativas, devolvendo o crédito da reposição com o vencimento original
- [ ] Nenhuma linha de crédito é criada por cadastro de feriado ou recesso (fixos, reposições e experimentais)
- [ ] Remover ou editar o bloqueio devolve as ocorrências a AGENDADA automaticamente, sem restaurar reservas e sem tocar em ocorrências canceladas ou passadas
- [ ] O cancelamento pelo estúdio é recusado em ocorrência bloqueada, sem crédito
- [ ] A tela `/feriados` lista, cria, edita e remove feriados e recessos, apresentando o resultado de cada operação
