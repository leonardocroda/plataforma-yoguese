# Admin Calendario Specification

**Approved**: 2026-11-14 - user: "aprovado, vamos fazer primeiro a spec de turmas ate o fim, deixe registrado em algum lugar que a proxima sera o calendario" (aprovada no mesmo turno; implementação depois de admin-turmas)

## Problem Statement

A `/grade` mostra somente uma janela móvel de 7 dias, de hoje até hoje + 6
(`src/app/(admin)/grade/page.tsx:154-158`), sem navegação para D+14 ou qualquer
data futura — o admin não consegue selecionar uma ocorrência daqui a duas
semanas para cancelá-la, embora `cancelOccurrenceByStudio`
(`src/modules/credits/services/cancellations.ts`, CRD-28..33) já exista sem
impor horizonte. O PRD 4.2 pede calendário com visualizações diária, semanal e
mensal, lista de participantes com vínculo e abertura do cadastro do aluno; o
calendário completo foi explicitamente adiado pela admin-base. O PRD 4.3 pede
também "bloquear horários", adiado pela AD-032 para o painel admin.

## Goals

- [ ] Admin consulta o calendário em diária, semanal e mensal e navega a qualquer data, incluindo D+14
- [ ] Admin abre a lista de participantes de uma ocorrência e o cadastro de cada participante
- [ ] Admin cancela uma ocorrência futura pelo estúdio com as regras intactas (créditos, idempotência, recusas)
- [ ] Canceladas e bloqueadas continuam visíveis com selo em todas as visualizações

## Out of Scope

| Feature | Reason |
| --- | --- |
| Gestão de turmas e modalidades (PRD 4.3 CRUD) | Feature `admin-turmas`, implementada antes (AD-044) |
| Dashboard com indicadores (PRD 4.1) | Já adiado pela admin-base |
| Área do aluno (PRD módulos 12 e 13) | Feature própria (AD-034); nada aqui muda a área do aluno |
| CRUD de feriados e recessos | Já existe em `/feriados` (core-feriados-recessos); o calendário apenas lê o bloqueio |
| Push/notificações, deploy, alteração de banco de produção | Fora de escopo sempre |
| Novas regras de crédito ou reserva | Os services existentes são reutilizados como estão; única exceção é o guarda de ocorrência passada (AD-045), justificado na spec |
| Alteração do dashboard/fluxo da home pública | O calendário é exclusivamente da área admin |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Local da interface | O calendário EVOLUI a `/grade`; nenhuma rota `/calendario` | A grade já tem composição, participantes, formulários e skin da marca; rota nova duplicaria tudo | y - AD-044 |
| Navegação | Abas Diária/Semanal/Mensal (default semanal) + setas + seletor de data | Cobre o PRD 4.2 completo e resolve D+14 | y - AD-044 |
| Ocorrência cancelada no histórico | Visível com selo de cancelada nas três visualizações, junto das BLOQUEADAS (AD-014) | O estúdio mantém o histórico à vista | y - AD-044 |
| Definição das janelas | Semanal = semana de calendário segunda a domingo (America/Sao_Paulo) contendo a data selecionada; mensal = mês contendo a data; diária = a data | Substitui a janela móvel de 7 dias por janelas de calendário previsíveis | n |
| Leitura ao passado | Navegação a datas passadas permitida, read-only: participantes e histórico visíveis, sem agendar nem cancelar | Coerente com AD-029 (nunca reescrever o passado da grade) | n |
| Custo de renderização | As três visualizações leem a composição fonte única (get-or-create para hoje/futuro); a vista mensal materializa o que renderiza, sem job nem pré-geração | É leitura sob demanda igual à janela de 7 dias atual; AD-008 preservado | n |
| Formulários de reserva | O fluxo atual de agendamento manual na grade permanece intocado | A feature muda navegação/participantes/cancelamento, não as reservas | n |
| Bloqueio específico (P2) | Exige mudança de modelo (bloqueio por turma/data), justificada no design | AD-032 reserva ao painel admin; distinção cancelar/bloquear/desativar só fica operável no calendário | y - AD-044 |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Visualizações e navegação do calendário ⭐ MVP

