# Admin Turmas Specification

**Approved**: 2026-11-14 - user: "aprovado, vamos fazer primeiro a spec de turmas ate o fim, deixe registrado em algum lugar que a proxima sera o calendario"

## Problem Statement

O CRUD de modalidades e turmas (PRD 4.3) está pronto no servidor —
`src/modules/classes/services/classes.ts` e as actions de
`src/modules/classes/actions.ts` — mas nenhuma tela o usa: o admin não consegue
criar, editar ou desativar turmas pela interface. O seed não cria turmas
(AD-015) e as turmas exibidas na `/grade` são registros pré-existentes em
`class_slots`, então qualquer mudança de grade hoje exige mexer no banco à mão.
O cadastro de turmas é item da FASE 1 do PRD 16.

## Goals

- [ ] Admin cria modalidade e turma pela interface, sem tocar no banco
- [ ] Dados inválidos recusados no servidor com erro específico do campo
- [ ] Edição, desativação e reativação preservam o histórico (nenhum delete físico)

## Out of Scope

| Feature | Reason |
| --- | --- |
| Calendário administrativo diária/semanal/mensal e navegação livre (PRD 4.2) | Feature `admin-calendario`, na sequência (AD-044); a `/grade` atual continua como está |
| Bloqueio de uma turma em uma data específica (PRD 4.3) | P2 do `admin-calendario` (AD-032, AD-044); aqui o equivalente é desativar a turma |
| Cancelamento pelo estúdio de ocorrência | Já existe na `/grade` (AD-016); nada muda aqui |
| Dashboard com indicadores (PRD 4.1) | Já adiado pela admin-base |
| Área do aluno (PRD módulos 12 e 13) | Feature própria (AD-034) |
| Exclusão física de turmas ou modalidades | Ciclo de vida por status preserva histórico (PRD 13.10); a turma utilizada nunca é apagada |
| Notificações, push, deploy, alteração de banco de produção | Fora de escopo desta feature sempre |
| Matrículas fixas e agendamento manual | Já existem (alunos/grade); esta feature não muda nenhuma regra de reserva |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Local da interface | Rota nova `/turmas` no shell do `(admin)`; o calendário evolui a `/grade` na feature seguinte | A `/grade` já concentra composição e skin da marca; gestão de turmas é tela própria | y - AD-044 |
| Ordem de implementação | `admin-turmas` antes do `admin-calendario` | Pequena, desbloqueia criar turma via UI sem depender do seed | y - AD-044 |
| Turmas sobrepostas (mesmo dia/horário, mesma ou outra modalidade) | Permitidas, sem regra nova de conflito | O serviço atual não recusa; PRD não veda; evitar inventar regra | n |
| Turma nova nasce ATIVA | O formulário não tem campo status na criação; status só na edição | Assinatura atual de `createSlotAction` não recebe status; PRD 4.3 lista o campo, atendido pela edição | n |
| Modalidade inativa com turmas ativas | Comportamento atual vale: as turmas deixam de aparecer na grade (RES-05, AD-014); sem bloqueio ou aviso extra na desativação | Regra existente; reativar a modalidade restaura as turmas | n |
| Listagem da `/turmas` | Exibe ativas e inativas (modalidades e turmas) com status, para permitir reativação | Sem listagem de inativas, desativar seria destrutivo para o admin | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Entrada no shell e listagem ⭐ MVP

**User Story**: As a administradora, I want acessar a gestão de turmas pela navegação do painel e ver todas as modalidades e turmas, ativas e inativas, so que a grade da plataforma seja administrada de fora do banco.

**Why P1**: Hoje nenhuma UI alcança o CRUD; o seed não cria turmas (AD-015) e a
operação fica refém de SQL manual.

**Acceptance Criteria**:

1. WHILE o admin está autenticado, o shell SHALL oferecer navegação para Turmas, e a rota `/turmas` SHALL exigir sessão de ADMIN como as demais do `(admin)` (AUTH-01)  <!-- state-driven -->
2. WHEN o admin abre `/turmas` THEN a tela SHALL listar as modalidades e as turmas cadastradas, ativas e inativas, com status, modalidade, dia da semana, horário de início/término e capacidade  <!-- event-driven -->

**Independent Test**: logada, "Turmas" aparece na navegação; a tela lista a turma
pré-existente do banco e as duas modalidades do seed, com status.

---

### P1: Gestão de modalidades ⭐ MVP

**User Story**: As a administradora, I want cadastrar, editar e desativar modalidades so que a oferta de aulas seja minha, não do código.

**Why P1**: PRD 4.3 pede o nome da modalidade no cadastro de turmas; hoje só o
seed cria modalidades.

**Acceptance Criteria**:

1. WHEN o admin submete uma modalidade com nome THEN o sistema SHALL criá-la ATIVA e exibi-la na listagem  <!-- event-driven -->
2. IF o nome chega vazio ou em branco THEN o sistema SHALL recusar no servidor com erro do campo nome, sem criar registro  <!-- unwanted-behavior -->
3. WHEN o admin edita o nome ou o status de uma modalidade THEN o sistema SHALL persistir a mudança e refleti-la na listagem  <!-- event-driven -->
4. WHILE uma modalidade está INATIVA, o formulário de nova turma SHALL deixar de oferecê-la  <!-- state-driven -->
5. IF uma criação de turma chega com modalidade INATIVA THEN o sistema SHALL recusar no servidor com erro do campo modalidade  <!-- unwanted-behavior --> *(guarda nova no serviço: turma sob modalidade inativa nunca apareceria na grade)*

**Independent Test**: criar "Yoga Restorativa", ver na lista; inativá-la e
verificar que o formulário de turma não a oferece; submeter com ela via API e ver
a recusa do servidor.

---

### P1: Cadastro de turma ⭐ MVP

**User Story**: As a administradora, I want cadastrar uma turma com modalidade, dia da semana, horário inicial e final, capacidade e status so que a grade semanal exista sem mexer no banco.

**Why P1**: PRD 4.3 é Fase 1; sem turma criada pela UI, nenhuma ocorrência nova
existe a não ser por seed/SQL.

**Acceptance Criteria**:

1. WHEN o admin submete uma turma com modalidade ATIVA, dia da semana (1 a 7, domingo a sábado, America/Sao_Paulo) e horários de início e término THEN o sistema SHALL criá-la ATIVA com esses dados  <!-- event-driven -->
2. WHEN o admin cria uma turma sem informar capacidade THEN o sistema SHALL gravar capacidade 8 (RES-02)  <!-- event-driven -->
3. IF o cadastro contém fim menor ou igual ao início, dia da semana fora de 1-7, capacidade menor que 1 ou campo obrigatório vazio THEN o sistema SHALL recusar no servidor mencionando o campo inválido (RES-03)  <!-- unwanted-behavior -->
4. IF a modalidade informada não existe THEN o sistema SHALL recusar com erro do campo modalidade  <!-- unwanted-behavior -->
5. WHEN a turma é criada THEN as ocorrências dela SHALL passar a aparecer na `/grade` a partir da próxima data do dia da semana, materializadas sob demanda na leitura (AD-008, RES-27)  <!-- event-driven -->

**Independent Test**: criar "Superioga Clássico, quinta 19h-20h, capacidade 8" e
ver a ocorrência da próxima quinta na `/grade`; submeter fim antes do início e ver
a recusa nomeando o campo.

---

### P1: Edição, desativação e reativação de turma ⭐ MVP

**User Story**: As a administradora, I want editar, desativar e reativar uma turma so que mudanças de grade e fim de turmas aconteçam sem apagar o histórico.

**Why P1**: PRD 4.3 dá os verbos criar, editar e desativar; a edição de
dia/horário já tem regra de servidor (AD-013, AD-017) que precisa chegar à UI com
feedback claro.

**Acceptance Criteria**:

1. WHEN o admin edita dia da semana, horários, capacidade ou status de uma turma THEN o sistema SHALL persistir a mudança e as ocorrências futuras SHALL refletir o novo estado a partir da alteração (RES-04)  <!-- event-driven -->
2. IF a edição reduz a capacidade abaixo da ocupação de uma ocorrência em aberto THEN o sistema SHALL recusar citando a ocorrência mais afetada, com data e ocupação (RES-17)  <!-- unwanted-behavior -->
3. WHEN a edição muda o dia ou o horário THEN o sistema SHALL cancelar as ocorrências futuras da grade antiga, cancelar as reservas ativas delas e gerar 1 crédito CANCELAMENTO_ESTUDIO por aluno fixo afetado em cada ocorrência cancelada (AD-013, AD-017, CRD-32)  <!-- event-driven -->
4. WHEN a edição de dia ou horário conclui THEN a tela SHALL informar o resultado: quantas ocorrências foram canceladas e quantos créditos foram gerados  <!-- event-driven -->
5. WHEN o admin desativa uma turma THEN o sistema SHALL marcar INATIVA sem apagar registro algum; o histórico e as reservas antigas SHALL permanecer; nenhuma ocorrência nova SHALL ser gerada para ela  <!-- event-driven -->
6. WHEN o admin reativa uma turma THEN as ocorrências futuras SHALL voltar a aparecer na próxima leitura, e ocorrências CANCELADAS não SHALL ressuscitar  <!-- event-driven -->

**Independent Test**: editar a turma de quinta 19h para terça 19h e ver o feedback
de ocorrências canceladas + créditos; desativar e ver a turma sumir da grade sem
apagar linhas; reativar e ver as próximas ocorrências voltarem.

