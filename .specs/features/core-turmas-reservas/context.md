# Core Turmas e Reservas - Context

**Gathered:** 2026-11-06
**Spec:** `.specs/features/core-turmas-reservas/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Fundação operacional da plataforma: modalidades e turmas recorrentes,
ocorrências concretas (CLASS_SESSIONS), contagem derivada de vagas,
reserva transacional servidor-side e cadastro administrativo de
feriados/recessos que bloqueiam ocorrências. Slice vertical com UI
administrativa mínima, sem autenticação.

---

## Implementation Decisions

### Modelo de vagas (pergunta central do usuário)

- Pergunta do usuário: "precisamos conseguir responder a perguntas como:
  quantas pessoas vao nessa aula? quantas vagas ainda tem disponiveis?
  quais sao fixas, reposições e experimentais?"
- Resposta admitida (confirmada): contagem **derivada de fonte única** —
  fixos = FIXED_ENROLLMENTS ativos na data; reposições e experimentais =
  BOOKINGS ativos por tipo; vagas = capacity − soma.
- "Estou tentando entender: caso precisemos reservar vagas em turmas
  futuras para alunos nao fixos nelas, precisariamos gerar um horizonte
  fixo, ou quando fosse agendar criaria on demand?" → **on-demand na
  escrita**: get-or-create da sessão no momento do agendamento; nenhum job
  gerador, nenhum horizonte fixo.
- BOOKINGS FIXED por ocorrência futura: **não materializar** (ver AD-008).

### Stack e arquitetura (confirmadas nesta sessão)

- Next.js + TypeScript (AD-001), Postgres gerenciado + Drizzle (AD-002),
  Vitest (AD-003), monolito modular (AD-004), qual plataforma transplant
  no STATE.md.

### Slice vertical sem auth

- Escolha do usuário: "Vertical slice sem auth (Recommended)" — domínio +
  serviços + server actions + tela admin mínima (turmas e reservas).
- Autenticação/perfis ficam em feature própria.

### Agent's Discretion

- Organização interna de telas mínimas de admin (layout da UI fica para o
  design system; sem referência visual binding nesta feature).
- Estrutura das migrations do núcleo (ordem das tabelas, índices técnicos
  além da integridade expressa no spec).

### Declined / Undiscussed Gray Areas → Assumptions

- Nenhum recusado. Defaults não perguntados ficam registrados na tabela
  "Assumptions & Open Questions" do spec para correção no review.

---

## Specific References

- PRD exemplo de turma: "Terça-feira, 19h – Superioga Clássico" com
  contagem fixos/reposições/experimentais 5/2/1 e "Vagas 0" — deve sair
  exatamente dessa query derivada (seção 4.2 do PRD).
- Regra de adicional: o usuário quer responder as 3 perguntas do negócio
  na própria ocorrência (composição por vínculo).

---

## Deferred Ideas

- Regra de 24 horas e créditos (PRD módulo 6) — feature seguinte.
- Fluxo de aprovação de experimentais (PRD módulo 8) — feature própria.
- Autenticação e perfis (PRD seções 2 e 13) — feature própria.
- Calendário completo com 3 visualizações (PRD 4.2) — a UI mínima desta
  slice cobre leitura de uma turma/ocorrência; calendário completo vem
  nas fases de painel.
- Notificações, e-mail, integração WhatsApp, pagamentos, relatórios,
  Pato Yoga Club — fases 3/4 do PRD.