**User Story**: As a administradora, I want ver o calendário em diária, semanal e mensal e navegar a qualquer data, incluindo D+14, so que eu possa operar o estúdio além da janela de 7 dias.

**Why P1**: PRD 4.2 pede as três visualizações; hoje não há navegação e D+14 é
inalcançável — a ocorrência futura não pode nem ser vista nem cancelada.

**Acceptance Criteria**:

1. WHEN o admin abre a `/grade` THEN o sistema SHALL renderizar a visualização semanal da semana de calendário (segunda a domingo, America/Sao_Paulo) contendo hoje, cada ocorrência com horário, modalidade, quantidade de fixos, reposições, experimentais confirmadas e vagas disponíveis  <!-- event-driven -->
2. WHEN o admin escolhe uma das abas Diária, Semanal ou Mensal THEN o sistema SHALL renderizar as ocorrências da data, da semana ou do mês da data selecionada, respectivamente  <!-- event-driven -->
3. WHEN o admin usa as setas de navegação THEN o sistema SHALL avançar ou recuar exatamente um dia, uma semana ou um mês conforme a aba ativa  <!-- event-driven -->
4. WHEN o admin escolhe uma data no seletor THEN o sistema SHALL renderizar a janela da aba ativa contendo essa data, sem limite de 7 dias, incluindo D+14 e além  <!-- event-driven -->
5. The system SHALL derivar todas as contagens da composição (fonte única, RES-27), sem nova regra de cálculo em nenhuma visualização  <!-- ubiquitous -->
6. IF uma ocorrência passada nunca foi materializada THEN o sistema SHALL omiti-la das três visualizações (AD-008)  <!-- unwanted-behavior -->
7. WHILE uma ocorrência está BLOQUEADA por feriado ou recesso THEN o sistema SHALL exibi-la marcada como bloqueada nas três visualizações (AD-014)  <!-- state-driven -->
8. WHEN uma ocorrência está CANCELADA THEN o sistema SHALL exibi-la com selo de cancelada nas três visualizações  <!-- event-driven -->
9. WHEN qualquer visualização renderiza THEN o sistema SHALL manter a composição do guia de marca do admin (grade com patinhos mini por slot, tokens, bordas 2px, sem overflow horizontal em 1280px) (BRAND-08, AD-041, AD-042)  <!-- event-driven -->

**Independent Test**: logada, abrir `/grade` mostra a semana corrente; trocar para
Mensal, navegar com setas até o mês seguinte, usar o seletor para D+14 e ver a
ocorrência da turma com fixos/reposições/experimentais/vagas.

---

### P1: Participantes da ocorrência ⭐ MVP

**User Story**: As a administradora, I want abrir a lista de participantes de uma ocorrência com o tipo de vínculo e o cadastro de cada um so que eu saiba exatamente quem vem na aula.

**Why P1**: PRD 4.2: "Ao clicar no horário, abrir a lista de participantes, com
identificação do tipo de vínculo. Ao clicar em um aluno, abrir seu cadastro."

**Acceptance Criteria**:

1. WHEN o admin abre uma ocorrência THEN o sistema SHALL mostrar a lista de participantes com o vínculo de cada um (fixo, reposição, experimental), incluindo os registros de aviso de falta ou cancelamento (CRD-09, AD-022)  <!-- event-driven -->
2. WHEN o admin clica em um participante THEN o sistema SHALL abrir o cadastro do aluno (`/alunos/[id]`)  <!-- event-driven -->

**Independent Test**: abrir a ocorrência de terça 19h com 5 fixos, 1 reposição e
1 experimental: a lista marca os vínculos; clicar num fixo abre o cadastro dele.

