# Core Experimentais Specification

**Approved**: 2026-11-12 - user: "bora"

## Problem Statement

O módulo de aulas experimentais é a porta de entrada de novas alunas e a última
peça operacional da Fase 1 (PRD 16), mas hoje não existe: o site não recebe
solicitação, o painel não aprova, não controla pagamento nem converte a
experimental em matrícula. Sem ele, o estúdio continua fazendo esse fluxo fora
da plataforma e a vaga da experimental não entra na ocupação compartilhada.

## Goals

- [ ] Visitante solicita uma aula experimental pelo site, vê o valor de R$ 45,00 e a declaração obrigatória, e o sistema bloqueia duplicidade pelo telefone normalizado
- [ ] Admin aprova somente com vaga, altera data/horário, registra pagamento e contato via WhatsApp, e a experimental aprovada ocupa vaga na grade e na agenda pública
- [ ] Admin registra cancelamento/falta com a regra de 24 horas e reagenda quem manteve o direito
- [ ] Conversão em aluna cria a aluna ATIVA com plano e horários fixos, com vaga conferida e histórico da experimental preservado

## Out of Scope

| Feature | Reason |
| --- | --- |
| Site institucional completo (PRD 10.1-10.4) | Feature do site; aqui entra só o controle de acesso ao formulário na home atual |
| Login, conta e área da aluna (PRD 8.6 passos 2 e 9) | Depende da área da aluna (AD-006); a conversão cria a aluna ativa sem acesso (AD-037) |
| Cobrança automática e pagamento online (PRD 8.4) | PRD manda controle manual na primeira versão |
| Notificações (PRD 12) e lembretes | Feature de notificações |
| Dashboard com indicadores de experimentais (PRD 4.1) | Feature do dashboard |
| Preço da experimental configurável | PRD 8.4 fixa o valor inicial; sem requisito de configuração |
| Rate limit e anti-spam do formulário | PRD não define limite; a regra de duplicidade por telefone é a única barreira |
| Ação separada de registrar presença | A conversão grava a realização (`attended_at`), como o PRD 8.6 pressupõe |
| Exclusão física de experimentais | Histórico preservado por status (PRD 8.6 e 13) |
| Relatórios de experimentais | Fase 4 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Janela do formulário público | Próximos 30 dias | Mesma janela prática da agenda pública; o PRD não fixa horizonte | n |
| Normalização do telefone | Somente dígitos; código do país `55` removido; aceita 10 ou 11 dígitos | PRD 8.2 exige normalizar antes de comparar; formato brasileiro | n |
| O que o visitante escolhe | Ocorrência concreta (data, horário e modalidade) com vaga | A aprovação confere a vaga da mesma ocorrência (AD-040) | y |
| Nome e telefone na conversão | Vêm da solicitação; correções depois em `/alunos` | Evita duplicar o formulário de aluna e preserva a origem | n |
| Pagamento | Não bloqueia aprovação nem conversão | O PRD não condiciona os dois ao pagamento | n |
| Preço | Constante de domínio R$ 45,00; sem cobrança automática | PRD 8.4 fixa o valor inicial e manda controle manual | n |
| Histórico administrativo | Status, timestamps e histórico de reagendamentos | PRD 12 não tem tabela de auditoria de experimentais | n |
| Presença | A conversão grava `attended_at` quando vazio | PRD 8.6 parte da experimental realizada; sem ação separada | n |
| Solicitação pendente em ocorrência bloqueada/cancelada | Vira `CANCELADA_COM_DIREITO` | O estúdio causou a impossibilidade; o direito não é consumido (AD-039) | y |
| Reembolso | Apenas status manual | PRD 8.4 pede controle manual | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Solicitação pública de experimental ⭐ MVP

**User Story**: Como visitante do site, quero solicitar uma aula experimental informando meus dados e aceitando a declaração de saúde para conhecer o estúdio por R$ 45,00.

**Why P1**: PRD 8.1 é a entrada do módulo e o PRD 10.5 pede o botão na home.

**Acceptance Criteria**:

