# Aluno Fixo: Remoção pela UI e Limite do Plano Specification

**Approved**: 2026-11-14 - user: "Aprovado"

## Problem Statement

Hoje não há como remover um aluno fixo de uma turma pela UI: o serviço
`endEnrollment` existe e é testado, mas nenhuma action o chama — a remoção
exige SQL direto. Além disso, a frequência do plano (`plans.weeklyFrequency`)
não limita os vínculos fixos: uma aluna com plano de 2x/semana pode estar fixa
em quantas turmas o admin vincular, pela grade ou pela conversão de
experimental.

## Goals

- [ ] O admin encerra um vínculo fixo pela tela de detalhe da aluna, sem SQL.
- [ ] Uma aluna com plano de N vezes por semana não consegue ficar fixa em
      mais de N turmas, por nenhum caminho (grade, conversão, edição de plano).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Remoção do vínculo pela grade (/grade) | A decisão foi concentrar a remoção no detalhe da aluna; a grade continua criando vínculo, não removendo. |
| Área do aluno: "Alterar meu horário fixo" (PRD 5.2) | Feature própria da área do aluno (ordem do AD-009 emendada pela AD-034); aqui só o admin mexe em vínculos. |
| Limite de reposições por semana (AD-024) | Já implementado; o limite deste feature é sobre vínculos fixos, não sobre reposições. |
| Migração forçada de vínculos existentes acima do limite | A regra vale para novas operações; nada é desvinculado retroativamente. |
| Cobrança/pagamento por plano | Fora do escopo do produto hoje. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| O plano da aluna limita mesmo quando está INATIVO | A checagem usa o plano atual da aluna, independente do status do plano | O plano dela é o referencial; a exigência de plano ATIVO já existe só na conversão (AD-037) e continua como está | n |
| Data de encerramento no passado é permitida, desde que ≥ startDate | Permite (corrige histórico); só recusa endDate < startDate | A composição é derivada (AD-008), nada precisa ser reescrito | n |
| Vínculos existentes acima do limite não são tocados | A regra vale para novas criações e edições; sem migração | Decisão do usuário nas perguntas de escopo | n |
| Contagem do limite | Vínculo ATIVO com endDate nula ou endDate > hoje conta 1; cada vínculo = 1 turma = 1 aula semanal (o slot tem um único dia/horário) | Deriva do schema de `classSlots` e de RES-23 | n |

**Open questions:** none - all resolved or logged above (required before the
spec is confirmed).

---

## User Stories

### P1: Encerrar vínculo fixo no detalhe da aluna ⭐ MVP

**User Story**: As a admin, I want encerrar o vínculo fixo de uma aluna pela
tela dela so that consigo tirar a aluna de uma turma sem acessar o banco.

**Why P1**: É o buraco de UI que motivou o feature: a remoção hoje só existe
por SQL.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHEN o admin envia o formulário de encerramento de um vínculo ATIVA da
   seção "Horários fixos ativos" em /alunos/[id], com a data de encerramento
   pré-preenchida com hoje THEN the system SHALL gravar `endDate` com a data
   informada e exibir feedback confirmando o encerramento com a data.
   <!-- event-driven, FIX-01 -->
2. WHEN um vínculo tem `endDate` = D THEN o vínculo SHALL deixar de contar na
   composição das ocorrências a partir de D (RES-23) e a vaga da turma SHALL
   se liberar sem ação adicional. <!-- event-driven, FIX-02 -->
3. IF a data de encerramento informada é anterior à `startDate` do vínculo
   THEN the system SHALL recusar a operação com erro claro e não alterar o
   vínculo. <!-- unwanted-behavior, FIX-03 -->
4. WHEN o encerramento é concluído THEN a tela SHALL recarregar a seção
   "Horários fixos ativos" sem o vínculo encerrado. <!-- event-driven, FIX-04 -->
5. IF o vínculo não está mais ATIVA (já encerrado por data ou status) THEN the
   system SHALL recusar um novo encerramento no servidor com erro claro.
   <!-- unwanted-behavior, FIX-05 -->

**Independent Test**: Encerrar um vínculo pela tela e conferir que ele sai da
lista, some da composição da próxima ocorrência da turma e libera a vaga.

---

### P1: Limite do plano nos vínculos fixos ⭐ MVP

**User Story**: As a studio owner, I want que a frequência do plano limite os
vínculos fixos so that uma aluna de 2x/semana não ocupe três turmas fixas.