---

### P1: Cancelamento pelo estúdio em qualquer data futura ⭐ MVP

**User Story**: As a administradora, I want selecionar uma ocorrência futura — incluindo D+14 — e cancelá-la pelo estúdio so que as regras de crédito e idempotência sejam as mesmas de sempre.

**Why P1**: O serviço existe e não impõe horizonte (CRD-28..33), mas a janela de
7 dias impede chegar à ocorrência; PRD 7.3 é Fase 1.

**Acceptance Criteria**:

1. WHEN o admin confirma o cancelamento pelo estúdio de uma ocorrência de hoje ou futura THEN o sistema SHALL, via `cancelOccurrenceByStudio`, marcar a ocorrência CANCELADA, cancelar as reservas ativas dela (cancelledBy ESTUDIO), devolver o crédito RESERVADO da reposição com o vencimento original e gerar 1 crédito CANCELAMENTO_ESTUDIO por aluno fixo afetado (CRD-28 a CRD-30, AD-020, AD-025)  <!-- event-driven -->
2. IF a mesma ocorrência é cancelada novamente THEN o sistema SHALL não duplicar créditos nem alterar reservas já canceladas (CRD-31, CRD-33)  <!-- unwanted-behavior -->
3. IF a ocorrência está BLOQUEADA por feriado ou recesso THEN o sistema SHALL recusar o cancelamento com mensagem clara (FER-09, AD-031)  <!-- unwanted-behavior -->
4. IF a ocorrência é de uma data passada THEN o sistema SHALL recusar o cancelamento com mensagem clara, sem alterar estado algum  <!-- unwanted-behavior --> *(guarda novo no serviço: AD-045 — hoje o cancelamento no passado é alcançável pela navegação livre e precisa ser recusado)*
5. WHEN o cancelamento conclui THEN a tela SHALL exibir o resultado: ocorrência cancelada, reservas canceladas, créditos devolvidos e créditos gerados  <!-- event-driven -->
6. WHILE uma ocorrência está CANCELADA THEN o sistema SHALL recusar novas reservas nela  <!-- state-driven -->

**Independent Test**: navegar a D+14, cancelar a ocorrência da terça 19h e ver
ocorrência CANCELADA, reservas canceladas, crédito da reposição devolvido e 1
crédito por fixo; repetir e ver zero crédito novo.

---

### P2: Bloqueio de uma turma em uma data específica

**User Story**: As a administradora, I want bloquear uma turma em uma data específica sem cancelar a turma nem a data inteira so que exceções pontuais (ex.: professora falta num dia) não virem cancelamento com crédito nem feriado.

**Why P2**: PRD 4.3 ("bloquear horários") adiado pela AD-032 para o painel
admin; é a última peça da tríade cancelar × bloquear × desativar, mas o
calendário sem ele já é utilizável.

**Acceptance Criteria**:

1. WHEN o admin bloqueia uma turma em uma data específica THEN as ocorrências daquela turma naquela data SHALL ficar BLOQUEADAS, as reservas ativas SHALL ser canceladas com o crédito RESERVADO da reposição devolvido, e nenhum crédito de estúdio SHALL ser gerado (AD-026, AD-032)  <!-- event-driven -->
2. WHEN o admin remove o bloqueio da turma naquela data THEN as ocorrências cobertas de hoje em diante SHALL voltar a AGENDADA automaticamente e as reservas canceladas pelo bloqueio não SHALL ser restauradas (AD-027)  <!-- event-driven -->
3. IF uma ocorrência bloqueada por turma/data recebe cancelamento pelo estúdio THEN o sistema SHALL recusar com mensagem clara (AD-031)  <!-- unwanted-behavior -->
4. WHILE qualquer bloqueio (feriado, recesso ou de turma/data) cobre a data THEN a ocorrência SHALL permanecer bloqueada e SHALL desbloquear somente quando nenhum cobrir (AD-028)  <!-- state-driven -->

