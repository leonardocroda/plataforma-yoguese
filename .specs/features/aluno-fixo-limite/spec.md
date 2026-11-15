# Aluno Fixo: RemoÃ§Ã£o pela UI e Limite do Plano Specification

**Approved**: 2026-11-14 - user: "Aprovado"

## Problem Statement

Hoje nÃ£o hÃ¡ como remover um aluno fixo de uma turma pela UI: o serviÃ§o
`endEnrollment` existe e Ã© testado, mas nenhuma action o chama â€” a remoÃ§Ã£o
exige SQL direto. AlÃ©m disso, a frequÃªncia do plano (`plans.weeklyFrequency`)
nÃ£o limita os vÃ­nculos fixos: uma aluna com plano de 2x/semana pode estar fixa
em quantas turmas o admin vincular, pela grade ou pela conversÃ£o de
experimental.

## Goals

- [ ] O admin encerra um vÃ­nculo fixo pela tela de detalhe da aluna, sem SQL.
- [ ] Uma aluna com plano de N vezes por semana nÃ£o consegue ficar fixa em
      mais de N turmas, por nenhum caminho (grade, conversÃ£o, ediÃ§Ã£o de plano).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| RemoÃ§Ã£o do vÃ­nculo pela grade (/grade) | A decisÃ£o foi concentrar a remoÃ§Ã£o no detalhe da aluna; a grade continua criando vÃ­nculo, nÃ£o removendo. |
| Ãrea do aluno: "Alterar meu horÃ¡rio fixo" (PRD 5.2) | Feature prÃ³pria da Ã¡rea do aluno (ordem do AD-009 emendada pela AD-034); aqui sÃ³ o admin mexe em vÃ­nculos. |
| Limite de reposiÃ§Ãµes por semana (AD-024) | JÃ¡ implementado; o limite deste feature Ã© sobre vÃ­nculos fixos, nÃ£o sobre reposiÃ§Ãµes. |
| MigraÃ§Ã£o forÃ§ada de vÃ­nculos existentes acima do limite | A regra vale para novas operaÃ§Ãµes; nada Ã© desvinculado retroativamente. |
| CobranÃ§a/pagamento por plano | Fora do escopo do produto hoje. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| O plano da aluna limita mesmo quando estÃ¡ INATIVO | A checagem usa o plano atual da aluna, independente do status do plano | O plano dela Ã© o referencial; a exigÃªncia de plano ATIVO jÃ¡ existe sÃ³ na conversÃ£o (AD-037) e continua como estÃ¡ | n |
| Data de encerramento no passado Ã© permitida, desde que â‰¥ startDate | Permite (corrige histÃ³rico); sÃ³ recusa endDate < startDate | A composiÃ§Ã£o Ã© derivada (AD-008), nada precisa ser reescrito | n |
| VÃ­nculos existentes acima do limite nÃ£o sÃ£o tocados | A regra vale para novas criaÃ§Ãµes e ediÃ§Ãµes; sem migraÃ§Ã£o | DecisÃ£o do usuÃ¡rio nas perguntas de escopo | n |
| Contagem do limite | VÃ­nculo ATIVO com endDate nula ou endDate > hoje conta 1; cada vÃ­nculo = 1 turma = 1 aula semanal (o slot tem um Ãºnico dia/horÃ¡rio) | Deriva do schema de `classSlots` e de RES-23 | n |

**Open questions:** none - all resolved or logged above (required before the
spec is confirmed).

---

## User Stories

### P1: Encerrar vÃ­nculo fixo no detalhe da aluna â­ MVP

**User Story**: As a admin, I want encerrar o vÃ­nculo fixo de uma aluna pela
tela dela so that consigo tirar a aluna de uma turma sem acessar o banco.

**Why P1**: Ã‰ o buraco de UI que motivou o feature: a remoÃ§Ã£o hoje sÃ³ existe
por SQL.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHEN o admin envia o formulÃ¡rio de encerramento de um vÃ­nculo ATIVA da
   seÃ§Ã£o "HorÃ¡rios fixos ativos" em /alunos/[id], com a data de encerramento
   prÃ©-preenchida com hoje THEN the system SHALL gravar `endDate` com a data
   informada e exibir feedback confirmando o encerramento com a data.
   <!-- event-driven, FIX-01 -->
2. WHEN um vÃ­nculo tem `endDate` = D THEN o vÃ­nculo SHALL deixar de contar na
   composiÃ§Ã£o das ocorrÃªncias a partir de D (RES-23) e a vaga da turma SHALL
   se liberar sem aÃ§Ã£o adicional. <!-- event-driven, FIX-02 -->
