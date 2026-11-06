# Core Turmas e Reservas Specification

**Approved**: 2026-11-06 - user: "bora"

## Problem Statement

Yogue-se Yoga realiza manualmente o controle de turmas, presença fixa,
reposições e experimentais. O PRD define o core: turmas semanais
recorrentes com capacidade configurável (default 8), ocorrências
concretas por data e reserva transacional em servidor, fontes únicas para
site público, painel e área do aluno. Esta feature entrega a fundação de
vagas/reservas que os módulos de créditos, experimentais e área do aluno
vão consumir — e responde às três perguntas do negócio por ocorrência:
quantos vão, quantas vagas restam, quais são fixos/reposições/experimentais.

## Goals

- [ ] Grade de turmas recorrentes administrável, sobre o schema do PRD
- [ ] Vagas e composição por vínculo derivadas de fonte única em cada ocorrência
- [ ] Reserva transacional no servidor: concorrência na última vaga permite exatamente uma confirmação
- [ ] Feriados e recessos bloqueiam ocorrências sem cron

## Out of Scope

| Feature | Reason |
| --- | --- |
| Créditos e regra de 24h (PRD módulo 6) | Feature própria, seguinte na ordem AD-009; reserva manual desta slice não valida crédito |
| Fluxo de aprovação de experimentais (PRD módulo 8) | Feature própria; nesta slice existe apenas BOOKING do tipo EXPERIMENTAL criado manualmente |
| Cancelamento de aula pelo estúdio (PRD seção 7.3) | Depende do módulo de créditos |
| Alteração de horário fixo pelo aluno (PRD 5.2) | Fluxo de aluno; requer auth |
| Autenticação, perfis e LGPD (PRD seções 2 e 13) | Feature própria após o core operacional |
| Calendário completo com 3 visualizações (PRD 4.2) | UI mínima desta slice cobre leitura de turma/ocorrência; calendário completo é feature do painel |
| Cadastro completo de alunos e planos (PRD 4.4, 4.5) | Feature própria; alunos existentes entram por seed e seleção |
| Site institucional, Pato Yoga Club, notificações, pagamentos, relatórios | Fases 3/4 do PRD |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Tipos de reserva aceitos no agendamento manual | FIXED, MAKEUP, EXPERIMENTAL sem regras específicas por tipo nesta slice | Regras por tipo (crédito, aprovação, pagamento) pertencem aos seus módulos | y |
| Capacidade de novo horário fixo | Verificada na próxima ocorrência da turma antes de confirmar o enrollment | PRD 4.6 e 5.2 verificam "disponibilidade e capacidade" antes de confirmar; estendemos a mesma regra à criação de fixos | n |
| Reservas em datas passadas | Recusadas: agendamento apenas hoje/futuro no fuso do estúdio | Histórico não é criado por reserva nova; correção retroativa manual fica para feature futura | n |
| UI administrativa mínima sem auth | Tela de turmas e ocorrências sem login nesta slice | Decidido em discuss ("vertical slice sem auth") | y |
| Alunos e modalidades iniciais | Seed com 2 modalidades (Superioga Clássico e Intenso) e alunos de teste | Cadastro de alunos é feature própria; seed permite testar contagens/vagas | y |
| Cruzamento de horários do mesmo aluno no mesmo dia | Permitido, mas apenas o admin marca: mesma ocorrência recusada como duplicada; segunda aula no mesmo dia exige marcação admin | Decisão do usuário (AD-011): aluno faz n aulas/dia presencialmente, mas o self-service marca no máximo uma | y |
| Horizonte de "ocorrências em aberto" na edição de capacidade | Ocorrências futuras materializadas + a próxima ocorrência; edição recusada se levar vagas < 0, citando a ocorrência mais afetada | RES-17 não fixa horizonte; escolha de implementação do T16, registrada como spec-precision no código | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Grade administrável de modalidades e turmas ⭐ MVP

**User Story**: As a admin, I want cadastrar e gerenciar modalidades e turmas recorrentes (dia, horário, capacidade, status) so that a grade semanal exista como fonte única para os três ambientes.

**Why P1**: Nenhuma ocorrência, reserva ou contagem existe sem turma cadastrada.

**Acceptance Criteria**:

1. WHEN o admin cria uma turma com modalidade, dia da semana, horário de início e horário de término THEN o sistema SHALL gravar a turma ativa com esses dados <!-- event-driven -->
2. WHEN o admin cria uma turma sem informar capacidade THEN o sistema SHALL gravar capacidade 8 e o admin SHALL poder alterá-la depois <!-- event-driven -->
3. IF o cadastro de turma contém fim menor ou igual ao início, dia da semana fora de 1-7 (domingo a sábado em America/Sao_Paulo) ou capacidade menor que 1 THEN o sistema SHALL recusar no servidor mencionando o campo inválido <!-- unwanted-behavior -->
4. WHEN o admin edita ou desativa uma turma THEN o sistema SHALL persistir a alteração e as ocorrências futuras SHALL refletir o novo estado a partir do momento da alteração <!-- event-driven -->
5. The system SHALL oferecer as duas modalidades do PRD seedadas (Superioga Clássico, Superioga Intenso) e permitir cadastrar, editar e desativar modalidades <!-- ubiquitous -->

**Independent Test**: criar uma turma (ex.: terça 19h-20h), ver a criação; tentar turma com fim menor que início e ver recusa específica; desativar a turma e verificar.

---

### P1: Ocorrências on-demand e composição de vagas ⭐ MVP

**User Story**: As a admin, I want consultar qualquer turma/data e ver quantos vão (por vínculo: fixos, reposições, experimentais) e quantas vagas restam, so que os três ambientes respondam sempre a partir de uma fonte única.

**Why P1**: É a pergunta central do estúdio (exemplo Terça 19h 5/2/1, vagas 0 do PRD) e a base de toda regra posterior.

**Acceptance Criteria**:

1. WHEN qualquer operação de leitura ou agendamento referencia (turma, data) de hoje ou futura THEN o sistema SHALL materializar a ocorrência daquela data naquele dia da semana do slot (get-or-create) - sem job e sem horizonte fixo <!-- event-driven -->
2. WHILE a data de referência é um feriado cadastrado ou cai dentro de um recesso THEN a ocorrência SHALL estar BLOQUEADA e o sistema SHALL recusar novas reservas nela <!-- state-driven -->
3. The system SHALL computar por ocorrência: nº de alunos fixos, nº de reposições, nº de experimentais, total (fixos + reposições + experimentais) e vagas = capacity - total <!-- ubiquitous -->
4. Com fixos derivados: WHILE um FIXED_ENROLLMENT está ativo e cobre a data THEN o aluno SHALL contar como fixo naquela ocorrência; WHILE ele está terminado ou inativo THEN SHALL deixar de contar <!-- state-driven -->
5. IF a data consultada é no passado THEN o sistema SHALL permitir apenas leitura e SHALL recusar materialização para agendamento novo <!-- unwanted-behavior -->

**Independent Test**: cadastrar turma terça 19h cap 8 e 5 enrollments para dois alunos; consultar a ocorrência da próxima terça e ver composição 2 fixos, 0/0, vagas 6; passar um enrollment para end_date no passado e ver a contagem cair.

---

### P1: Feriados e recessos administráveis ⭐ MVP

**User Story**: As a admin, I want cadastrar feriados (data) e recessos (período) so que as ocorrências correspondentes não aceitem reservas.

**Why P1**: O bloqueio é intrínseco ao motor de vagas: sem ele, ocorrências de datas-sem-aula ficariam reserváveis na fundação.

**Acceptance Criteria**:

1. WHEN o admin cadastra um feriado com data e nome THEN o sistema SHALL gravar e as ocorrências daquela data SHALL ser bloqueadas via critério de ocorrência <!-- event-driven -->
2. WHEN o admin cadastra um recesso com data de início e fim THEN o sistema SHALL gravar e TODAS as datas do intervalo, inclusive extremos, SHALL gerar ocorrências bloqueadas <!-- event-driven -->
3. IF o admin tenta cadastrar feriado para data já cadastrada THEN o sistema SHALL recusar duplicação em vez de criar segundo bloqueio para a mesma data <!-- unwanted-behavior -->

**Independent Test**: cadastrar feriado numa próxima terça; consultar a turma dessa terça e ver ocorrência bloqueada; tentar recadastrar e ver recusa de duplicado.

---

### P1: Reserva transacional com capacidade ⭐ MVP

**User Story**: As a admin, I want agendar um aluno manualmente em uma ocorrência (tipo fixo/reposição/experimental) so que a vaga seja ocupada com garantia transacional de servidor.

**Why P1**: "Duas reservas simultâneas na última vaga - apenas uma confirmada" é o teste mais crítico do PRD (seção 15), e a capacidade é a regra da seção 3.

**Acceptance Criteria**:

1. WHEN o admin agenda um aluno (tipo FIXED reserva individual, MAKEUP ou EXPERIMENTAL) em ocorrência com vaga THEN o sistema SHALL confirmar a reserva no servidor, e a composição SHALL passar a ocupar a vaga correspondente ao tipo <!-- event-driven -->
2. WHEN o admin tenta agendar em ocorrência sem vaga disponível THEN o sistema SHALL recusar com mensagem clara e SHALL não alterar nenhum estado parcial <!-- unwanted-behavior -->
3. IF duas ou mais reservas concorrentes disputam a última vaga então exatamente UMA confirmada e as demais recusadas - transação isolada, sem overbooking <!-- unwanted-behavior -->
4. IF o aluno já possui reserva ativa na mesma ocorrência THEN o sistema SHALL recusar a nova reserva como duplicada <!-- unwanted-behavior -->
5. IF a reserva é para data no passado THEN o sistema SHALL recusar <!-- unwanted-behavior -->
5. WHEN o admin agenda o mesmo aluno para uma segunda ocorrência no mesmo dia (turma diferente) THEN o sistema SHALL permitir a reserva - a marcação da segunda aula em diante é exclusivamente do admin <!-- event-driven -->
6. WHEN uma reserva é confirmada THEN o sistema SHALL registrar student_id, class_session_id, tipo, status ativo e timestamps para auditoria <!-- event-driven -->

**Independent Test**: turma cap 8 com 8 ocupantes... criar 9 reservas concorrentes (script paralelo) em cap 1 e contar exatamente 1 confirmada; duplicar reserva mesma sessão/aluno e ver recusa.

---

### P1: Horários fixos (enrollments) ⭐ MVP

**User Story**: As a admin, I want vincular alunos ativos a turmas como horários fixos semanais (com start/end date) so que a recorrência ocupe vagas automaticamente nas ocorrências futuras.

**Why P1**: Sem enrollments não existe "aluno fixo" - a composição e o exemplo do PRD não têm fonte.

**Acceptance Criteria**:

1. WHEN o admin cria vinculoo fixo (student, turma, data inicial) para aluno THEN o sistema SHALL gravar enrollment ativo com start_date e sem end_date <!-- event-driven -->
2. WHEN o admin cria o enrollment THEN o sistema SHALL verificar disponibilidade na próxima ocorrência da turma e IF sem vaga THEN SHALL recusar a operação sem efeito parcial <!-- event-driven -->
3. WHILE uma vaga de reposição/make-up já ocupar um assento, o fixo cresce a composição; IF a composição calculada excede a capacidade THEN recusada antes de persistir (transação) - ver também critérios de reserva e contraste com RES-05 <!-- state-driven -->
4. WHEN o admin encerra um enrollment (end_date ou inativo) THEN o aluno SHALL deixar de contar como fixo nas ocorrências a partir da data encerrada <!-- event-driven -->
5. O sistema SHALL manter o histórico: cancelamentos/enrollments (start_date/end_date/status) vazam em consultas por aluno <!-- ubiquitous -->

**Independent Test**: criar enrollment em turma com vaga e ver fixos +1 e vagas -1 na composição; encerrar e ver retorno; tentar enrollment em turma completa e ver recusa.

---

### P2: Leitura pública segura de vagas

**User Story**: As a visitante, I want consultar dias, horários, modalidade e vagas disponíveis so que o site institucional consuma a mesma fonte única (PRD 10.4).

**Why P2**: A interface pública depende do site institucional (fase 3); o contrato de leitura pode existir desde já sem expor dados pessoais.

**Acceptance Criteria**:

1. WHEN a leitura pública pede agenda por período THEN o sistema SHALL retornar data, horário, modalidade e vagas disponíveis sem nomes nem dados pessoais de alunos <!-- event-driven -->
2. WHILE um slot está inativo THEN as ocorrências dele SHALL não parecer na agenda pública <!-- state-driven -->

**Independent Test**: chamar o endpoint de agenda pública com uma turma ativa e outro inativo e conferir visibilidade e campos retornados.

---

### P3: Leitura por servidor app (cache de composição)

**User Story**: As a dev, I want uma função de serviço única que devolve composição/vagas de uma ocorrência so que painel e site não repetem a conta.

**Why P3**: DRY interno; nenhum critério de usuário.

**Acceptance Criteria**:

1. The system SHALL expor um serviço único de cálculo de composição usado por leitura admin, agendamento e leitura pública -- ainda testado pelos critérios anteriores <!-- ubiquitous -->

---

## Edge Cases

