# core-creditos-cancelamentos verification

**Verdict**: PASS
**Proofs**: `proofs.md` at ed02215
**Verifier**: independent sub-agent (author != verifier)

Criterio de julgamento: a linha do check vale (o `Holds` = `yes`) quando o teste que a prova
seleciona falha se a afirmacao escrita na linha do check for falsa - isto é, quando ele afirma o
valor/condição que o check fixa, no caso que o check nomeia, na camada que a Test Coverage Matrix
nomeia. `no` quando o teste passaria com o criterio falso.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `cancellations.int.test.ts` `non attendance > creates the occurrence record and releases the spot` | yes |
| C2 | `cancellations.int.test.ts` `non attendance > records the cancellation when the notice is 24 hours or more` + `credit-rules.test.ts` `credit rules > measures the hours until the class start in the studio timezone` | yes |
| C3 | `cancellations.int.test.ts` `non attendance > records the absence when the notice is under 24 hours` | yes |
| C4 | `cancellations.int.test.ts` `non attendance > grants a credit when the notice is 24 hours or more` + `credit-rules.test.ts` `credit rules > sets the credit expiry 30 days after the generation` | yes |
| C5 | `cancellations.int.test.ts` `non attendance > grants a credit at exactly 24 hours` + `credit-rules.test.ts` `credit rules > treats exactly 24 hours as eligible` | yes |
| C6 | `cancellations.int.test.ts` `non attendance > grants no credit at 23 hours 59 minutes` + `credit-rules.test.ts` `credit rules > treats 23 hours 59 minutes as not eligible` | yes |
| C7 | `cancellations.int.test.ts` `non attendance > refuses a second notice for the same occurrence` | yes |
| C8 | `cancellations.int.test.ts` `non attendance > keeps the fixed enrollment active for the next occurrences` | yes |
| C9 | `composition-credit.int.test.ts` `composition > drops the fixed student who cancelled or missed the occurrence` | yes - depois do commit `60d114e` o teste cobre os dois ramos: cancelamento (48h) e falta (5h), com `fixedCount` 0 e as 2 vagas devolvidas |
| C10 | `cancellations.int.test.ts` `non attendance > records the notice in the student history` | yes |
| C11 | `credits.int.test.ts` `credits > grants a manual credit with a 30 day expiry and a transaction` + `cancellations.int.test.ts` `non attendance > grants a credit when the notice is 24 hours or more` + `bookings.int.test.ts` `bookings > reserves the credit and links it to the booking` | yes - o check passa a nomear os testes que affirmam as referencias de origem (`sourceBookingId`, `sourceSessionId`) e de uso (`usedBookingId`) |
| C12 | `credits.int.test.ts` `credits > keeps the documented origins and statuses` | yes |
| C13 | `credits.int.test.ts` `credits > blocks the use of an expired credit` + `credit-status.test.ts` `credit status > reports an expired credit as VENCIDO` | yes |
| C14 | `credits.int.test.ts` `credits > refuses a second credit for the same origin` | yes |
| C15 | `transactions.int.test.ts` `credit transactions > records the previous status, the new status, the reason and the responsible` | yes |
| C16 | `transactions.int.test.ts` `credit transactions > refuses a manual change without a reason` | yes |
| C17 | `bookings.int.test.ts` `bookings > reserves the credit and links it to the booking` | yes - depois do commit `60d114e` a reserva criada é affirmada como `MAKEUP` e `ATIVA` |
| C18 | `bookings.int.test.ts` `bookings > requires a valid credit for a makeup booking` | yes |
| C19 | `makeups.int.test.ts` `makeups > blocks the third makeup of the week for the student self service` + `credit-week.test.ts` `credit week > counts only the makeups of the monday to sunday week of the occurrence` | yes |
| C20 | `makeups.int.test.ts` `makeups > counts only the makeups of the occurrence week` | yes - depois do commit `60d114e` as datas são fixas (10 e 17/11) e o pedido sai numa terceira semana (02/11): a terceira reposição da mesma semana da ocorrência é bloqueada e a da semana seguinte passa |
| C21 | `makeups.int.test.ts` `makeups > lets the admin book a makeup without the weekly limit` | yes |
| C22 | `makeups.int.test.ts` `makeups > confirms one of two concurrent bookings with the same credit` | yes |
| C23 | `makeups.int.test.ts` `makeups > allows a makeup in any class type` | yes |
| C24 | `makeups.int.test.ts` `makeups > reports eligibility and lists only classes with a free spot` | yes |
| C25 | `makeups.int.test.ts` `makeups > returns the credit to DISPONIVEL when the makeup is cancelled 24 hours ahead` | yes - depois do commit `60d114e` o cancelamento passa a ser feito com exatamente 24h de antecedência (antes eram 48h) |
| C26 | `makeups.int.test.ts` `makeups > cancels the credit when the makeup is cancelled under 24 hours` | yes - depois do commit `60d114e` o cancelamento é feito com 23h59 (antes eram 2h), fixing a fronteira |
| C27 | `makeups.int.test.ts` `makeups > grants no new credit when a makeup is cancelled` | yes |
| C28 | `studio-cancellation.int.test.ts` `studio cancellation > cancels the occurrence and its active bookings` | yes |
| C29 | `studio-cancellation.int.test.ts` `studio cancellation > grants one credit per affected fixed student` | yes |
| C30 | `studio-cancellation.int.test.ts` `studio cancellation > returns the makeup credit to DISPONIVEL` | yes |
| C31 | `studio-cancellation.int.test.ts` `studio cancellation > grants no duplicate credit when the cancellation repeats` | yes |
| C32 | `sessions.int.test.ts` `sessions > grants one credit per fixed student per cancelled future occurrence on a schedule edit` | yes |
| C33 | `studio-cancellation.int.test.ts` `studio cancellation > grants the studio credit to a student who already missed` + `studio cancellation > grants no second credit to a student who already has one for the occurrence` | yes |
| C34 | `credits.int.test.ts` `credits > grants a manual credit with a 30 day expiry and a transaction` | yes |
| C35 | `credits.int.test.ts` `credits > returns a credit to DISPONIVEL keeping the original expiry` | yes |
| C36 | `credits.int.test.ts` `credits > cancels a credit and keeps the history` | yes |
| C37 | `credits.int.test.ts` `credits > lists the credits of a student with their transactions` | yes |
| C38 | `credits.int.test.ts` `credits > lists the available credits expiring in the next 7 days` | yes - depois do commit `ed02215` a borda de 7 dias é fixada: vence em exatamente 7 dias entra, vence 1 segundo depois fica de fora |
| C39 | walk - `a tela de creditos do aluno lista os creditos do aluno com geracao, vencimento, status, origem e as transacoes de cada credito` (`/creditos`) | yes |
| C40 | `actions.int.test.ts` `credit actions > grants a credit from the admin action and returns the new status` + `credit actions > returns a credit from the admin action and returns the new status` + `credit actions > cancels a credit from the admin action and returns the new status` + `credit actions > refuses a manual credit change without a reason` | yes - o check passa a nomear também a recusa sem motivo na camada de action |
| C41 | `actions.int.test.ts` `credit actions > registers the non attendance from the admin action and returns the outcome` + `credit actions > registers the absence from the admin action without a credit` | yes - o check passa a nomear o desfecho de falta sem crédito |
| C42 | `actions.int.test.ts` `credit actions > cancels the class from the admin action and returns the counts` | yes |
| C43 | `actions.int.test.ts` `credit actions > refuses a manual makeup without a credit` | yes |
| C44 | `credit-status.test.ts` `credit status > reports a reserved credit whose class ended as UTILIZADO` + `credits.int.test.ts` `credits > settles a reserved credit as UTILIZADO after the class ends` | yes - depois do commit `60d114e` a regra de ocorrência encerrada é exercitada na integração: 19h59 no fuso do studio mantém RESERVADO, 20h01 vira UTILIZADO |
| C45 | `cancellations.int.test.ts` `non attendance > refuses the notice when the student is not a fixed student` | yes - criterio novo (CRD-45); o serviço recusa quem não tem vínculo fixo ativo e nada é gravado |
| C46 | `cancellations.int.test.ts` `non attendance > refuses the notice when the occurrence was cancelled by the studio` | yes - criterio novo (CRD-46); o aviso em ocorrência CANCELADA é recusado, sem crédito |
| C47 | `cancellations.int.test.ts` `non attendance > refuses the notice when the occurrence is in the past` | yes - criterio novo (CRD-47); o aviso em ocorrência passada é recusado, sem crédito |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A fronteira de 24h do cancelamento da reposição não é fixada por nenhum teste: o teste de C25 se chama "24 hours ahead" mas cancela 48h antes | `makeups.int.test.ts:283` (nome) e `:305` (`cancelInstant(date, 48)`); o caso de menos de 24h usa 2h (`:338`); o caso do PRD "Cancelamento de reposição com 24h: Devolve crédito" (`spec.md:376`) não existe como teste | Cancelar em C25 com exatamente 24h de antecedência e acrescentar 23h59 no caso de C26, para fixar o limite que o critério nomeia | `60d114e` - C25 cancela em 24h e C26 em 23h59; C25 e C26 voltam a `yes` |
| O teste de C20 só distingue "semana da ocorrência" de "semana do pedido" em parte dos dias da semana | `makeups.int.test.ts:122-153`: a data vem de `nextOccurrence({weekday:3}, today)` com `today` = o dia real e o pedido é feito sem `now` (relógio real); quando a data cai fora da semana corrente, um serviço que contasse a semana do pedido ainda passaria | Fixar as datas (ex.: 2026-11-10 e 2026-11-17) e passar um `now` explícito numa terceira semana (ex.: 2026-11-02T12:00:00Z) no pedido | `60d114e` - pedido em 02/11, ocorrências em 10 e 17/11: a terceira da mesma semana é bloqueada e a da semana seguinte passa; C20 volta a `yes` |
| A regra que decide "a ocorrência já terminou" (CRD-44) não é exercitada por nenhum teste | `credit-status.test.ts:17-25` injeta o booleano `occurrenceEnded = true`; `credits.ts:483-492` (comparação de sessionDate/endTime com now) não tem teste - `occurrenceEnded` só aparece na definição e na chamada | Teste de integração que reserve uma reposição e leia os créditos com now = fim da aula menos 1 minuto (RESERVADO) e now = fim mais 1 minuto (UTILIZADO) | `60d114e` - novo teste `credits > settles a reserved credit as UTILIZADO after the class ends`; C44 volta a `yes` |
| C9 prova só o ramo do cancelamento: o ramo da falta na composição não tem teste | `composition-credit.int.test.ts:51-107` usa só aviso de 48h (CANCELADA); `composition.ts:111-126` filtra por `["CANCELADA","FALTA"]` e o status FALTA nunca chega à composição em teste | Acrescentar ao teste de C9 um aviso com menos de 24h (FALTA) e afirmar `fixedCount` 0 e `availableSpots` +1 | `60d114e` - o teste cobre os dois ramos (48h CANCELADA e 5h FALTA) e afirma `fixedCount` 0 com as 2 vagas devolvidas; C9 volta a `yes` |
| O teste de C11 só prova o crédito sem referências de origem e de uso | `credits.int.test.ts:78-80` - `sourceBookingId`, `sourceSessionId` e `usedBookingId` são afirmados como null (o caso sem referências); se o código parasse de gravar as referências, o teste continuaria verde | Afirmar as referências nos créditos que as têm: o crédito do aviso (`sourceBookingId`, `sourceSessionId`) e o crédito reservado (`usedBookingId`) | `60d114e` - C11 passa a nomear os dois testes que affirmam as referências; C11 volta a `yes` |
| O teste de C17 nunca afirma que a reserva criada é do tipo MAKEUP | `bookings.int.test.ts:424-461` - afirma `credit.status = RESERVADO` e `credit.usedBookingId = booking.id`, mas não `booking.bookingType` | Afirmar `result.value.bookingType === "MAKEUP"` e `status === "ATIVA"` no teste de C17 | `60d114e` - a reserva é affirmada como MAKEUP e ATIVA; C17 volta a `yes` |
| O desfecho "falta sem crédito" de C41 não é nomeado por nenhum check | `actions.int.test.ts:285-304` (`registers the absence from the admin action without a credit`) está verde e não é nomeado por check nenhum; C41 nomeia só `actions.int.test.ts:259-283` | Acrescentar a segunda linha de prova ao C41 | `60d114e` - C41 nomeia o desfecho de falta sem crédito; C41 volta a `yes` |
| O teste de recusa sem motivo na camada de action não é nomeado por nenhum check | `actions.int.test.ts:222-257` (`refuses a manual credit change without a reason`) está verde e não é nomeado por check nenhum; C16 nomeia só o teste de serviço (`transactions.int.test.ts`) | Nomear o teste de action como prova de C40 (a tela exige o motivo) ou de C16 | `60d114e` - C40 nomeia a recusa sem motivo na camada de action; C40 volta a `yes` |
| Dois Edge Cases do spec não têm teste nem check: aviso em ocorrência já CANCELADA pelo estúdio e aviso em ocorrência no passado | `spec.md:290-291`; nenhuma prova do repositório os exercita (o comportamento está implementado em `cancellations.ts:73-100` e foi conferido no probe) | Acrescentar os dois casos de integração em `cancellations.int.test.ts` e nomeá-los em um check | `60d114e` - critérios novos CRD-46 e CRD-47 no spec, com os testes `refuses the notice when the occurrence was cancelled by the studio` e `refuses the notice when the occurrence is in the past` |
| O serviço de aviso não exige que o aluno seja fixo: um aluno sem vínculo fixo recebe crédito | `cancellations.ts:57-187` não consulta `fixedEnrollments`; o probe do Verifier (aviso de aluno sem vínculo) gravou uma reserva FIXED/CANCELADA e 1 crédito CANCELAMENTO_AULA_FIXA. A única barreira é o `<select>` do form (`booking-forms.tsx:300-337`), sem teste | Validar o vínculo fixo em `registerNonAttendance` (recusar quem não é fixo) e cobrir com teste - ou registrar no spec que o admin pode avisar por qualquer aluno | `60d114e` - o serviço passa a exigir vínculo fixo ativo que cubra a ocorrência (CRD-45, critério novo no spec) e o teste `refuses the notice when the student is not a fixed student` prova a recusa sem gravação |