**Independent Test**: bloquear a turma de quinta 19h só na próxima quinta: a
ocorrência fica BLOQUEADA sem crédito de estúdio, a reposição agendada devolve o
crédito; remover o bloqueio volta a AGENDADA; o cancelamento nela é recusado
enquanto bloqueada.

---

### P3: Voltar para hoje

**User Story**: As a administradora, I want voltar à data atual com um gesto so que não me perca navegando pelo calendário.

**Why P3**: Conveniência de navegação; não bloqueia nada do PRD.

**Acceptance Criteria**:

1. WHEN o admin usa a ação "Hoje" THEN o sistema SHALL renderizar a janela da aba ativa contendo a data de hoje (America/Sao_Paulo)  <!-- event-driven -->

---

## Edge Cases

- IF a data do seletor é passada THEN a visualização SHALL renderizar read-only: participantes e histórico visíveis, sem agendamento nem cancelamento (AD-029, AD-045).
- IF a ocorrência cancelada depois é coberta por feriado/recesso e o bloqueio é removido THEN a ocorrência SHALL continuar CANCELADA — desbloqueio nunca ressuscita cancelada (AD-027).
- IF a edição de dia/horário da turma (feature `admin-turmas`, AD-013) roda THEN as ocorrências futuras antigas SHALL aparecer CANCELADAS na grade, com selo, pois o histórico é preservado.
- IF uma ocorrência é CANCELADA e outra BLOQUEADA na mesma data THEN cada ocorrência SHALL mostrar seu próprio estado — o selo é por ocorrência, não por dia.
- IF a vista mensal cobre um recesso THEN as ocorrências do período SHALL aparecer BLOQUEADAS, não omitidas (AD-014).
- IF a sessão do admin expira no meio da navegação THEN a próxima requisição SHALL redirecionar ao login (AUTH-01).
- IF duas ações concorrentes cancelam a mesma ocorrência THEN exatamente uma SHALL efetivar e a outra SHALL encontrar a ocorrência já CANCELADA sem duplicar crédito (transação com trava, CRD-31).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAL-01 | P1: Visualizações e navegação | Design | Pending |
| CAL-02 | P1: Visualizações e navegação | Design | Pending |
| CAL-03 | P1: Visualizações e navegação | Design | Pending |
| CAL-04 | P1: Visualizações e navegação | Design | Pending |
| CAL-05 | P1: Visualizações e navegação | Design | Pending |
| CAL-06 | P1: Visualizações e navegação | Design | Pending |
| CAL-07 | P1: Visualizações e navegação | Design | Pending |
| CAL-08 | P1: Visualizações e navegação | Design | Pending |
| CAL-09 | P1: Visualizações e navegação | Design | Pending |
| CAL-10 | P1: Participantes da ocorrência | Design | Pending |
| CAL-11 | P1: Participantes da ocorrência | Design | Pending |
| CAL-12 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-13 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-14 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-15 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-16 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-17 | P1: Cancelamento pelo estúdio | Design | Pending |
| CAL-18 | P2: Bloqueio de turma/data | Design | Pending |
| CAL-19 | P2: Bloqueio de turma/data | Design | Pending |
| CAL-20 | P2: Bloqueio de turma/data | Design | Pending |
| CAL-21 | P2: Bloqueio de turma/data | Design | Pending |
| CAL-22 | P3: Voltar para hoje | Design | Pending |

