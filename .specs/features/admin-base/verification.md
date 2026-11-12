# Admin Base verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 809b7f4 (HEAD 842ca64 é docs-only — `git diff 809b7f4..842ca64 --stat` mostra só `proofs.md`/`tasks.md`; o código testado é o do HEAD)
**Verifier**: independent sub-agent (author != verifier)

> **Fechamento (autor, 2026-11-12)**: os 6 findings foram fechados em uma passada - um commit por
> finding, cada um com teste/critério novos (AUTH-09, STUD-09, STUD-10, STUD-11; checks C25-C30).
> `check_proofs.py` re-rodou no HEAD `1e19399`: **32/32 pass** (incluindo o Build, que flagou um
> erro de tipo no fix do F4 - corrigido em `1e19399`). Walk re-executado no banco resetado:
> **27/27 PASS**, agora incluindo C30. Suíte completa: **267 testes verdes** (era 262 no round 1).

Notas de estado: árvore com os artefatos esperados (`proofs.md` de features anteriores) e a nota de dispatch do Verifier em `tasks.md` — nada de código modificado.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | walk - visit à /grade deslogada cai no /login (corroborado por `session.int.test.ts` `requireAdminSession sem sessao redireciona ao /login (AUTH-01)` e `src/app/(admin)/layout.tsx:26-29`) | yes |
| C2 | walk - login com a credencial do seed termina na /grade (corroborado por `actions.int.test.ts` `login valido inicia a sessao e redireciona a /grade (AUTH-02)`) | yes |
| C3 | `actions.int.test.ts` `credencial invalida devolve exatamente a mensagem generica, sem sessao (AUTH-03)` - `toEqual({ error: "E-mail ou senha inválidos" })` nos dois ramos, jar vazio | yes |
| C4 | `actions.int.test.ts` `recusa campo vazio e e-mail invalido no servidor, sem tocar cookies (AUTH-04)` - 4 entradas recusadas + `jar.size === 0` | yes |
| C5 | `password.test.ts` `hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash` - formato `scrypt:salt:hash` hex e `not.toContain` (reforçado pelo seed int e por `credentials.int.test.ts` `hash sem o formato scrypt nunca autentica`) | yes |
| C6 | walk - clique em Sair desloga e /grade volta a redirecionar (corroborado por `actions.int.test.ts` `Sair limpa o cookie e volta ao /login (AUTH-06)` e `session.int.test.ts` `Sair limpa o cookie (AUTH-06)`) | yes |
| C7 | walk - logada, /login redireciona à /grade (corroborado por `src/app/login/page.tsx:10-13`, que redireciona qualquer sessão existente) | yes |
| C8 | `seed.int.test.ts` `admin idempotente com hash verificavel (AUTH-08)` - seed 2x, exatamente 1 admin, `verifyPassword` true e hash sem a senha | yes |
| C9 | walk - nav do (admin) alcança as 5 telas (corroborado por `NAV_LINKS` com os 5 hrefs + formulário de `logoutAction` em `src/app/(admin)/layout.tsx:8-14,44-51`) | yes |
| C10 | walk - nome da admin aparece no header (`layout.tsx:60-62` busca o nome do `users` pelo `session.userId` e renderiza) | yes |
| C11 | `students.int.test.ts` `cria aluna com todos os campos do cadastro (STUD-01)` - re-lê do banco e afirma cada campo (nome, telefone, e-mail, nascimento, matrícula, plano, status, notas) | yes |
| C12 | `students.int.test.ts` `recusa cadastro sem campo obrigatorio com erro do campo (STUD-02)` - `field` específico em cada caso + zero linhas gravadas (dobrado no unit `validators.test.ts`) | yes |
| C13 | `students.int.test.ts` `aceita os 4 status do PRD no cadastro (STUD-03)` - os 4 valores persistidos (ATIVO condicionado ao plano; dobrado no unit, incluindo status fora da lista) | yes |
| C14 | `students.int.test.ts` `recusa e-mail duplicado com erro proprio (STUD-04)` - `field: "email"`, mensagem própria, 1 linha apenas | yes |
| C15 | `students.int.test.ts` `edita a aluna e a mudanca aparece na listagem (STUD-05)` - update + re-leitura via `listStudents` | yes |
| C16 | `composition.int.test.ts` `matricula de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07)` - afirma fixedCount/vagas nos 3 estados e matrícula intacta | yes |
| C17 | mesmo teste de C16 - o ramo de reativação afirma `fixedCount 1` / `availableSpots 0` e a matrícula ATIVA sem reescrita | yes |
| C18 | `students.int.test.ts` `perfil agrega fixos, creditos e historico (STUD-08)` - afirma os 4 blocos, inclusive crédito DISPONIVEL com vencimento futuro | yes |
| C19 | `plans.int.test.ts` `cria plano completo com nome, valor, frequencia, descricao e status (PLAN-01)` - re-lê do banco | yes |
| C20 | `plans.int.test.ts` `recusa valor e frequencia invalidos com erro por campo (PLAN-02)` + unit `validators.test.ts` cobre negativo, não-numérico, zero e acumulação | yes |
| C21 | `plans.int.test.ts` `edita plano e reflete a mudanca na listagem (PLAN-03)` - update + `listPlans` | yes |
| C22 | `plans.int.test.ts` `inativa via update e o seletor omite o plano (PLAN-04)` - seletor vazio após INATIVO (e o teste irmão prova o plano atual mantido em edição) | yes |
| C23 | `students.int.test.ts` `perfil mostra o plano mesmo depois de inativado (PLAN-05)` - perfil devolve o plano com status INATIVO | yes |
| C24 | walk - plano criado com valor X aparece na /planos com X (`planos/page.tsx:11-18` formata `plan.price` vindo de `listPlansAction`/banco; sem tabela de preços no código) | yes |
| C25 | `credentials.int.test.ts` `credenciais de role ALUNO nao autenticam no admin (AUTH-09)` - usuário com senha correta e role ALUNO devolve `{ ok: false }` idêntico ao desconhecido; layout do `(admin)` usa `requireAdminSession` (papel verificado, provado em `session.int.test.ts`) e walk C1 re-prova o redirect. *Linha adicionada pelo autor no fechamento (check novo do round de findings)* | yes |
| C26 | `students.int.test.ts` `reativar aluna sem plano e recusado e com plano funciona (STUD-09)` - sem plano: `field: "planId"`, erro "plano obrigatorio"; com plano vinculado: ATIVO gravado. *Linha adicionada pelo autor no fechamento* | yes |
| C27 | `plans.int.test.ts` `edita limpa a descricao e manter omitido preserva (PLAN-03)` - `""` grava `null`; chamada sem `description` (inativação) preserva. *Linha adicionada pelo autor no fechamento* | yes |
| C28 | `students.int.test.ts` `e-mail igual diferindo so em maiusculas e duplicado (STUD-10)` - recusa no cadastro e na edição, zero e-mails em caixa original gravados. *Linha adicionada pelo autor no fechamento* | yes |
| C29 | `students.int.test.ts` `plano inexistente e recusado com erro do campo, sem estourar FK (STUD-11)` - create e update com uuid inexistente: `field: "planId"`, "plano nao encontrado", 1 linha só. *Linha adicionada pelo autor no fechamento* | yes |
| C30 | walk round 2 - `select de status oferece exatamente Experimental, Aguardando matrícula, Ativo e Inativo` (PASS, asserção de igualdade exata sobre os labels). *Linha adicionada pelo autor no fechamento* | yes |

