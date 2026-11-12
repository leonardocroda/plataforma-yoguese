# Admin Base Specification

**Approved**: 2026-11-12 - user: "Aprovado"

## Problem Statement

O núcleo operacional (turmas, reservas, créditos, feriados) está fechado, mas o
painel é aberto — o layout `(admin)` é um placeholder sem autenticação e qualquer
pessoa acessa /grade, /creditos e /feriados. Faltam o cadastro de alunos com os
campos de gestão (PRD 4.4) e os planos (PRD 4.5), hoje inexistentes, para o
estúdio usar a plataforma no dia a dia. A AD-034 colocou esta base antes das
experimentais.

## Goals

- [ ] Acesso administrativo restrito: sem sessão válida, nenhuma rota do `(admin)` responde
- [ ] Admin matricula uma aluna com plano, status e horário fixo, e a grade reflete a ocupação
- [ ] Planos criados e mantidos pelo admin, com valor vindo do banco (sem tabela de preços no código)

## Out of Scope

| Feature | Reason |
| --- | --- |
| Dashboard com indicadores (PRD 4.1) | Faltam dados (experimentais); adia-se para depois do módulo 8 |
| Calendário administrativo diária/semanal/mensal (PRD 4.2) | A /grade atual cobre a operação; visualização completa é feature própria |
| Login e conta de aluno (1º login, senha) | Área do aluno vem depois (AD-006, AD-034); tabela de usuários já nasce com role |
| Aulas experimentais (PRD módulo 8) | Próxima feature na ordem da AD-034 |
| Troca de senha / recuperação de acesso | Só existe o admin do seed; entra com a conta do aluno |
| Bloqueio por horário específico (PRD 4.3) | Já adiado pela AD-032 para o painel admin completo |
| Exclusão física de alunos ou planos | Ciclo de vida por status preserva histórico (PRD 13.10) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Primeiro admin | Criado pelo `db:seed`, idempotente, com e-mail/senha de `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env.local` | AD-006 (seed controlado no deploy); README documenta | y |
| Sessão | Cookie httpOnly assinado, expiração de 7 dias | Padrão simples sem dependência nova; reforçado no servidor | n |
| Hash de senha | scrypt via `node:crypto`, sem dependência nova | Coerente com o estilo mínimo de dependências do projeto | n |
| Destino pós-login | `/grade` (tela operacional principal) | A grade é a ferramenta do dia a dia | n |
| Unicidade | E-mail do aluno único; nome deixa de ser UNIQUE | Duas alunas podem ter o mesmo nome; e-mail identifica o futuro login | n |
| Plano obrigatório | Obrigatório quando status = Ativo; opcional para Experimental e Aguardando matrícula | PRD 8.6: aluno "aguardando matrícula" ainda escolhe plano | n |
| Data de matrícula | Preenchida com a data de hoje no cadastro, editável depois | PRD 4.4 exige o campo; default evita fricção | n |
| Aluno Inativo | Horários fixos deixam de contar na ocupação por derivação (sem reescrever dados) | PRD 5.1: "cada aluno **ativo**"; volta ao reagir, como AD-007/AD-008 | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Login seguro do administrador ⭐ MVP

**User Story**: As a administradora, I want entrar com e-mail e senha para que só eu acesse o painel.

**Why P1**: PRD 13 (autenticação segura, permissões por perfil) e o painel hoje está aberto.

**Acceptance Criteria**:

1. WHEN qualquer requisição a uma rota do grupo `(admin)` chega sem sessão válida THEN o sistema SHALL redirecionar para a tela de login  <!-- event-driven -->
2. WHEN o formulário de login recebe credenciais de um administrador cadastrado THEN o sistema SHALL iniciar a sessão (cookie httpOnly) e levar à `/grade`  <!-- event-driven -->
3. IF o formulário de login recebe e-mail ou senha incorretos THEN o sistema SHALL exibir uma única mensagem genérica ("E-mail ou senha inválidos") e não iniciar sessão  <!-- unwanted-behavior -->
4. IF um campo do login chega vazio ou com e-mail em formato inválido THEN o sistema SHALL recusar no servidor, sem criar sessão  <!-- unwanted-behavior -->
5. O sistema SHALL armazenar senhas somente como hash com salt, nunca em texto puro  <!-- ubiquitous -->
6. WHEN o admin autenticado usa a ação "Sair" THEN o sistema SHALL invalidar a sessão e redirecionar para o login  <!-- event-driven -->
7. WHILE uma sessão válida existe, um acesso à tela de login SHALL redirecionar para a `/grade`  <!-- state-driven -->
8. WHEN o `db:seed` roda THEN o sistema SHALL criar o primeiro administrador (role ADMIN) com as credenciais de `ADMIN_EMAIL`/`ADMIN_PASSWORD`, idempotente  <!-- event-driven -->
9. IF credenciais válidas chegam de um usuário que não é ADMIN THEN o sistema SHALL recusar o login com a mesma mensagem genérica, sem iniciar sessão  <!-- unwanted-behavior --> *encontrado pela verificação: o guard do layout só checava a presença da sessão (F1, AUTH-09)*

