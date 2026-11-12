# Core Experimentais Context

**Gathered:** 2026-11-12
**Spec:** `.specs/features/core-experimentais/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Módulo 8 do PRD: formulário público de solicitação de aula experimental, restrição de duplicidade por telefone, aprovação/recusa administrativa, alteração de data/horário, pagamento manual e contato via WhatsApp, cancelamento/falta com regra de 24 horas, ocupação compartilhada da vaga e conversão em aluna ativa com plano e horários fixos. Inclui o botão de acesso na home atual do site (PRD 10.5); o site institucional completo continua para a feature do site.

---

## Implementation Decisions

### Escopo do formulário público

- User escolheu "Público + admin agora" — a feature entrega o formulário mínimo em `/experimental` com a agenda de vagas e o painel administrativo; o site institucional completo continua para a feature do site.

### Ocupação e histórico

- User escolheu "Tabela EXPERIMENTALS" — a solicitação vive numa tabela própria do PRD 12, a experimental aprovada conta na composição da ocorrência e nenhuma aluna é criada antes da conversão.
- Motivo: o formulário público coleta só nome e telefone, enquanto `STUDENTS` exige e-mail e data de nascimento; a tabela separada preserva tentativas e histórico.

### Conversão em aluna

- User escolheu "Aluna ativa completa" — a ação "Converter em aluna" pede e-mail, data de nascimento, plano e horário(s) fixo(s), confere vaga e cria a aluna ATIVA com as matrículas fixas na mesma transação.
- O estado intermediário "aguardando matrícula" e o envio de acesso do PRD 8.6 ficam fora: a área da aluna ainda não existe (AD-037).

### Duplicidade por telefone

- User escolheu "Tudo menos recusada" — pendente, aprovada, cancelada ou falta bloqueiam nova solicitação do mesmo telefone; uma solicitação recusada pelo estúdio libera a pessoa.
- A tentativa bloqueada fica gravada como `DUPLICADA`, ligada à solicitação existente, e o admin consulta pelo telefone.

### Cancelamento e falta

- User escolheu "Admin, com 24h" — o admin registra em nome do visitante: 24 horas ou mais antes do início mantém o direito ao reagendamento do mesmo registro; menos de 24 horas e falta encerram o direito.
- Cancelamento pelo estúdio, feriado/recesso ou edição de dia/horário da turma não consome o direito.

### Escolha de data no formulário

- User escolheu "Data e horário da agenda" — o visitante escolhe uma ocorrência concreta futura, com modalidade e vagas; a aprovação confere a mesma vaga.
- Rascunho: pendente nunca ocupa vaga.

---

## Agent's Discretion

- Normalização do telefone: apenas dígitos, com remoção do código do país `55`; aceita 10 ou 11 dígitos.
- Janela da agenda do formulário público: próximos 30 dias.
- Modelo do histórico de reagendamento (a ocorrência anterior precisa ficar registrada).
- Rótulos e composição visual das telas; o projeto não trouxe capture.
- Mensagem de confirmação do envio e textos de erro fora dos termos fixados pelo PRD.
- A conversão usa nome e telefone da solicitação como vieram; correções cadastrais são feitas depois em `/alunos`.
- O preço de R$ 45,00 fica como constante de domínio nesta versão, sem cobrança automática.

---

## Declined / Undiscussed Gray Areas → Assumptions

- Pagamento não bloqueia aprovação nem conversão (PRD não condiciona).
- Não há ação separada de "registrar presença": a conversão grava `attended_at` (PRD 8.6 parte da experimental realizada).
- O histórico administrativo é o próprio registro da experimental (status + timestamps + histórico de reagendamentos), sem tabela de auditoria separada.
- Sem rate limit/anti-spam além da regra de duplicidade por telefone; o PRD não define limite.
- A declaração aceita é o texto gravado na solicitação; `requested_at` é o instante da aceitação.
- Solicitação pendente numa ocorrência bloqueada/cancelada vira `CANCELADA_COM_DIREITO` (o estúdio causou).
- O termo de status na tela segue o PRD ("Pendente de aprovação") e os demais são nomeados pelo produto.
- Reembolso é só um status manual; não há devolução financeira automática.

---

## Specific References

- User: "vamos seguir com a proxima feature" — próxima na ordem da AD-034 é experimentais (PRD módulo 8).
- PRD 8.1 (formulário, declaração, R$ 45,00), 8.2 (duplicidade por telefone normalizado e consulta de tentativas), 8.3 (aprovação, alteração de data/horário, consulta, pagamento, contato WhatsApp), 8.4 (pagamento manual: Pendente, Pago, Isento, Reembolsado), 8.5 (regra de 24h, reagendamento, falta), 8.6 (conversão em aluno), 10.5 (botão de acesso), 12 (EXPERIMENTALS), 13 (validação no servidor, transações, duplicidade), 15 (experimental duplicada/sem aprovação/aprovada lotada/aprovada ocupa vaga/conversão cria matrícula).
- AD-006 (sem integração de e-mail em v1), AD-008 (ocupação derivada), AD-012 (identificadores em inglês, UI em português), AD-023 (admin registra em nome do aluno), AD-026/027 (bloqueio cancela e não restaura), AD-035 (sessão admin exige papel).

---

## Deferred Ideas

- Site institucional completo (PRD 10.1-10.4).
- Área da aluna, login e envio de acesso (PRD 8.6 passos 2 e 9; AD-006).
- Notificações (PRD 12) e lembretes de experimental.
- Cobrança automática/pagamento online (PRD 8.4).
- Dashboard com indicadores de experimentais (PRD 4.1).
- Relatórios de experimentais.
- Preço da experimental configurável pelo admin.
- Rate limit/anti-spam do formulário público.