- IF fim de turma igual ao início THEN recusa por critério de validação (RES-03)
- IFA modificação de capacidade para valor menor que a ocupação atual de uma ocorrência futura THEN a composição refletirá vagas negativas? R: SHALL caparse: o sistema SHALL permitir edição apenas com vagas >= 0 nas ocorrências em aberto, caso contrário SHALL recusar edição informando a ocorrência mais afetada. <!-- unwanted-behavior --> (RES-17)
- WHEN data cai em feriado PROVIDO de recesso simultâneo THEN uma única ocorrência e fator de bloqueio único (não duplicar reservas) (RES-18)
- IF get-or-create roda duas vezes para mesma (turma, data) THEN apenas uma ocorrência é criada - idempotência da materialização (RES-19)
- Ocupação em testes de concorrência com mesma COUNT: 1 posto... "IF reservas N concorrentes para M vagas THEN SHALL exatamente M confirmadas e N-M recusadas" (RES-20)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RES-01 | P1: Grade administrável | -      | Pending |
| RES-02 | P1: Grade administrável | -      | Pending |
| RES-03 | P1: Grade administrável | -      | Pending |
| RES-04 | P1: Grade administrável | -      | Pending |
| RES-05 | P1: Grade administrável | -      | Pending |
| RES-06 | P1: Ocorrências on-demand | -      | Pending |
| RES-07 | P1: Ocorrências on-demand | -      | Pending |
| RES-08 | P1: Ocorrências on-demand | -      | Pending |
| RES-09 | P1: Ocorrências on-demand | -      | Pending |
| RES-10 | P1: Ocorrências on-demand | -      | Pending |
| RES-11 | P1: Feriados e recessos | -      | Pending |
| RES-12 | P1: Feriados e recessos | -      | Pending |
| RES-13 | P1: Feriados e recessos | -      | Pending |
| RES-14 | P1: Reserva transacional | -      | Pending |
| RES-15 | P1: Reserva transacional | -      | Pending |
| RES-16 | P1: Reserva transacional | -      | Pending |
| RES-17 | P1: Reserva transacional | -      | Pending |
| RES-18 | P1: Reserva transacional | -      | Pending |
| RES-19 | P1: Reserva transacional | -      | Pending |
| RES-20 | P1: Horários fixos | -      | Pending |
| RES-21 | P1: Horários fixos | -      | Pending |
| RES-22 | P1: Horários fixos | -      | Pending |
| RES-23 | P1: Horários fixos | -      | Pending |
| RES-24 | P1: Horários fixos | -      | Pending |
| RES-25 | P2: Leitura pública | -      | Pending |
| RES-26 | P2: Leitura pública | -      | Pending |
| RES-27 | P3: Serviço único | -      | Pending |

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 5.1: "O sistema deverá gerar reservas recorrentes para as ocorrências futuras dos horários cadastrados" (implícito: BOOKING FIXED materializado por ocorrência) | Fixo ocupa vaga por contagem derivada de FIXED_ENROLLMENTS ativos; BOOKING FIXED criado só quando uma ocorrência específica exigir | y - AD-008 |
| PRD 4.6 agendamento manual aceita tipo Reposição | Nesta slice a reserva manual não valida crédito; validação entra no módulo de créditos | y - AD-010 |

## Sources

- `PRD.md.txt` (SRS Yogue-se V1.0) - binding - seções 1.1, 2.1-2.3 (perfis no dominio de leitura), 3 (capacidade 8 configurável, fuso), 4.3 (cadastro de turmas), 4.6 (agendamento manual com verificação), 5.1 (horários fixos recorrentes), 7.1-7.2 (feriados e recessos sem créditos), 12 (entidades USERS, STUDENTS, CLASS_TYPES, CLASS_SLOTS, FIXED_ENROLLMENTS, CLASS_SESSIONS, BOOKINGS, HOLIDAYS, STUDIO_CLOSURES), 13.7-13.8 (transacional, duplicados), 14 (responsividade aplica a telas futuras), 15 (testes: 8 reservas, simultâneas na última vaga), 17 (fonte única, agenda centralizada).

---

## Success Criteria

- [ ] Teste do PRD "Turma com 8 reservas não permite uma nona reserva" passa como teste Vitest
- [ ] Teste do PRD "Duas reservas simultâneas na última vaga - apenas uma confirmada" passa como teste Vitest
- [ ] Na tela da ocorrência, as três perguntas do negócio respondidas: total por vínculo e vagas restantes
- [ ] Nenhuma leitura pública retorna dado pessoal de aluno