Todos os 24 checks seguram: o teste nomeado pela prova falharia se a afirmação fosse falsa, e as asserções são tão fortes quanto os critérios (C3 usa `toEqual` exato; C11/C19 re-lêem do banco; C16/C17 provam os dois branches L-015 nos dois caminhos da composição — matrícula e reserva FIXED, incluindo o fix 809b7f4).

Os findings abaixo não invalidam nenhum check: são buracos em regras do diff que nenhum check nomeou, achados lendo o código.

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 (Major) - O guard do layout não verifica o papel da sessão e `verifyCredentials` não filtra por role: uma sessão válida de role ALUNO renderiza todas as telas do `(admin)`, e um login de usuário não-ADMIN inicia sessão | `src/app/(admin)/layout.tsx:26-29` usa `getSession()` e só rejeita `null` (o `requireAdminSession()` de `src/modules/auth/services/session.ts:41-47`, que verifica `role !== "ADMIN"`, só é usado nas actions); `src/modules/auth/services/credentials.ts:21-33` autentica qualquer linha de `users`, e `loginAction` grava o cookie com `result.user.role` (`src/modules/auth/actions.ts:48-57`). Hoje não há login de aluno (out of scope), mas o enum ALUNO já existe e a sessão de ALUNO é provada passível no domínio (`session.int.test.ts` `sessao de ALUNO nao passa no guard do admin` cobre só a action, não a página) | Usar `requireAdminSession()` no layout e recusar (ou filtrar) role não-ADMIN em `verifyCredentials`/`loginAction`, com teste de usuário role ALUNO tentando logar e abrir uma tela do `(admin)` | 94d70dc - fix(auth): admin-only login and role-checked layout guard; check C25 (AUTH-09, teste `credenciais de role ALUNO nao autenticam no admin`) e o layout agora usa o guard com papel verificado (coberto pelos testes de `requireAdminSession` + walk C1) |
| F2 (Major) - `setStudentStatus` aceita ATIVO sem plano: o botão "Reativar" torna Ativa uma aluna Experimental/Aguardando matrícula sem plano, quebrando o invariante "plano obrigatório quando status = Ativo" | `src/modules/students/services/students.ts:207-220` atualiza o status sem chamar `validateStudent` nem checar `planId`; `src/app/(admin)/alunos/student-forms.tsx:265-270` (`StudentStatusButton`) envia `ATIVO` para qualquer status não-ATIVO. O invariante é exigido em `src/modules/students/domain/validators.ts:80-85` só nos caminhos create/update (testados); nenhum teste cobre o caminho do status | Validar o requisito de plano no `setStudentStatus` (ou na action) com erro de campo, e testar os dois branches (com plano ok; sem plano recusado) | 1e3c822 - fix(students): reactivation requires a plan like the registration does; check C26 (STUD-09, teste `reativar aluna sem plano e recusado e com plano funciona`, dois branches L-015) |
| F3 (Minor) - STUD-03 fixa os quatro valores com os termos do PRD 4.4 ("Ativo", "Inativo"); a tela oferece/renderiza "Ativa"/"Inativa" | `src/app/(admin)/alunos/student-forms.tsx:32-33` (opções do select) e `src/app/(admin)/alunos/page.tsx:17-18` + `src/app/(admin)/alunos/[id]/page.tsx:20-21` (labels de listagem/detalhe). Os valores do enum estão corretos; é só a palavra exibida | Ajustar os labels para os termos do PRD (ou registrar a diferença como aprovada no spec) | 78eb0ad - fix(students): screen shows the exact PRD status terms; check C30 (walk round 2: `select de status oferece exatamente Experimental, Aguardando matrícula, Ativo e Inativo` - PASS) |
| F4 (Minor) - `updatePlan` não consegue limpar a descrição: PLAN-03 ("persistir as mudanças") não se cumpre para a remoção da descrição | `src/modules/plans/services/plans.ts:129` usa `input.description ?? current.description`, e o formulário manda `"" → null` (`src/app/(admin)/planos/plan-forms.tsx:124`), que cai no fallback e mantém a descrição antiga | Tratar string vazia como limpeza da descrição (ou documentar que descrição não é removível) e testar | 1594143 - fix(plans): empty description clears the field on edit; check C27 (PLAN-03, teste `edita limpa a descricao e manter omitido preserva`); tipo `null` do input corrigido em 1e19399 (o Build do check_proofs flagou) |
| F5 (Minor) - Unicidade de e-mail de aluna é case-sensitive: "Ana@Teste.com" e "ana@teste.com" coexistem, embora o e-mail seja a identidade de acesso futura (normalizada no login) | `src/modules/students/services/students.ts:87-92` (`emailTaken` compara texto exato) + constraint `students_email_unique` case-sensitive (`drizzle/0002_easy_mariko_yashida.sql:38`); a normalização só existe em `credentials.ts:17-19` (tabela `users`). Nenhum AC exige — decisão do autor se vale para a área do aluno | Normalizar (trim+lowercase) o e-mail no cadastro de aluna ou usar constraint unique funcional; ou registrar decisão em contrário | 39cdce4 - fix(students): student email uniqueness ignores letter case; check C28 (STUD-10, teste `e-mail igual diferindo so em maiusculas e duplicado`, caminhos create+update) |
| F6 (Minor) - `createStudent`/`updateStudent` tratam só violação de UNIQUE; `planId` inexistente (ou apontando para plano excluído) estoura a FK `students_plan_id_plans_id_fk` sem tratamento (500) numa action autenticada | `src/modules/students/services/students.ts:119-143` e `195-200` (catch só de `isUniqueViolation`); FK em `drizzle/0002_easy_mariko_yashida.sql:36`. Inalcançável pelo formulário (o select só lista planos existentes), mas a server action é um endpoint POST alcançável com sessão | Validar existência do `planId` no validador/service com erro de campo e testar | 717ec90 - fix(students): missing plan refuses with a field error, not the FK; check C29 (STUD-11, teste `plano inexistente e recusado com erro do campo, sem estourar FK`, create+update) |
