# Admin Base Context

**Gathered:** 2026-11-11
**Spec:** `.specs/features/admin-base/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Login seguro do administrador, shell da área logada com navegação entre as telas
existentes (/grade, /creditos, /feriados) e as novas (/alunos, /planos), cadastro
de alunos com os campos e os 4 status do PRD 4.4, e gestão de planos do PRD 4.5.
Ordem estabelecida pela AD-034 (base do admin antes das experimentais).

---

## Implementation Decisions

### Escopo da feature

- User escolheu "Login + alunos + planos (Recommended)" — a base precisa permitir
  o dia a dia real: matricular aluna com plano e horário fixo, além do login.
- Dashboard (PRD 4.1) e calendário administrativo completo (PRD 4.2) ficam fora;
  o admin cai na /grade existente.

### Login do aluno

- User escolheu "Só admin agora (Recommended)" — a tabela de usuários nasce com
  role (ADMIN/ALUNO), mas o fluxo do aluno (conta criada pelo admin, credencial
  via WhatsApp, senha definida no 1º login — AD-006) entra com a área do aluno.

### Status do aluno

- User escolheu "4 status do PRD (Recommended)" — Experimental, Aguardando
  matrícula, Ativo, Inativo, substituindo o par ATIVO/INATIVO atual do enum.

---

## Agent's Discretion

- Stack de autenticação (hash de senha e sessão em cookie) — sem dependência
  nova pesada, coerente com o estilo do projeto.
- Guard das rotas (admin): middleware ou check no layout do route group.
- Tela de destino pós-login e organização visual do shell.

---

## Declined / Undiscussed Gray Areas → Assumptions

- Nenhuma recusada — as três áreas cinzas foram respondidas no turno.

---

## Specific References

- User: "Não seria melhor construir a base do admin pelo menos? Gostaria de já
  ter um frontend uma área logada para os admins, com o que já temos já daria
  pra usar bastante parte da plataforma"
- AD-006 (primeiro admin via seed; conta de aluno é criada pelo admin depois),
  AD-004 (route groups (admin)/(aluno)/(site)), AD-012 (identificadores em
  inglês, UI em português), PRD 4.4, 4.5, 13, 5.1.

---

## Deferred Ideas

- Dashboard com indicadores (PRD 4.1) — parcial hoje; melhor com experimentais.
- Calendário administrativo diária/semanal/mensal (PRD 4.2).
- Fluxo de conta do aluno (1º login, senha) — com a área do aluno.
- Troca de senha / recuperação de acesso.
- Bloqueio por horário específico (AD-032 — painel admin).