3. IF a data de encerramento informada Ã© anterior Ã  `startDate` do vÃ­nculo
   THEN the system SHALL recusar a operaÃ§Ã£o com erro claro e nÃ£o alterar o
   vÃ­nculo. <!-- unwanted-behavior, FIX-03 -->
4. WHEN o encerramento Ã© concluÃ­do THEN a tela SHALL recarregar a seÃ§Ã£o
   "HorÃ¡rios fixos ativos" sem o vÃ­nculo encerrado. <!-- event-driven, FIX-04 -->
5. IF o vÃ­nculo nÃ£o estÃ¡ mais ATIVA (jÃ¡ encerrado por data ou status) THEN the
   system SHALL recusar um novo encerramento no servidor com erro claro.
   <!-- unwanted-behavior, FIX-05 -->

**Independent Test**: Encerrar um vÃ­nculo pela tela e conferir que ele sai da
lista, some da composiÃ§Ã£o da prÃ³xima ocorrÃªncia da turma e libera a vaga.

---

### P1: Limite do plano nos vÃ­nculos fixos â­ MVP

**User Story**: As a studio owner, I want que a frequÃªncia do plano limite os
vÃ­nculos fixos so that uma aluna de 2x/semana nÃ£o ocupe trÃªs turmas fixas.