**Coverage:** 22 total, 22 mapeados a stories (17 P1, 4 P2, 1 P3).

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 7.3 não impõe limite de data ao cancelamento do estúdio | Cancelamento recusado para ocorrência de data passada (só hoje/futuro) | y - AD-045 |
| PRD 4.3 "bloquear horários" sem granularidade definida | Bloqueio por turma em data específica (não por data inteira), como P2 | y - AD-032, AD-044 |
| Guia de marca desenha só a vista semanal do admin ("Admin: calendário e turma") | Vistas diária e mensal estendem a mesma composição; sem referência visual, critérios de resultado (não de layout) | y - AD-044 |
| PRD 4.2 não desenha estado de ocorrência cancelada na grade | Ocorrência CANCELADA visível com selo nas três visualizações | y - AD-044 |
| Guia desenha a semana do admin como cinco colunas, segunda a sexta | Sete colunas, segunda a domingo: o estúdio pode ter aula todos os dias | y - user, 2026-11-14: "a semana é de segunda a domingo mesmo, se tava escrito outra coisa na doc a doc tava errada, podemos ter aula todos os dias" (CAL-01) |
| Guia não desenha abas, setas, seletor de data nem a ação "Hoje" no calendário do admin | Barra de navegação com as abas Diária/Semanal/Mensal, as setas de período, o seletor de data e "Hoje" | y - CAL-02, CAL-03, CAL-04, CAL-22 |
| Guia rotula os grupos do painel "Alunos fixos", "Reposições" e "Aulas experimentais" | Chips `Fixo`, `Reposição` e `Experimental` com a contagem de cada vínculo, sobre a lista de nomes | y - CAL-10, CAL-11 |
| Guia afirma na legenda da semana que cada horário mostra 8 vagas | A legenda fala das vagas da turma, porque a capacidade de cada turma é editável (TURM) | y - CAL-09, AD-044 |

---

## Sources

- `PRD.md.txt` — SRS Yogue-se V1.0: seção 4.2 (calendário administrativo),
  4.3 (bloquear horários), 7.3 (cancelamento de aula pelo estúdio), 16 (FASE 1:
  calendário)
- `.specs/STATE.md` — AD-008 (ocorrências sob demanda), AD-013/AD-017 (edição de
  horário), AD-014 (grade mostra BLOQUEADA), AD-016 (cancelamento na `/grade`),
  AD-020, AD-025, AD-026 a AD-031 (regras de bloqueio e cancelamento), AD-032,
  AD-041/AD-042 (skin da marca), AD-044 (split e decisões de interface), AD-045
  (guarda de ocorrência passada)
- `.specs/features/core-turmas-reservas/spec.md` — RES-27 (composição fonte única)
- `.specs/features/core-creditos-cancelamentos/spec.md` — CRD-28 a CRD-33
  (cancelamento pelo estúdio), CRD-09 (avisos na ocorrência)
- `.specs/features/core-feriados-recessos/spec.md` — FER-09 (recusa em bloqueada)
- `.specs/features/admin-base/spec.md` — adiamento do calendário (spec.md 24-29,
  context.md 20-25); AUTH-01 (guard)
- `.specs/features/redesign-marca/captures/yogue-se-brand.html` — binding —
  composição "Admin: calendário e turma" (AD-042): a vista semanal mantém essa
  composição com dados reais da `/grade`
- Código: `src/app/(admin)/grade/page.tsx` (janela de 7 dias, linhas 154-158),
  `src/modules/credits/services/cancellations.ts` (`cancelOccurrenceByStudio`),
  `src/modules/bookings/services/composition.ts`, `src/modules/ui/` (kit da marca)
- `.specs/features/admin-calendario/context.md` — decisões do usuário desta rodada

---

## Success Criteria

- [ ] Admin navega a D+14 por setas ou seletor e cancela a ocorrência: estado CANCELADA, reservas canceladas, crédito da reposição devolvido, 1 crédito por fixo, idempotente — idêntico ao cancelamento de hoje
- [ ] Ocorrências canceladas e bloqueadas continuam visíveis com selo nas visualizações diária, semanal e mensal
- [ ] Nenhuma regra de crédito/reserva muda além do guarda de ocorrência passada (AD-045); AD-008 preservado (sem job, materialização por leitura)
- [ ] Suite verde, build e lint limpos