1. WHEN o visitante abre a home do site THEN o sistema SHALL oferecer um controle que leva ao formulário de experimental  <!-- event-driven -->
2. WHEN o visitante abre o formulário THEN o sistema SHALL mostrar os campos nome completo, telefone, modalidade, dia e horário desejados, a declaração obrigatória e o valor R$ 45,00 antes do envio  <!-- event-driven -->
3. O sistema SHALL exibir a declaração com o texto exato "Declaro estar em condições de saúde aptas à prática de yoga e me comprometo a informar à professora qualquer condição ou limitação relevante para a realização das atividades." e tratá-la como obrigatória  <!-- ubiquitous -->
4. WHEN o formulário carrega THEN o sistema SHALL listar apenas ocorrências futuras de turmas e modalidades ativas, com status AGENDADA e pelo menos uma vaga, mostrando data, horário, modalidade e vagas de cada opção, filtradas pela modalidade escolhida  <!-- event-driven -->
5. IF não houver ocorrência futura com vaga THEN o sistema SHALL mostrar um estado vazio e não permitir o envio  <!-- unwanted-behavior -->
6. WHEN o visitante envia nome, telefone, modalidade, ocorrência e declaração THEN o sistema SHALL criar a solicitação com status `PENDENTE`, pagamento `PENDENTE`, declaração gravada e `requested_at` do envio  <!-- event-driven -->
7. IF nome, telefone, modalidade, ocorrência ou declaração faltam ou são inválidos THEN o sistema SHALL recusar no servidor com erro específico do campo  <!-- unwanted-behavior -->
8. IF o telefone normalizado já possui solicitação anterior com status diferente de `RECUSADA` THEN o sistema SHALL recusar a nova solicitação com mensagem clara de experimental já existente  <!-- unwanted-behavior -->
9. WHEN uma solicitação é recusada por duplicidade THEN o sistema SHALL gravar a tentativa bloqueada como `DUPLICADA`, ligada à solicitação existente e com o telefone normalizado, para consulta do admin  <!-- event-driven -->
10. O sistema SHALL normalizar o telefone para somente dígitos, removendo o código do país `55`, antes de comparar ou gravar o identificador  <!-- ubiquitous -->
11. WHILE uma solicitação está `PENDENTE` ela SHALL NOT ocupar vaga na ocorrência  <!-- state-driven -->
12. WHEN a solicitação é criada THEN o sistema SHALL mostrar confirmação de recebimento, informando que ela aguarda aprovação e que o estúdio fará contato via WhatsApp  <!-- event-driven -->
13. A página pública SHALL NOT exibir nome, telefone ou qualquer dado de outra pessoa  <!-- ubiquitous -->
14. WHEN duas submissões concorrentes do mesmo telefone chegam THEN o sistema SHALL aceitar exatamente uma e registrar a outra como tentativa `DUPLICADA`  <!-- event-driven -->
15. IF a ocorrência escolhida está bloqueada, cancelada, no passado, sem vaga ou é de turma/modalidade inativa no momento do envio THEN o sistema SHALL recusar a solicitação no servidor  <!-- unwanted-behavior -->
16. O sistema SHALL considerar a declaração aceita no instante da solicitação, gravando o texto exibido e `requested_at`  <!-- ubiquitous -->

**Independent Test**: abrir `/experimental`, escolher uma ocorrência com vaga, enviar com a declaração marcada e ver a confirmação; repetir com o mesmo telefone e ver o bloqueio; variar a máscara do telefone e continuar bloqueado.

---

### P1: Aprovação e gestão administrativa ⭐ MVP

**User Story**: Como administradora, quero ver as solicitações, aprovar só com vaga, recusar, mudar data/horário, registrar pagamento e contato via WhatsApp para operar o módulo.

**Why P1**: PRD 8.3 e 8.4 são o centro operacional do módulo.

**Acceptance Criteria**:

