# Admin Turmas Context

**Gathered:** 2026-11-14
**Spec:** `.specs/features/admin-turmas/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Interface administrativa para o CRUD de modalidades e turmas (PRD 4.3) que já
existe como services/actions (`src/modules/classes/services/classes.ts`,
`src/modules/classes/actions.ts`) mas não tem UI. A feature entrega a rota
`/turmas` no shell do `(admin)`: cadastrar modalidade, cadastrar turma com
modalidade, dia da semana, horário inicial/final, capacidade (default 8) e
status, editar, desativar e reativar — reutilizando os services existentes,
com validação no servidor e feedback claro, sem apagar registros fisicamente.

---

## Implementation Decisions

### Escopo: uma feature ou duas

- User escolheu "Duas features (Recommended)" — a candidata
  `admin-turmas-calendario` foi dividida: esta feature (média: só UI sobre
  services prontos) e `admin-calendario` (grande: PRD 4.2). Cada uma com ciclo
  próprio de aprovação/verificação. Registrada como AD-044.
- User escolheu "Turmas antes (Recommended)" — esta feature é implementada
  antes do calendário.

### Local da interface

- User escolheu "Evoluir /grade + nova /turmas (Recommended)" — o calendário
  evolui a `/grade` (feature `admin-calendario`); a gestão de turmas ganha a
  rota nova `/turmas` no shell (Grade, Alunos, Planos, Créditos, Feriados,
  Experimentais + Turmas).

### Visual / navegação do calendário

- Decisões de navegação (abas + setas + seletor de data; ocorrência cancelada
  visível com selo) pertencem ao `admin-calendario` — registradas no
  context.md daquela feature. Aqui só vale o padrão visual existente
  (AD-041/AD-042): skin da guia nos formulários e listas.

### Bloqueio específico (PRD 4.3, AD-032)

- User escolheu "P2 do admin-calendario (Recommended)" — o bloqueio de uma
  turma em uma data específica NÃO entra nesta feature; fica como P2 do
  `admin-calendario`. Aqui o equivalente continua sendo desativar a turma
  (estado atual).

---

## Agent's Discretion

- Layout da tela `/turmas` (listas, formulários, ordem), dentro do skin da
  marca e do padrão das demais telas admin.
- Feedback visual da edição de dia/horário (quantas ocorrências canceladas,
  quantos créditos gerados) — a regra é do serviço (AD-013/AD-017); a
  apresentação é da tela.

---

## Declined / Undiscussed Gray Areas → Assumptions

- Nenhuma recusada — as decisões de escopo e interface foram respondidas no
  turno. Os defaults não perguntados (turmas sobrepostas permitidas, turma nasce
  ATIVA, modalidade inativa com turmas ativas sai da grade) estão na tabela
  Assumptions do spec.md.

---

## Specific References

- User aceitou as recomendações na integra (opções marcadas "Recommended" nas
  duas rodadas de perguntas do Specify).
- PRD 4.3 ("O administrador poderá criar, editar, bloquear ou desativar
  horários"), PRD 16 FASE 1.
- AD-008 (ocorrências sob demanda), AD-013/AD-017 (edição de dia/horário
  cancela ocorrências futuras e gera crédito por fixo), AD-012 (código em
  inglês, UI em português), AD-032 (bloqueio por horário fica para o painel).

---

## Deferred Ideas

- Calendário administrativo diária/semanal/mensal com navegação livre —
  feature `admin-calendario`, na sequência.
- Bloqueio de uma turma em uma data específica (PRD 4.3) — P2 do
  `admin-calendario` (AD-032, AD-044).
- Dashboard com indicadores (PRD 4.1) — fora, já adiado pela admin-base.