**Why P1**: O usuário definiu que o limite é parte do plano ("isso devia ser
parte do plano").

**Acceptance Criteria**:

1. WHILE a aluna tem plano com `weeklyFrequency` N THEN the system SHALL
   permitir no máximo N vínculos fixos ativos para ela.
   <!-- state-driven, PLIM-01 -->
2. WHEN o admin tenta criar um vínculo fixo (painel da grade) para uma aluna
   que já tem N vínculos ativos THEN the system SHALL recusar com mensagem que
   nomeia o plano e a contagem atual (ex.: "Plano 2x/semana: a aluna já está
   fixa em 2 turmas."). <!-- event-driven, PLIM-02 -->
3. IF a aluna não tem plano THEN the system SHALL recusar o vínculo fixo com
   mensagem clara ("Aluna sem plano não pode ser fixa.") e não gravar vínculo.
   <!-- unwanted-behavior, PLIM-03 -->
4. WHERE a conversão de experimental em aluna (AD-037) WHEN os horários fixos
   escolhidos excedem a `weeklyFrequency` do plano escolhido THEN the system
   SHALL recusar a conversão nomeando o limite, sem criar aluna nem vínculos.
   <!-- optional-feature, PLIM-04 -->

**Independent Test**: Com uma aluna de plano 2x fixa em duas turmas, tentar
vincular a terceira pela grade e ver a recusa com a contagem; sem plano, ver a
recusa específica.

---

### P2: Guardas na mudança de plano da aluna

**User Story**: As a admin, I want que a troca de plano respeite os vínculos
existentes so that a invariante do limite sobrevive à edição do cadastro.

**Why P2**: Fecha o último caminho que quebraria a invariante; sem ele, o
limite vale só para vínculos novos.

**Acceptance Criteria**:

1. WHEN o admin edita a aluna para um plano com `weeklyFrequency` menor que o
   número de vínculos fixos ativos dela THEN the system SHALL recusar a
   edição com erro que nomeia a contagem e o limite.
   <!-- event-driven, PLIM-05 -->
2. WHEN o admin edita a aluna removendo o plano (planId nulo) e ela tem
   vínculos fixos ativos THEN the system SHALL recusar a edição com erro
   claro. <!-- event-driven, PLIM-06 -->
3. WHEN a aluna não tem vínculos fixos ativos THEN a edição do plano (trocar,
   baixar a frequência ou limpar) SHALL ser aceita normalmente.
   <!-- event-driven, PLIM-07 -->

**Independent Test**: Aluna com 3 vínculos ativos: trocar para plano 2x
recusa; limpar o plano recusa; encerrar os vínculos e repetir as duas
edições passa.

---

### P3: Encerrado no próprio dia deixa de ser ativo no perfil

**User Story**: As a admin, I want que "Horários fixos ativos" use a mesma
definição de ativo da composição so that a lista do detalhe nunca mostra
como ativo um vínculo que já não ocupa vaga.

**Why P3**: Achado de walk: o perfil listava vínculo com `endDate = hoje`
como ativo, mas a composição já não conta esse vínculo no dia (RES-23:
deixa de contar a partir da data encerrada). As duas leituras divergiam.

**Acceptance Criteria**:

1. WHEN um vínculo fixo tem `endDate` igual a hoje THEN the system SHALL
   deixá-lo de fora da lista "Horários fixos ativos" do perfil (ele deixa
   de contar a partir do próprio dia, RES-23).
   <!-- state-driven, FIX-06 -->
2. WHEN um vínculo fixo tem `endDate` futura THEN the system SHALL mantê-lo
   na lista "Horários fixos ativos" até a data chegar.
   <!-- state-driven, FIX-07 -->

**Independent Test**: Aluna com dois vínculos de startDate hoje: encerrar
um hoje e outro amanhã; o perfil lista só o de endDate amanhã.

---

## Edge Cases

- IF o vínculo informado não existe THEN the system SHALL recusar o
  encerramento com erro claro. (FIX-05)
- WHEN a data de encerramento é igual à data de início THEN the system SHALL
  aceitar e o vínculo deixa de contar a partir do próprio dia de início.
  (FIX-01/FIX-02, borda de endDate ≤ data)
- WHEN a aluna tem plano e zero vínculos THEN a criação de vínculo SHALL ser
  aceita normalmente (a recusa do PLIM-02 só existe na borda N/N). (L-015:
  as duas branches provadas)
- IF a aluna informada no vínculo não existe THEN the system SHALL recusar com
  erro claro, antes da checagem de plano.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FIX-01 | P1: Encerrar vínculo | Design | Pending |
| FIX-02 | P1: Encerrar vínculo | Design | Pending |
| FIX-03 | P1: Encerrar vínculo | Design | Pending |
| FIX-04 | P1: Encerrar vínculo | Design | Pending |
| FIX-05 | P1: Encerrar vínculo | Design | Pending |
| PLIM-01 | P1: Limite do plano | Design | Pending |
| PLIM-02 | P1: Limite do plano | Design | Pending |
| PLIM-03 | P1: Limite do plano | Design | Pending |
| PLIM-04 | P1: Limite do plano | Design | Pending |
| PLIM-05 | P2: Guardas de plano | - | Pending |

| PLIM-06 | P2: Guardas de plano | - | Pending |
| PLIM-07 | P2: Guardas de plano | - | Pending |
| FIX-06 | P3: Encerrado no dia | - | Pending |
| FIX-07 | P3: Encerrado no dia | - | Pending |

**Coverage:** 12 total, 0 mapped to tasks, 12 unmapped ⚠️

---

## Differences from the source

Nenhum source visual binda este feature - a decisão de interface veio das
perguntas do Specify (context.md). Sem capturas.

## Sources

- Pedido do usuário (chat, 2026-11-14): "não tem como remover um aluno fixo
  de uma turma pela ui" e "não tem uma forma de limitar o número de aulas que
  um aluno fixo consegue fazer na semana, isso devia ser parte do plano".
- `.specs/STATE.md` AD-008 (composição derivada), AD-037 (conversão cria
  vínculos fixos), AD-012 (identifiers em inglês).
- Código: `src/modules/students/services/enrollments.ts` (endEnrollment sem
  caller), `src/modules/plans/services/plans.ts` (weeklyFrequency),
  `src/app/(admin)/alunos/[id]/page.tsx` (seção de horários fixos),
  `src/app/(admin)/grade/booking-forms.tsx` (criação de vínculo).

---

## Success Criteria

- [ ] O admin encerra um vínculo fixo pela tela do detalhe da aluna em menos
      de um minuto, sem SQL.
- [ ] Nenhum caminho do produto (grade, conversão, edição de plano) deixa uma
      aluna com plano de N vezes com mais de N vínculos fixos ativos.
- [ ] A suite existente (unit + integration) continua verde com os testes
      novos das regras FIX e PLIM.
