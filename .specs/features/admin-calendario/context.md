# Admin Calendario Context

**Gathered:** 2026-11-14
**Spec:** `.specs/features/admin-calendario/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Calendário administrativo do PRD 4.2 evoluindo a `/grade`: visualizações
diária, semanal e mensal, navegação livre no tempo (setas + seletor de data,
D+14 alcançável), ocorrência com horário, modalidade, fixos, reposições,
experimentais e vagas, lista de participantes com vínculo e abertura do
cadastro do aluno, e cancelamento pelo estúdio de qualquer ocorrência futura
reutilizando `cancelOccurrenceByStudio`. P2: bloqueio de uma turma em uma data
específica (PRD 4.3, AD-032), distinguindo cancelar × bloquear × desativar.

---

## Implementation Decisions

### Escopo: uma feature ou duas

- User escolheu "Duas features (Recommended)" — a gestão de turmas (PRD 4.3)
  virou a feature `admin-turmas`, implementada antes; o calendário (PRD 4.2)
  é esta feature. Registrado como AD-044.

### Local da interface

- User escolheu "Evoluir /grade + nova /turmas (Recommended)" — o calendário
  evolui a `/grade`, que já tem composição derivada, lista de participantes,
  formulários de reserva, cancelamento e o skin da marca (AD-041/AD-042).
  Nenhuma rota `/calendario` nova; a `/grade` não é aposentada.

### Navegação do calendário

- User escolheu "Abas + setas + seletor de data (Recommended)" — abas
  Diária/Semanal/Mensal (default semanal, mantendo a composição do guia),
  setas de avançar/voltar e seletor de data para pular direto a D+14 ou
  qualquer dia. Cobre o PRD 4.2 completo.
- User escolheu "Visível com selo em todas as vistas (Recommended)" — a
  ocorrência CANCELADA aparece com selo de cancelada na diária, semanal e
  mensal, junto das BLOQUEADAS que a grade admin já mostra (AD-014). O
  estúdio mantém o histórico à vista. Ocorrência passada nunca materializada
  continua sem composição e não aparece (AD-008).

### Cancelamento pelo estúdio no passado

- User escolheu "Só hoje/futuro (Recommended)" — `cancelOccurrenceByStudio`
  ganha guarda recusando ocorrência de data passada com erro claro, sem
  alterar estado. Registrado como AD-045. Coerente com o espírito da AD-029
  (nunca reescrever o passado da grade) e evita reescrever créditos passados.
  Navegação ao passado fica read-only.

### Bloqueio específico (PRD 4.3, AD-032)

- User escolheu "P2 do admin-calendario (Recommended)" — o bloqueio de uma
  turma em uma data específica entra como P2 desta feature, não é P1 nem fica
  adiado de novo. A distinção fica explícita na spec: CANCELAR uma ocorrência
  (estado CANCELADA + créditos de estúdio, PRD 7.3), BLOQUEAR uma ocorrência
  (não acontece, sem crédito, reversível — AD-026/AD-027/AD-031) e DESATIVAR
  a turma recorrente (fim para frente, histórico preservado). Exige mudança
  de modelo justificada no design.

---

## Agent's Discretion

- Mecânica das abas/setas/seletor e do painel de ocorrência nas três
  visualizações, dentro do skin da marca; a composição do guia vale para a
  semanal (AD-042) e as vistas diária/mensal a estendem.
- Como o bloqueio de turma/data é modelado (tabela própria vs. extensão dos
  bloqueios existentes) — decisão de design, com a mudança de modelo
  justificada no design.md.

---

## Declined / Undiscussed Gray Areas → Assumptions

- Nenhuma recusada — as quatro áreas cinzas foram respondidas no turno.
  Defaults não perguntados (definição de semana/mês do calendário, leitura ao
  passado read-only, mês materializa o que renderiza, formulários de reserva
  intocados) estão na tabela Assumptions do spec.md.

---

## Specific References

- User aceitou as recomendações na integra (opções marcadas "Recommended" nas
  duas rodadas de perguntas do Specify).
- PRD 4.2 (calendário com três visualizações e a lista de participantes com
  tipo de vínculo), PRD 4.3 (bloquear horários), PRD 7.3 (cancelamento pelo
  estúdio), PRD 16 FASE 1.
- `.specs/features/redesign-marca/captures/yogue-se-brand.html` — binding —
  composição "Admin: calendário e turma" (AD-042): a vista semanal mantém essa
  composição com dados reais da `/grade`.
- AD-008 (materialização sob demanda), AD-014 (grade admin mostra BLOQUEADA),
  AD-016 (cancelamento pelo estúdio já na `/grade`), AD-020/AD-025/AD-031
  (regras do cancelamento), AD-026 a AD-028 (consequências do bloqueio).

---

## Deferred Ideas

- Gestão de turmas (PRD 4.3) — feature `admin-turmas`, antes desta.
- Dashboard com indicadores (PRD 4.1) — fora, já adiado pela admin-base.
- Área do aluno (PRD módulos 12 e 13) — ordem da AD-009 emendada pela AD-034.
- Notificações/push, deploy, banco de produção — fora desta feature sempre.
