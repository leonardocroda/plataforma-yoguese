# Core Créditos e Cancelamentos - Context

**Gathered:** 2026-11-07
**Spec:** `.specs/features/core-creditos-cancelamentos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Módulo de créditos do PRD (seção 6) e seus efeitos no cancelamento de
aulas (seção 7.3): crédito de reposição como entidade persistida, regra
de 24h calculada no servidor, agendamento de reposição com crédito
reservado, devolução/cancelamento de crédito, cancelamento de aula pelo
estúdio (com crédito automático) e a consequência da edição de dia/horário
decidida em AD-013.

Entrega: regras no servidor + UI mínima do admin (tela de créditos do
aluno e ações de cancelamento na grade `/grade`). Os botões do aluno
(avisar não comparecimento, agendar reposição, meus créditos) ficam para
a feature da área do aluno — mas os serviços que eles vão consumir são
construídos e testados aqui.

---

## Implementation Decisions

### Escopo da UI (confirmado)

- Usuário: a feature entrega o domínio + UI mínima do admin (tela de
  créditos do aluno com conceder/devolver/cancelar/histórico e o
  cancelamento de aula na grade). Botões do aluno ficam para a feature da
  área do aluno → **AD-016**.
- Consequência: o aviso de não comparecimento é registrado **pelo admin em
  nome do aluno**, com a regra de 24h calculada no servidor no momento do
  registro → **AD-023**.

### Crédito por ocorrência cancelada (AD-013 → AD-017)

- AD-013 deixou escrito: "na feature de créditos isso vira crédito
  automático".
- Decisão do usuário: **1 crédito por ocorrência futura cancelada, por
  aluno fixo afetado**. Exemplo trabalhado com o usuário: 8 ocorrências x
  4 fixos = 32 créditos. Origem `CANCELAMENTO_ESTUDIO`.

### Uso do crédito (AD-018)

- Decisão do usuário: o crédito da reposição vira `UTILIZADO` quando passa
  o horário de término da ocorrência, sem etapa manual de presença.
- Raciocinho do usuário: "se o aluno não avisar com até 24h ele perde o
  crédito, por isso acredito que automático pelo horário é melhor".

### Agendamento manual pelo admin (AD-019)

- AD-010 hadiou a validação de crédito para esta feature.
- Decisão do usuário: agendamento manual de reposição pelo admin **exige
  crédito válido** e o **limite de 2/semana vale só para o autoatendimento**
  (mesma latitude do AD-011).

### Devoluções (AD-020, AD-021)

- Cancelamento pelo estúdio de uma ocorrência com reposição reservada →
  o crédito volta a `DISPONIVEL` com o **vencimento original**.
- "Devolver crédito" (admin) → `DISPONIVEL`, vencimento original, a
  partir de `RESERVADO`, `UTILIZADO` ou `CANCELADO`.

### Histórico (AD-022)

- Sem tabela nova: `FALTA` e `CANCELADA` são status da reserva
  (`BOOKINGS.status`). O registro pontual do fixo numa ocorrência é uma
  linha `BOOKING` do tipo `FIXED` — exatamente o que o AD-008 antecipou.

### Limite semanal (AD-024)

- A semana de contabilização é a **semana da data da aula** (segunda a
  domingo, America/Sao_Paulo) da ocorrência da reposição, não a semana do
  pedido.

### Crédito do estúdio e duplicidade (AD-025)

- Cancelamento pelo estúdio credita **todo aluno fixo afetado**, inclusive
  quem já avisou falta com menos de 24h (ainda sem crédito).
- Quem **já tem crédito daquela ocorrência** não recebe um segundo.

### Agent's Discretion

- Organização interna das telas mínimas de admin (layout fica para o
  design system; não há referência visual binding nesta feature).
- Forma do módulo novo (`src/modules/credits/`), nomes de funções e
  divisão entre `domain/` e `services/` (AD-004, AD-012).
- Detalhes de migration além da integridade expressa no spec.

### Declined / Undiscussed Gray Areas → Assumptions

- Nenhum recusado. Defaults não perguntados (janela de 7 dias para
  "créditos próximos do vencimento", rótulo do responsável pela alteração
  manual sem auth, valores de enumeração em português maiúsculo) ficam
  registrados na tabela "Assumptions & Open Questions" do spec para
  correção no review.

---

## Specific References

- PRD 6.1: cancelamento de aula fixa pelo aluno, 24h, crédito automático.
- PRD 6.2: estrutura do crédito (origem, datas, status, agendamento
  associado).
- PRD 6.3: validade de 30 dias, bloqueio após vencimento, rotina de
  atualização.
- PRD 6.4: agendamento de reposição, crédito válido, máximo de 2 por
  semana (seg–dom), qualquer modalidade, só turmas com vagas.
- PRD 6.5: cancelamento de reposição — com 24h devolve, sem 24h perde,
  nunca gera crédito novo.
- PRD 6.6: administração de créditos (conceder/devolver/cancelar, motivo,
  responsável, histórico).
- PRD 7.3: cancelamento de aula pelo estúdio — cancela reservas, libera
  capacidade, crédito automático por aluno fixo afetado, sem duplicidade.
- PRD 12: entidades `CREDITS` e `CREDIT_TRANSACTIONS`.
- PRD 13.9: prevenção de créditos duplicados.
- PRD 15: casos de aceite do módulo de créditos.

---

## Deferred Ideas

- Botões da área do aluno (avisar não comparecimento, agendar reposição,
  meus créditos) e tela "Meus créditos" do aluno — feature da área do
  aluno (AD-016).
- Alteração de horário fixo pelo aluno (PRD 5.2) — feature da área do
  aluno.
- Fluxo de aprovação de experimentais (PRD módulo 8) — feature própria.
- Autenticação e perfis (`USERS` do PRD 12) — feature própria; o
  responsável pela alteração manual fica registrado por rótulo até lá.
- Dashboard com indicadores de créditos (PRD 4.1) — feature do painel.
- Notificações, e-mail/WhatsApp, pagamentos, relatórios, Pato Yoga Club —
  fases 3/4 do PRD.
