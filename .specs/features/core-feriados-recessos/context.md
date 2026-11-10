# Core Feriados e Recessos Context

**Gathered:** 2026-11-10
**Spec:** `.specs/features/core-feriados-recessos/spec.md`
**Status:** Ready for design (design inline no spec, a aprovar)

---

## Feature Boundary

3ª feature da ordem do AD-009: cadastrar e listar feriados e recessos no admin
(tela nova, hoje só existem `/grade` e `/creditos`), o bloqueio das ocorrências
das datas correspondentes (PRD 7.1/7.2), a regra de não gerar crédito
(PRD 15 "Feriado | Não gera crédito"), o efeito do bloqueio sobre reservas já
existentes e o caminho de desbloqueio. A base já existe: tabelas `holidays` e
`studio_closures`, `createHoliday`/`createStudioClosure`, `hasBlock` na
materialização, recusa de reserva em ocorrência BLOQUEADA, agenda pública
omitindo bloqueadas (AD-014) e grade admin exibindo BLOQUEADA.

---

## Implementation Decisions

### Reserva já feita quando o bloqueio é cadastrado

- **Cancelar e devolver crédito** (escolha do usuário, recomendação aceita): as
  reservas ativas das ocorrências bloqueadas (reposição/experimental) ficam
  CANCELADA, a vaga volta, e o crédito RESERVADO da reposição volta a
  DISPONIVEL mantendo o vencimento original. Nenhum crédito novo é criado
  (PRD 7.1 preservado; precedente AD-020).
- Motivo técnico registrado: a liquidação do crédito (AD-018) vira UTILIZADO
  quando o fim da ocorrência passa sem olhar o status da ocorrência — deixar a
  reserva ativa numa ocorrência bloqueada consumiria o crédito do aluno por uma
  aula que não vai acontecer.

### Desbloqueio

- **Volta sozinha para AGENDADA** (escolha do usuário): ao remover/editar o
  feriado/recesso, as ocorrências BLOQUEADA não mais cobertas por nenhum
  bloqueio voltam a AGENDADA (só de hoje em diante; CANCELADA não ressuscita).
  As reservas canceladas no bloqueio NÃO são restauradas — o aluno remarca com
  o crédito que tem de volta.

### Sobreposição de bloqueios

- **Permitido, sem unificar** (escolha do usuário): bloquear é idempotente; a
  data fica bloqueada enquanto QUALQUER bloqueio (feriado ou recesso) a cobrir
  e só volta quando nenhum cobre mais.

### Data passada

- **Permitir, efeito só para frente** (escolha do usuário): feriado/recesso
  pode ser cadastrado em data passada como registro histórico; o reconcile só
  altera ocorrências de hoje em diante, sem reescrever o passado da grade.

### Seed de feriados nacionais

- **Cadastrados à mão, sem seed** (escolha do usuário): PRD 7.1 dá o cadastro
  ao admin; seed de datas específicas de um ano fica desatualizado.

### Cancelamento pelo estúdio em ocorrência bloqueada

- **Recusar** (escolha do usuário): erro claro; o bloqueio já comunica que a
  aula não acontece, e cancelar de novo dispararia créditos de estúdio
  (PRD 7.3), que o feriado veda (PRD 7.1).

### Bloqueio de horário específico (PRD 4.3)

- **Fora desta feature, vai para o painel admin** (escolha do usuário): esta
  fatia é sobre datas. Bloqueio temporário por turma exige modelar janela por
  `class_slot` e cabe no painel admin (ordem do AD-009).

---

## Agent's Discretion

Nada delegado explicitamente; os defaults rotulados `n` na tabela de
assumptions do spec (rota `/feriados`, remoção física sem coluna `status`,
`cancelled_by = ESTUDIO`, reconcile por janela, sem notificação ao aluno)
ficam sujeitos à correção do usuário na aprovação do spec.

## Declined / Undiscussed Gray Areas → Assumptions

Nenhum recusado — todas as 7 áreas cinzas foram respondidas (acima). Os
defaults operacionais sem decisão de produto estão na tabela de Assumptions do
spec.

---

## Specific References

- PRD 7.1: "O administrador poderá cadastrar feriados nacionais e bloquear as
  turmas correspondentes. Não gerar créditos para alunos fixos."
- PRD 7.2: "Permitir cadastrar períodos de recesso. Não gerar créditos."
- PRD 15: "Feriado | Não gera crédito" (critério de aceitação a virar teste).
- PRD 6.4: "Não permitir agendamento em horário bloqueado" (já implementado,
  verificado nesta feature pelo caminho pós-bloqueio).

---

## Deferred Ideas

- Bloqueio temporário de horário por turma (PRD 4.3) → painel admin (AD-009).
- Notificação ao aluno sobre a reserva cancelada pelo bloqueio → feature de
  notificações.
- Calendário administrativo (PRD 4.2) e dashboard (PRD 4.1) → painel admin.