17. WHEN o admin abre `/experimentais` THEN o sistema SHALL listar as solicitações com nome, telefone, data/horário, modalidade, status, pagamento e data da solicitação  <!-- event-driven -->
18. WHEN o admin busca por telefone THEN o sistema SHALL mostrar todas as tentativas daquele telefone normalizado, incluindo `DUPLICADA`, `RECUSADA`, canceladas, falta e convertidas  <!-- event-driven -->
19. WHEN o admin abre uma solicitação THEN o sistema SHALL mostrar nome, telefone, modalidade, data/horário, declaração, status, pagamento, timestamps de solicitação/aprovação/cancelamento/contato/realização e, quando houver, a aluna convertida  <!-- event-driven -->
20. WHEN o admin aprova uma solicitação `PENDENTE` com vaga THEN o sistema SHALL revalidar a disponibilidade, gravar `APROVADA` com `approved_at` e ocupar a vaga  <!-- event-driven -->
21. IF a aprovação encontra a ocorrência sem vaga, bloqueada, cancelada ou de turma/modalidade inativa THEN o sistema SHALL recusar com erro claro e manter a solicitação `PENDENTE`  <!-- unwanted-behavior -->
22. WHEN duas aprovações concorrem pela última vaga da mesma ocorrência THEN o sistema SHALL confirmar exatamente uma  <!-- event-driven -->
23. WHEN o admin recusa uma solicitação THEN o sistema SHALL gravá-la como `RECUSADA`, liberar a pessoa para uma nova solicitação e manter o registro consultável  <!-- event-driven -->
24. WHEN o admin altera a data ou o horário THEN o sistema SHALL oferecer ocorrências futuras com vaga e revalidar a disponibilidade; `PENDENTE` continua `PENDENTE`, `APROVADA` troca a vaga ocupada de forma atômica, e sem vaga no novo horário a alteração é recusada mantendo a anterior  <!-- event-driven -->
25. WHEN o admin registra o pagamento THEN o sistema SHALL gravar exatamente um dos status `PENDENTE`, `PAGO`, `ISENTO` ou `REEMBOLSADO`  <!-- event-driven -->
26. WHEN o admin registra contato via WhatsApp THEN o sistema SHALL gravar o instante do contato e exibi-lo no detalhe  <!-- event-driven -->
27. O sistema SHALL exibir o valor de R$ 45,00 no formulário público e no detalhe administrativo da experimental  <!-- ubiquitous -->
28. Toda action administrativa de experimental SHALL exigir sessão de administrador no servidor  <!-- ubiquitous -->
29. WHEN uma action administrativa termina THEN a tela SHALL mostrar o resultado de sucesso ou o erro, mantendo a lista consultável  <!-- event-driven -->
30. WHEN o admin abre `/experimentais` sem solicitações THEN o sistema SHALL mostrar um estado vazio claro  <!-- event-driven -->
31. WHEN o admin aciona recusar, cancelar sem direito, registrar falta ou converter THEN o sistema SHALL pedir confirmação antes de aplicar a ação  <!-- event-driven -->
32. O sistema SHALL exibir os status com os termos exatos "Pendente de aprovação", "Aprovada", "Recusada", "Cancelada com direito a reagendamento", "Cancelada sem direito a reagendamento", "Falta", "Convertida em aluna" e "Tentativa duplicada"  <!-- ubiquitous -->
33. O sistema SHALL exibir os status de pagamento com os termos exatos "Pendente", "Pago", "Isento" e "Reembolsado"  <!-- ubiquitous -->

**Independent Test**: com uma solicitação pendente, aprovar quando há vaga e ver a vaga cair; tentar aprovar outra na última vaga e ver a recusa; registrar Pago e contato WhatsApp; mudar o horário de uma aprovada e ver a vaga trocar.

---

### P1: Cancelamento, falta e ocupação compartilhada ⭐ MVP

**User Story**: Como administradora, quero registrar cancelamento ou falta com a regra de 24 horas e ver a experimental ocupando a vaga junto com fixos e reposições.

**Why P1**: PRD 8.5 define a regra de 24 horas e PRD 15 exige que a aprovada ocupe vaga.

**Acceptance Criteria**:

34. WHEN o admin registra cancelamento com 24 horas ou mais de antecedência do início THEN o sistema SHALL gravar `CANCELADA_COM_DIREITO`, liberar a vaga e manter o direito ao reagendamento no mesmo registro  <!-- event-driven -->
35. WHEN o admin registra cancelamento com menos de 24 horas de antecedência THEN o sistema SHALL gravar `CANCELADA_SEM_DIREITO`, liberar a vaga e encerrar o direito ao reagendamento  <!-- event-driven -->
36. WHEN o admin registra falta THEN o sistema SHALL gravar `FALTA`, liberar a vaga e encerrar o direito ao reagendamento, somente depois do início da ocorrência  <!-- event-driven -->
37. IF o início da ocorrência já passou THEN o sistema SHALL recusar o cancelamento e indicar o registro de falta como caminho  <!-- unwanted-behavior -->
38. IF a solicitação está em `RECUSADA`, `CANCELADA_SEM_DIREITO`, `FALTA`, `CONVERTIDA` ou `DUPLICADA` THEN o sistema SHALL recusar cancelamento e reagendamento  <!-- unwanted-behavior -->
39. WHEN o admin reagenda uma `CANCELADA_COM_DIREITO` THEN o sistema SHALL exigir ocorrência futura com vaga, gravar a ocorrência anterior no histórico de reagendamentos, trocar a ocorrência e gravar `APROVADA` na mesma transação  <!-- event-driven -->
40. IF o novo horário do reagendamento não tem vaga THEN o sistema SHALL recusar e manter status e direito anteriores  <!-- unwanted-behavior -->
41. A composição da ocorrência SHALL contar como experimentais somente as solicitações `APROVADA`, somando-as a fixos e reposições e descontando-as das vagas  <!-- ubiquitous -->
42. WHILE uma experimental está `PENDENTE`, `RECUSADA`, `CANCELADA_COM_DIREITO`, `CANCELADA_SEM_DIREITO`, `FALTA`, `CONVERTIDA` ou `DUPLICADA` ela SHALL NOT contar na ocupação  <!-- state-driven -->
43. A grade do admin SHALL contar e listar as experimentais `APROVADA` na ocorrência, com o nome da pessoa e o vínculo "experimental"  <!-- ubiquitous -->
44. A agenda pública SHALL refletir a vaga subtraída pela experimental aprovada pela mesma composição  <!-- ubiquitous -->
45. WHEN uma ocorrência é bloqueada por feriado/recesso, cancelada pelo estúdio ou cancelada pela edição de dia/horário da turma THEN as experimentais `PENDENTE` e `APROVADA` dela SHALL virar `CANCELADA_COM_DIREITO`, liberar a vaga e manter o direito  <!-- event-driven -->
46. WHEN um bloqueio é removido THEN as experimentais canceladas SHALL NOT ser restauradas automaticamente  <!-- event-driven -->
47. Após um cancelamento com direito, uma nova solicitação pública do mesmo telefone SHALL ser recusada; o direito SHALL ser exercido reagendando o mesmo registro  <!-- ubiquitous -->
48. Uma solicitação `RECUSADA` SHALL NOT bloquear uma nova solicitação do mesmo telefone  <!-- ubiquitous -->
49. As tentativas `DUPLICADA` SHALL ser somente leitura, sem ações de aprovação, recusa, cancelamento, reagendamento ou conversão  <!-- ubiquitous -->

**Independent Test**: aprovar uma experimental e ver a vaga cair na grade e na agenda; cancelar com 24h e reagendar; cancelar com 23h59 e ver o direito perdido; bloquear a ocorrência e ver a aprovada virar cancelada com direito; registrar falta depois do início.

---

### P1: Conversão em aluna ⭐ MVP

**User Story**: Como administradora, quero converter a experimental realizada em aluna ativa com plano e horários fixos para fechar a captação sem redigitar o cadastro.

**Why P1**: PRD 8.6 e o critério "Conversão em aluno cria matrícula e horários fixos" (PRD 15).

**Acceptance Criteria**:

50. WHEN o admin converte uma experimental `APROVADA` cuja ocorrência já terminou THEN o sistema SHALL criar aluna `ATIVO` com nome e telefone da solicitação, e-mail e data de nascimento informados, data de matrícula de hoje, plano escolhido e declaração de saúde copiada  <!-- event-driven -->
51. O formulário de conversão SHALL exigir e-mail, data de nascimento, um plano ativo cadastrado e ao menos um horário fixo ativo  <!-- ubiquitous -->
52. IF o e-mail é inválido ou já cadastrado, ignorando diferença de maiúsculas THEN o sistema SHALL recusar com erro do campo e não criar nada  <!-- unwanted-behavior -->
53. IF o plano escolhido não existe ou está inativo THEN o sistema SHALL recusar com erro do campo  <!-- unwanted-behavior -->
54. WHEN a conversão valida os horários fixos THEN o sistema SHALL conferir vaga na próxima ocorrência de cada horário e, se qualquer um não tiver vaga, recusar nomeando o horário e não criar nada  <!-- event-driven -->
55. A conversão SHALL ser transacional: aluna, matrículas fixas e status da experimental gravam juntos ou nada é gravado  <!-- ubiquitous -->
56. IF a ocorrência da experimental ainda não terminou ou o status não é `APROVADA` THEN o sistema SHALL recusar a conversão  <!-- unwanted-behavior -->
57. WHEN a conversão conclui THEN o sistema SHALL gravar a experimental como `CONVERTIDA`, com `converted_student_id` e `attended_at` quando vazio, mantendo o histórico  <!-- event-driven -->
58. WHEN a conversão conclui THEN a aluna SHALL aparecer em `/alunos` com status Ativo, plano e horários fixos, ocupando vagas  <!-- event-driven -->
59. IF a experimental já está `CONVERTIDA` THEN uma nova conversão SHALL ser recusada  <!-- unwanted-behavior -->
60. O histórico da experimental SHALL continuar consultável depois da conversão, incluindo o vínculo com a aluna criada  <!-- ubiquitous -->
61. A aluna criada SHALL NOT receber acesso ou login nesta versão  <!-- ubiquitous -->

**Independent Test**: aprovar uma experimental no passado, converter com plano e dois horários fixos e ver a aluna em `/alunos` com as matrículas; tentar converter com um horário lotado e ver que nada foi criado; converter de novo e ver a recusa.

---

## Edge Cases

- IF duas submissões do mesmo telefone chegam ao mesmo tempo THEN o sistema SHALL aceitar uma e registrar a outra como `DUPLICADA` (EXP-14).
- IF a solicitação pendente está numa ocorrência que fica lotada antes da aprovação THEN a aprovação SHALL falhar e a solicitação SHALL permanecer pendente para outro horário (EXP-21).
- IF a experimental aprovada está na última vaga e outra aprovação concorre THEN só uma SHALL ocupar (EXP-22).
- IF a conversão escolhe dois horários fixos e o segundo está lotado THEN nenhuma aluna nem matrícula SHALL ser criada (EXP-54, EXP-55).
- IF o e-mail da conversão difere de um existente apenas por maiúsculas THEN SHALL ser recusado (EXP-52).
- IF o telefone é digitado com máscara diferente THEN a comparação SHALL usar o telefone normalizado (EXP-10).
- IF a ocorrência da experimental é bloqueada depois da aprovação THEN a experimental SHALL virar `CANCELADA_COM_DIREITO` e o desbloqueio SHALL NOT restaurá-la (EXP-45, EXP-46).
- IF a falta é registrada antes do início da ocorrência THEN SHALL ser recusada (EXP-36).
- IF o admin tenta cancelar uma experimental já convertida THEN SHALL ser recusado (EXP-38).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| EXP-01 | P1: Solicitação pública | Design | Pending |
| EXP-02 | P1: Solicitação pública | Design | Pending |
| EXP-03 | P1: Solicitação pública | Design | Pending |
| EXP-04 | P1: Solicitação pública | Design | Pending |
| EXP-05 | P1: Solicitação pública | Design | Pending |
| EXP-06 | P1: Solicitação pública | Design | Pending |
| EXP-07 | P1: Solicitação pública | Design | Pending |
| EXP-08 | P1: Solicitação pública | Design | Pending |
| EXP-09 | P1: Solicitação pública | Design | Pending |
| EXP-10 | P1: Solicitação pública | Design | Pending |
| EXP-11 | P1: Solicitação pública | Design | Pending |
| EXP-12 | P1: Solicitação pública | Design | Pending |
| EXP-13 | P1: Solicitação pública | Design | Pending |
| EXP-14 | P1: Solicitação pública | Design | Pending |
| EXP-15 | P1: Solicitação pública | Design | Pending |
| EXP-16 | P1: Solicitação pública | Design | Pending |
| EXP-17 | P1: Aprovação e gestão | Design | Pending |
| EXP-18 | P1: Aprovação e gestão | Design | Pending |
| EXP-19 | P1: Aprovação e gestão | Design | Pending |
| EXP-20 | P1: Aprovação e gestão | Design | Pending |
| EXP-21 | P1: Aprovação e gestão | Design | Pending |
| EXP-22 | P1: Aprovação e gestão | Design | Pending |
| EXP-23 | P1: Aprovação e gestão | Design | Pending |
| EXP-24 | P1: Aprovação e gestão | Design | Pending |
| EXP-25 | P1: Aprovação e gestão | Design | Pending |
| EXP-26 | P1: Aprovação e gestão | Design | Pending |
| EXP-27 | P1: Aprovação e gestão | Design | Pending |
| EXP-28 | P1: Aprovação e gestão | Design | Pending |
| EXP-29 | P1: Aprovação e gestão | Design | Pending |
| EXP-30 | P1: Aprovação e gestão | Design | Pending |
| EXP-31 | P1: Aprovação e gestão | Design | Pending |
| EXP-32 | P1: Aprovação e gestão | Design | Pending |
| EXP-33 | P1: Aprovação e gestão | Design | Pending |
| EXP-34 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-35 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-36 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-37 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-38 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-39 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-40 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-41 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-42 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-43 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-44 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-45 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-46 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-47 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-48 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-49 | P1: Cancelamento e ocupação | Design | Pending |
| EXP-50 | P1: Conversão em aluna | Design | Pending |
| EXP-51 | P1: Conversão em aluna | Design | Pending |
| EXP-52 | P1: Conversão em aluna | Design | Pending |
| EXP-53 | P1: Conversão em aluna | Design | Pending |
| EXP-54 | P1: Conversão em aluna | Design | Pending |
| EXP-55 | P1: Conversão em aluna | Design | Pending |
| EXP-56 | P1: Conversão em aluna | Design | Pending |
| EXP-57 | P1: Conversão em aluna | Design | Pending |
| EXP-58 | P1: Conversão em aluna | Design | Pending |
| EXP-59 | P1: Conversão em aluna | Design | Pending |
| EXP-60 | P1: Conversão em aluna | Design | Pending |
| EXP-61 | P1: Conversão em aluna | Design | Pending |