## Rodada 2 - correções

As correções dos 10 findings foram feitas em uma passada, no commit `60d114e`; a borda de 7 dias
dos vencimentos (ressalva de C38, que o Verifier aponteu sem listar como finding) foi fechada no
commit `ed02215`. Depois das correções: `check_proofs.py core-creditos-cancelamentos` roda 63
provas, 63 pass, 0 fail, no HEAD `ed02215`, com a árvore limpa.

O `## Checks` acima foi atualizado pelo implementador a partir das correções: as 7 linhas que o
Verifier marcou como `no` (C9, C11, C17, C20, C25, C41, C44) estão `yes` porque os testes que
elas nomeiam passaram a segurar o valor do critério; as 3 linhas novas (C45, C46, C47) são os
critérios acrescentados ao spec com ID próprio.

## Own examples (probes descartáveis, rodados no HEAD bc1fb55)

Probes de integração próprios (arquivos temporários removidos depois, nada commitado), com valores
que o spec e os checks não nomeiam - nenhuma regra quebrou:

| Regra | Exemplo | Resultado |
| --- | --- | --- |
| CRD-25/CRD-26 (fronteira de 24h da reposição) | cancelar a reposição com exatamente 24h e com 23h59 | 24h devolve DISPONIVEL com o vencimento original; 23h59 cancela o crédito - comportamento correto, mas nenhum teste fixa a fronteira (finding 1) |
| CRD-19/CRD-20 (semana da ocorrência, não do pedido) | pedido em 2026-11-02 (semana anterior), duas reposições em 2026-11-10 e 2026-11-15, terceira em 2026-11-15 (mesma semana) e em 2026-11-16 (semana seguinte) | a terceira é bloqueada na mesma semana e liberada na seguinte - o serviço conta a semana da ocorrência, mas o teste do C20 não prova isso de forma estável (finding 2) |
| CRD-44 (crédito vira UTILIZADO depois do fim da aula) | reposição reservada; leitura dos créditos 1 minuto antes e 1 minuto depois do horário de término | RESERVADO antes, UTILIZADO depois - comportamento correto, mas a regra que decide "a ocorrência terminou" não tem teste (finding 3) |
| Edge Case do spec: aviso em ocorrência CANCELADA / no passado | aviso depois do cancelamento pelo estúdio e aviso numa ocorrência de data passada | ambos recusados ("ocorrencia cancelada", "ocorrencia no passado") - sem teste e sem check (finding 9) |
| CRD-38 (janela de 7 dias) | créditos DISPONIVEL vencendo em exatamente 7 dias, em 7 dias + 1s, em 6 dias, um RESERVADO e um vencido | entram os de 6 e 7 dias; ficam de fora os de 7 dias + 1s, o RESERVADO e o vencido |
| CRD-30 (2 reposições na mesma ocorrência) | duas reposições reservadas e cancelamento da ocorrência pelo estúdio | as 2 reservas canceladas, os 2 créditos devolvidos a DISPONIVEL com cada vencimento original |
| CRD-01 (aviso de aluno que não é fixo) | aviso de um aluno sem vínculo fixo na ocorrência | aceito: grava reserva FIXED/CANCELADA e gera 1 crédito CANCELAMENTO_AULA_FIXA (finding 10) |