**Independent Test**: sem sessão, abrir `/grade` redireciona; logar com a credencial do seed entra; errar a senha mostra a mensagem genérica; inspecionar o banco mostra `password_hash`, nunca texto puro.

---

### P1: Shell da área logada ⭐ MVP

**User Story**: As a administradora, I want navegar entre as telas do painel num layout único com minha identificação para que a operação tenha uma home comum.

**Why P1**: hoje cada tela é solta; a AD-004 espera o route group `(admin)` coeso.

**Acceptance Criteria**:

1. WHILE o admin está autenticado, o shell SHALL oferecer navegação para Grade, Alunos, Planos, Créditos e Feriados, além da ação "Sair"  <!-- state-driven -->
2. WHILE o admin está autenticado, o shell SHALL identificar a administradora logada pelo nome (ou e-mail)  <!-- state-driven -->

**Independent Test**: logada, as cinco telas ficam alcançáveis pela navegação e o "Sair" encerra a sessão (prova com AUTH-06).

---

### P1: Cadastro de alunos ⭐ MVP

**User Story**: As a administradora, I want cadastrar e manter alunas com telefone, e-mail, plano, status e observações para que a matrícula viva na plataforma.

**Why P1**: PRD 4.4 é Fase 1; hoje a tabela só guarda nome e status ATIVO/INATIVO.

**Acceptance Criteria**:

1. WHEN o admin submete um cadastro completo THEN o sistema SHALL criar a aluna com nome, telefone, e-mail, data de nascimento, data de matrícula, plano e status  <!-- event-driven -->
2. IF um campo obrigatório falta ou é inválido (nome, telefone, e-mail, data de nascimento; plano quando status = Ativo) THEN o sistema SHALL recusar no servidor com erro específico do campo  <!-- unwanted-behavior -->
3. O campo de status SHALL oferecer exatamente os quatro valores do PRD 4.4: Experimental, Aguardando matrícula, Ativo, Inativo  <!-- ubiquitous -->
4. IF um e-mail já cadastrado é submetido THEN o sistema SHALL recusar o cadastro indicando o e-mail duplicado  <!-- unwanted-behavior -->
5. WHEN o admin edita os dados de uma aluna THEN o sistema SHALL persistir as mudanças e refleti-las na listagem e no detalhe  <!-- event-driven -->
6. WHILE uma aluna está Inativa, seus horários fixos ativos SHALL deixar de contar como ocupação fixa das ocorrências  <!-- state-driven -->
7. WHEN uma aluna Inativa volta a Ativa THEN seus horários fixos ativos SHALL voltar a contar na próxima leitura, sem reescrever matrículas  <!-- event-driven -->
8. WHEN o admin abre o detalhe de uma aluna THEN a tela SHALL mostrar os dados cadastrais, os horários fixos ativos, os créditos disponíveis com vencimento e o histórico de reservas  <!-- event-driven -->

**Independent Test**: criar uma aluna com plano Ativo aparece na listagem e no detalhe com créditos e horários; inativá-la libera a vaga na grade (ocupação derivada), reativá-la restaura.

---

### P1: Gestão de planos ⭐ MVP

**User Story**: As a administradora, I want cadastrar planos com valor e frequência para que a tabela de preços seja minha, não do código.

**Why P1**: PRD 4.5 exige planos geridos pelo admin e proíbe tabela de preços fixa no código; não existe entidade PLANS.

**Acceptance Criteria**:

1. WHEN o admin submete um plano completo (nome, valor mensal, aulas por semana, descrição opcional, status) THEN o sistema SHALL criá-lo  <!-- event-driven -->
2. IF nome, valor mensal ou aulas por semana faltam ou são inválidos (valor <= 0, frequência < 1) THEN o sistema SHALL recusar no servidor com erro específico do campo  <!-- unwanted-behavior -->
3. WHEN o admin edita um plano THEN o sistema SHALL persistir as mudanças e refleti-las na listagem  <!-- event-driven -->
4. WHILE um plano está Inativo, o seletor de plano dos formulários de aluna SHALL deixar de oferecê-lo  <!-- state-driven -->
5. Uma aluna já vinculada SHALL manter seu plano visível no cadastro e no detalhe mesmo quando o plano fica Inativo  <!-- ubiquitous -->
6. O sistema SHALL obter os valores de plano do banco de dados, sem tabela de preços fixa no código  <!-- ubiquitous -->

**Independent Test**: criar "Mensal Ilimitado" com valor e frequência, cadastrar aluna nele; inativar o plano e abrir o formulário de nova aluna — o plano não aparece, mas a aluna existente continua com ele.

---

## Edge Cases

- IF a sessão expira com o admin numa tela do `(admin)` THEN a próxima requisição SHALL redirecionar ao login (comportamento do guard, AUTH-01).
- IF o seed roda duas vezes THEN o sistema SHALL não duplicar o administrador (idempotência, AUTH-08).
- IF o e-mail do login difere apenas por maiúsculas/espaços THEN o sistema SHALL normalizar antes de comparar (e-mail é identidade de acesso).
- WHILE um plano Inativo existe, nenhum erro de leitura SHALL ocorrer em telas de aluna (plano exibido mesmo inativo, PLAN-05).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1: Login seguro | Design | Pending |
| AUTH-02 | P1: Login seguro | Design | Pending |
| AUTH-03 | P1: Login seguro | Design | Pending |
| AUTH-04 | P1: Login seguro | Design | Pending |
| AUTH-05 | P1: Login seguro | Design | Pending |
| AUTH-06 | P1: Login seguro | Design | Pending |
| AUTH-07 | P1: Login seguro | Design | Pending |
| AUTH-08 | P1: Login seguro | Design | Pending |
| AUTH-09 | P1: Login seguro | Verification | Pending |
| SHELL-01 | P1: Shell da área logada | Design | Pending |
| SHELL-02 | P1: Shell da área logada | Design | Pending |
| STUD-01 | P1: Cadastro de alunos | Design | Pending |
| STUD-02 | P1: Cadastro de alunos | Design | Pending |
| STUD-03 | P1: Cadastro de alunos | Design | Pending |
| STUD-04 | P1: Cadastro de alunos | Design | Pending |
| STUD-05 | P1: Cadastro de alunos | Design | Pending |
| STUD-06 | P1: Cadastro de alunos | Design | Pending |
| STUD-07 | P1: Cadastro de alunos | Design | Pending |
| STUD-08 | P1: Cadastro de alunos | Design | Pending |
| PLAN-01 | P1: Gestão de planos | Design | Pending |
| PLAN-02 | P1: Gestão de planos | Design | Pending |
| PLAN-03 | P1: Gestão de planos | Design | Pending |
| PLAN-04 | P1: Gestão de planos | Design | Pending |
| PLAN-05 | P1: Gestão de planos | Design | Pending |
| PLAN-06 | P1: Gestão de planos | Design | Pending |

**Coverage:** 24 total, 0 mapped to tasks, 24 unmapped ⚠️ (mapeamento na fase de Tasks)

---

## Sources

- `PRD.md.txt` — SRS Yogue-se V1.0: seção 4.4 (cadastro de alunos), 4.5 (planos), 5.1 (horários fixos de aluno ativo), 8.6 (status aguardando matrícula sem plano), 13 (segurança), 16 (Fase 1)
- `.specs/STATE.md` — AD-004 (route groups), AD-006 (primeiro admin via seed), AD-008 (composição derivada), AD-012 (inglês no código), AD-034 (ordem: base do admin antes das experimentais)
- `.specs/features/admin-base/context.md` — decisões do usuário desta rodada

---

## Success Criteria

- [ ] Sem sessão, nenhuma rota do `(admin)` responde (redirect ao login comprovado por teste)
- [ ] Aluna criada com plano e horário fixo aparece no detalhe e ocupa vaga na grade; inativação libera a vaga sem reescrever dados
- [ ] Plano criado/editado/inativado pelo admin; valor nunca vem do código
- [ ] Suite verde, build e lint limpos