**Why P1**: O usuÃ¡rio definiu que o limite Ã© parte do plano ("isso devia ser
parte do plano").

**Acceptance Criteria**:

1. WHILE a aluna tem plano com `weeklyFrequency` N THEN the system SHALL
   permitir no mÃ¡ximo N vÃ­nculos fixos ativos para ela.
   <!-- state-driven, PLIM-01 -->
2. WHEN o admin tenta criar um vÃ­nculo fixo (painel da grade) para uma aluna
   que jÃ¡ tem N vÃ­nculos ativos THEN the system SHALL recusar com mensagem que
   nomeia o plano e a contagem atual (ex.: "Plano 2x/semana: a aluna jÃ¡ estÃ¡
   fixa em 2 turmas."). <!-- event-driven, PLIM-02 -->
3. IF a aluna nÃ£o tem plano THEN the system SHALL recusar o vÃ­nculo fixo com
   mensagem clara ("Aluna sem plano nÃ£o pode ser fixa.") e nÃ£o gravar vÃ­nculo.
   <!-- unwanted-behavior, PLIM-03 -->
4. WHERE a conversÃ£o de experimental em aluna (AD-037) WHEN os horÃ¡rios fixos
   escolhidos excedem a `weeklyFrequency` do plano escolhido THEN the system
   SHALL recusar a conversÃ£o nomeando o limite, sem criar aluna nem vÃ­nculos.
   <!-- optional-feature, PLIM-04 -->

**Independent Test**: Com uma aluna de plano 2x fixa em duas turmas, tentar
vincular a terceira pela grade e ver a recusa com a contagem; sem plano, ver a
recusa especÃ­fica.

---

### P2: Guardas na mudanÃ§a de plano da aluna

**User Story**: As a admin, I want que a troca de plano respeite os vÃ­nculos
existentes so that a invariante do limite sobrevive Ã  ediÃ§Ã£o do cadastro.

**Why P2**: Fecha o Ãºltimo caminho que quebraria a invariante; sem ele, o
limite vale sÃ³ para vÃ­nculos novos.

**Acceptance Criteria**:

1. WHEN o admin edita a aluna para um plano com `weeklyFrequency` menor que o
   nÃºmero de vÃ­nculos fixos ativos dela THEN the system SHALL recusar a
   ediÃ§Ã£o com erro que nomeia a contagem e o limite.
   <!-- event-driven, PLIM-05 -->
2. WHEN o admin edita a aluna removendo o plano (planId nulo) e ela tem
   vÃ­nculos fixos ativos THEN the system SHALL recusar a ediÃ§Ã£o com erro
   claro. <!-- event-driven, PLIM-06 -->
3. WHEN a aluna nÃ£o tem vÃ­nculos fixos ativos THEN a ediÃ§Ã£o do plano (trocar,
   baixar a frequÃªncia ou limpar) SHALL ser aceita normalmente.
   <!-- event-driven, PLIM-07 -->

**Independent Test**: Aluna com 3 vÃ­nculos ativos: trocar para plano 2x
recusa; limpar o plano recusa; encerrar os vÃ­nculos e repetir as duas
ediÃ§Ãµes passa.

---

### P3: Encerrado no prÃ³prio dia deixa de ser ativo no perfil

**User Story**: As a admin, I want que "HorÃ¡rios fixos ativos" use a mesma
definiÃ§Ã£o de ativo da composiÃ§Ã£o so that a lista do detalhe nunca mostra
como ativo um vÃ­nculo que jÃ¡ nÃ£o ocupa vaga.

**Why P3**: Achado de walk: o perfil listava vÃ­nculo com `endDate = hoje`
como ativo, mas a composiÃ§Ã£o jÃ¡ nÃ£o conta esse vÃ­nculo no dia (RES-23:
deixa de contar a partir da data encerrada). As duas leituras divergiam.

**Acceptance Criteria**:

1. WHEN um vÃ­nculo fixo tem `endDate` igual a hoje THEN the system SHALL
   deixÃ¡-lo de fora da lista "HorÃ¡rios fixos ativos" do perfil (ele deixa
   de contar a partir do prÃ³prio dia, RES-23).
   <!-- state-driven, FIX-06 -->
2. WHEN um vÃ­nculo fixo tem `endDate` futura THEN the system SHALL mantÃª-lo
   na lista "HorÃ¡rios fixos ativos" atÃ© a data chegar.
   <!-- state-driven, FIX-07 -->

**Independent Test**: Aluna com dois vÃ­nculos de startDate hoje: encerrar
um hoje e outro amanhÃ£; o perfil lista sÃ³ o de endDate amanhÃ£.

---

## Edge Cases

- IF o vÃ­nculo informado nÃ£o existe THEN the system SHALL recusar o
  encerramento com erro claro. (FIX-05)
- WHEN a data de encerramento Ã© igual Ã  data de inÃ­cio THEN the system SHALL
  aceitar e o vÃ­nculo deixa de contar a partir do prÃ³prio dia de inÃ­cio.
  (FIX-01/FIX-02, borda de endDate â‰¤ data)
- WHEN a aluna tem plano e zero vÃ­nculos THEN a criaÃ§Ã£o de vÃ­nculo SHALL ser
  aceita normalmente (a recusa do PLIM-02 sÃ³ existe na borda N/N). (L-015:
  as duas branches provadas)
- IF a aluna informada no vÃ­nculo nÃ£o existe THEN the system SHALL recusar com
  erro claro, antes da checagem de plano.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FIX-01 | P1: Encerrar vÃ­nculo | Design | Verified |
| FIX-02 | P1: Encerrar vÃ­nculo | Design | Verified |
| FIX-03 | P1: Encerrar vÃ­nculo | Design | Verified |
| FIX-04 | P1: Encerrar vÃ­nculo | Design | Verified |
| FIX-05 | P1: Encerrar vÃ­nculo | Design | Verified |
| PLIM-01 | P1: Limite do plano | Design | Verified |
| PLIM-02 | P1: Limite do plano | Design | Verified |
| PLIM-03 | P1: Limite do plano | Design | Verified |
| PLIM-04 | P1: Limite do plano | Design | Verified |
| PLIM-05 | P2: Guardas de plano | - | Verified |

| PLIM-06 | P2: Guardas de plano | - | Verified |
| PLIM-07 | P2: Guardas de plano | - | Verified |
| FIX-06 | P3: Encerrado no dia | - | Verified |
| FIX-07 | P3: Encerrado no dia | - | Verified |

**Coverage:** 12 total, 0 mapped to tasks, 12 unmapped âš ï¸

---

## Differences from the source

Nenhum source visual binda este feature - a decisÃ£o de interface veio das
perguntas do Specify (context.md). Sem capturas.

## Sources

- Pedido do usuÃ¡rio (chat, 2026-11-14): "nÃ£o tem como remover um aluno fixo
  de uma turma pela ui" e "nÃ£o tem uma forma de limitar o nÃºmero de aulas que
  um aluno fixo consegue fazer na semana, isso devia ser parte do plano".
- `.specs/STATE.md` AD-008 (composiÃ§Ã£o derivada), AD-037 (conversÃ£o cria
  vÃ­nculos fixos), AD-012 (identifiers em inglÃªs).
- CÃ³digo: `src/modules/students/services/enrollments.ts` (endEnrollment sem
  caller), `src/modules/plans/services/plans.ts` (weeklyFrequency),
  `src/app/(admin)/alunos/[id]/page.tsx` (seÃ§Ã£o de horÃ¡rios fixos),
  `src/app/(admin)/grade/booking-forms.tsx` (criaÃ§Ã£o de vÃ­nculo).

---

## Success Criteria

- [ ] O admin encerra um vÃ­nculo fixo pela tela do detalhe da aluna em menos
      de um minuto, sem SQL.
- [ ] Nenhum caminho do produto (grade, conversÃ£o, ediÃ§Ã£o de plano) deixa uma
      aluna com plano de N vezes com mais de N vÃ­nculos fixos ativos.
- [ ] A suite existente (unit + integration) continua verde com os testes
      novos das regras FIX e PLIM.