---

## Edge Cases

- IF todas as modalidades estão INATIVAS THEN o formulário de nova turma SHALL não oferecer opção de modalidade e a criação SHALL recusar com erro do campo modalidade.
- IF a mesma turma é desativada duas vezes THEN a segunda chamada SHALL manter INATIVA sem erro de estado (idempotência da ação).
- WHILE uma modalidade está INATIVA, suas turmas ativas SHALL sair da grade (RES-05, AD-014); reativar a modalidade SHALL restaurá-las na próxima leitura, sem recriar ocorrências.
- IF duas turmas ficam no mesmo dia e horário THEN o sistema SHALL não recusar (sem regra de sobreposição); as duas aparecem na grade, cada uma com sua composição.
- IF a sessão do admin expira no meio da `/turmas` THEN a próxima requisição SHALL redirecionar ao login (guard do layout, admin-base AUTH-01).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TURM-01 | P1: Entrada no shell e listagem | Design | Pending |
| TURM-02 | P1: Entrada no shell e listagem | Design | Pending |
| TURM-03 | P1: Gestão de modalidades | Design | Pending |
| TURM-04 | P1: Gestão de modalidades | Design | Pending |
| TURM-05 | P1: Gestão de modalidades | Design | Pending |
| TURM-06 | P1: Gestão de modalidades | Design | Pending |
| TURM-07 | P1: Gestão de modalidades | Design | Pending |
| TURM-08 | P1: Cadastro de turma | Design | Pending |
| TURM-09 | P1: Cadastro de turma | Design | Pending |
| TURM-10 | P1: Cadastro de turma | Design | Pending |
| TURM-11 | P1: Cadastro de turma | Design | Pending |
| TURM-12 | P1: Cadastro de turma | Design | Pending |
| TURM-13 | P1: Edição, desativação e reativação | Design | Pending |
| TURM-14 | P1: Edição, desativação e reativação | Design | Pending |
| TURM-15 | P1: Edição, desativação e reativação | Design | Pending |
| TURM-16 | P1: Edição, desativação e reativação | Design | Pending |
| TURM-17 | P1: Edição, desativação e reativação | Design | Pending |
| TURM-18 | P1: Edição, desativação e reativação | Design | Pending |

**Coverage:** 18 total, 18 mapeados a stories P1.

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 4.3 lista "Nome da modalidade" como campo do cadastro de turmas | Modalidade é registro próprio (CLASS_TYPES) com CRUD e status ATIVA/INATIVA, vinculado à turma | y - herdado do core-turmas-reservas (RES-05), schema em produção |
| PRD 4.3 lista "Status ativo/inativo" como campo do cadastro | Turma nasce ATIVA; status é editável depois (assinatura atual de `createSlotAction` não recebe status) | n - assumption registrada |
| PRD 4.3 "bloquear horários" | Bloqueio de turma em data específica NÃO entra nesta feature; fica como P2 do `admin-calendario` | y - AD-032, AD-044 |

---

## Sources

- `PRD.md.txt` — SRS Yogue-se V1.0: seção 4.3 (cadastro de turmas), 13.10
  (ciclo de vida por status, histórico preservado), 16 (FASE 1: cadastro de turmas)
- `.specs/STATE.md` — AD-008 (materialização sob demanda), AD-012 (código em
  inglês, UI em português), AD-013/AD-017 (edição de dia/horário cancela
  ocorrências futuras e gera crédito por fixo), AD-014 (inativas saem da grade),
  AD-015 (seed sem turmas), AD-032, AD-044 (split das duas features e ordem)
- `.specs/features/core-turmas-reservas/spec.md` — RES-01 a RES-05 (CRUD e
  validação de turma), RES-17 (guarda de capacidade), RES-27 (composição fonte única)
- `.specs/features/admin-base/spec.md` — AUTH-01 (guard do `(admin)`), shell de navegação
- Código: `src/modules/classes/services/classes.ts`, `src/modules/classes/actions.ts`,
  `src/modules/classes/domain/validators.ts` (validação de slot),
  `src/modules/bookings/services/sessions.ts` (AD-013/AD-017)
- `.specs/features/admin-turmas/context.md` — decisões do usuário desta rodada

---

## Success Criteria

- [ ] Admin cria modalidade e turma pela `/turmas` e a ocorrência aparece na `/grade` da próxima data, sem SQL manual
- [ ] Dados inválidos (fim ≤ início, dia fora de 1-7, capacidade < 1, modalidade inválida ou inativa) recusados no servidor com erro específico do campo
- [ ] Edição de dia/horário informa ocorrências canceladas e créditos gerados; desativação e reativação preservam todo o histórico (nenhum delete físico)
- [ ] Suite verde, build e lint limpos