**Coverage:** 61 total, 61 mapped to checks (C1-C61 em tasks.md)

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| --- | --- | --- |
| PRD 8.6 passos 1-2: conversão passa por "aguardando matrícula" e envia acesso para a pessoa completar o cadastro | A conversão pede e-mail, nascimento, plano e horários fixos e cria a aluna diretamente `ATIVO`, sem acesso, porque a área da aluna ainda não existe | y - AD-037 |

## Sources

- `PRD.md.txt` — SRS Yogue-se V1.0: seção 3 (valor da experimental), 4.4 (status Experimental e Aguardando matrícula), 4.5 (planos), 5.1 (horários fixos), 8.1-8.6 (módulo de experimentais), 10.5 (botão do formulário), 12 (entidade EXPERIMENTALS e STUDENTS), 13 (validação no servidor, transações, duplicidade), 15 (critérios de experimental e conversão), 16 (Fase 1), 17 (ocupação compartilhada)
- `.specs/STATE.md` — AD-006 (sem e-mail em v1), AD-008 (ocupação derivada), AD-012 (código em inglês, UI em português), AD-023 (admin registra em nome do aluno), AD-026/AD-027 (bloqueio cancela e não restaura), AD-034 (ordem das features), AD-035 (sessão admin)
- `.specs/features/core-experimentais/context.md` — decisões do usuário desta rodada
- Sem captures: a feature não veio com design de tela; vale o design system do projeto

---

## Success Criteria

- [ ] Visitante conclui a solicitação em menos de 2 minutos, vê o valor e a declaração, e uma segunda tentativa com o mesmo telefone é bloqueada mesmo com máscara diferente
- [ ] Experimental pendente não ocupa vaga; aprovada ocupa e aparece na grade e na agenda pública; aprovação na última vaga concorrente confirma só uma
- [ ] Cancelamento com 24h mantém o direito e permite reagendar; com 23h59 encerra o direito; falta encerra o direito
- [ ] Conversão cria aluna ativa com plano e horários fixos em uma transação, recusa horário lotado sem criar nada e mantém o histórico da experimental
- [ ] Suite verde, build e lint limpos
