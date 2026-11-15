# Aluno-fixo-limite verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at d088db2
**Verifier**: independent sub-agent (author != verifier)

> **Fechamento (autor, 2026-11-15)**: os 4 achados foram fechados em
> `65bfb2e` (test(students): prove both re-end branches and the future
> end-date occupancy) - o teste de C5 agora encerra um SEGUNDO vinculo por
> DATA antes de re-encerrar das duas formas, afirmando "ja encerrado em
> <data>" (a unica recusa possivel e o guard do endDate), e a prova de C2
> ganhou o lado "endDate futura ainda ocupa a vaga ate a data e se libera a
> partir dela" (bloqueio em D, liberacao em D+7, 3 linhas no fim). O walk
> ficou duravel: `**Walked:**` preenchido no Handoff e o roteiro commitado
> em `.specs/features/aluno-fixo-limite/walk.mjs`. Suite completa: **425
> testes verdes**; `check_proofs.py` no HEAD `65bfb2e`: **16/16 pass**.
> Sobre o 4o achado: `proofs.md` permanece fora do repo POR DESIGN (o
> admin-turmas fez o mesmo) - ele carrega o hash do HEAD em que foi gerado;
> commita-lo deixaria o hash atras do proprio commit que o contem e o gate
> (`validate_verification.py`) exige que `proofs.md` bata com o HEAD vivo.

> O que fez o Verdict falhar: C5 nomeia a recusa de re-encerramento "por data
> ou status", mas a prova publicada encerra o vínculo por STATUS antes de
> re-encerrar — as duas tentativas de re-encerramento caem no guard de status e
> o guard do `endDate` (`enrollments.ts:191-197`) nunca é alcançado por teste
> nenhum. O probe próprio confirmou que a implementação se comporta certo
> ("vinculo ja encerrado em 2026-11-17"); o que falta é prova, não código.
> Achado secundário: C2 é unilateral — nenhuma prova afirma que vínculo com
> `endDate` FUTURA ainda ocupa a vaga antes do fim (RES-23 "conta até D-1").

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `enrollments.int.test.ts` `end_date removes the count after the end` | yes - encerra com `{ date }` e afirma `ended.value.endDate === date` na linha retornada do UPDATE, com `ok: true` confirmando o serviço |
| C2 | `enrollments.int.test.ts` `end_date removes the count after the end` | yes - capacidade 1: com `endDate = D` gravada, um segundo fixo cria com sucesso na MESMA data D, o que só passa se o encerrado já não contar na composição em D (vaga liberada); o lado "ainda conta antes de D" não é afirmado por prova nenhuma (finding 2) |
| C3 | `enrollments.int.test.ts` `refuses an end date before the start date` | yes - recusa com erro "anterior", relê a linha e afirma `endDate` nula e status ATIVA (nada alterado); a borda de encerrar no próprio dia de início é aceita |
| C4 | `tasks.md` T5 Done-when + walk (10/10 asserts) | yes - o walk observa os 2 itens na seção, envia o formulário, vê o feedback "Horário fixo encerrado a partir de <hoje>", espera a seção recarregar de 2 para 1 itens e confirma no banco `end_date = hoje` e a vaga de volta (8 de 8) na grade |
| C5 | `enrollments.int.test.ts` `refuses ending an already ended or missing enrollment` | **NO** - o primeiro encerramento é por STATUS (`endDate` fica nula), então tanto `again` quanto `byDate` caem no guard de status; a perna "já encerrado POR DATA" (guard `current.endDate`) não é exercitada por nenhum teste (finding 1) |
| C6 | `enrollments.int.test.ts` `allows exactly the plan frequency of active enrollments` | yes - plano 2x: os 2 vínculos criam com sucesso e o histórico tem exatamente 2; a perna "não mais" vive no teste nomeado por C7 (o par C6/C7 cobre os dois lados do PLIM-01) |
| C7 | `enrollments.int.test.ts` `refuses the enrollment beyond the plan frequency naming the plan and the count` | yes - o 3º vínculo recusa com erro casando `/Plano .+ 2x\/semana/` e "ja esta fixa em 2 turmas", e o histórico continua com 2 (nada extra gravado) |
| C8 | `enrollments.int.test.ts` `refuses a fixed enrollment for a student without a plan` | yes - aluno criado com `plan: false` recusa com erro "sem plano", `field: "planId"` e histórico vazio (nenhum vínculo gravado) |
| C9 | `conversion.int.test.ts` `recusa conversao com mais horarios fixos que a frequencia do plano (PLIM-04)` | yes - 3 slots com plano 2x recusa com `field: "classSlotIds"`, erro citando "foram escolhidos 3", e afirma 0 alunos, 0 vínculos e a experimental ainda APROVADA |
| C10 | `students.int.test.ts` `recusa plano com frequencia menor que os vinculos fixos ativos (PLIM-05)` | yes - aluna fixa em 2 turmas: edição para plano 1x recusa com `field: "planId"`, erro citando "1x/semana" e "ja esta fixa em 2 turmas", e a aluna segue com o plano original |
| C11 | `students.int.test.ts` `recusa remover o plano de aluna com vinculos fixos ativos (PLIM-06)` | yes - com 1 vínculo ativo, edição com `planId: null` recusa com erro "precisa de plano" e `field: "planId"` |
| C12 | `students.int.test.ts` `edita o plano livremente sem vinculos fixos ativos (PLIM-07)` | yes - vínculo encerrado (contagem 0): baixar para 1x passa e limpar o plano passa (`ok: true` nas duas edições); a persistência do campo é provada pelo teste STUD-05 |
| C13 | `students.int.test.ts` `perfil deixa de listar o fixo encerrado no proprio dia (FIX-06)` | yes - dois vínculos encerrados (hoje e amanhã): o perfil lista exatamente 1 e é o slot do que encerra amanhã — o encerrado HOJE saiu |
| C14 | `students.int.test.ts` `perfil deixa de listar o fixo encerrado no proprio dia (FIX-06)` | yes - o mesmo teste afirma que o único item restante é o slot com `endDate` amanhã, isto é, o encerrado no futuro permanece na lista |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C5 não segura a perna "já encerrado por data" | `enrollments.int.test.ts:270-287`: o primeiro `endEnrollment` não passa `date` (encerra por status; `endDate` permanece nula), então o re-encerramento sem data (linha 275) e com data (linha 281) são ambos pegos pelo guard `status === "INATIVA"`. O guard `if (current.endDate)` de `enrollments.ts:191-197` ("vinculo ja encerrado em ...") não é alcançado por nenhum teste — o grep de todos os `endEnrollment(` em `*.test.ts` confirma que nenhum encerra por data e depois re-encerra. Uma regressão que apagasse esse guard deixaria a suíte verde | No teste de C5, encerrar primeiro POR DATA (por exemplo a 1ª tentativa com `{ date }`), depois re-encerrar sem data e com data futura, afirmando a mensagem "ja encerrado em <data>" — assim o guard do `endDate` é o único que pode produzir a recusa | `65bfb2e` - test(students): prove both re-end branches and the future end-date occupancy; check C5 (o teste cria um segundo vínculo, encerra POR DATA e re-encerra sem data e com data futura, ambos recusados com "ja encerrado em <data>", que só o guard do `endDate` produz) |
| C2 é unilateral: "ainda conta antes de D" não tem prova permanente | `enrollments.int.test.ts:192-221` só verifica a data D do fim. A composição conta via `gt(endDate, date)` (`composition.ts:111-117`), mas nenhum teste cria vínculo encerrado para data FUTURA e afirma que ele ainda ocupa vaga antes dela. Uma implementação que parasse de contar todo vínculo com `endDate` não nula passaria na suíte inteira e liberaria vagas antes do prazo, contrariando RES-23 | Estender a prova de C2 (ou o teste FIX-06/07): encerrar um vínculo para data futura e afirmar que a vaga segue ocupada nas ocorrências anteriores ao fim e se libera a partir do próprio dia do fim | `65bfb2e` - test(students): prove both re-end branches and the future end-date occupancy; check C2 (o teste de end_date agora encerra o 2º vínculo para D+7: um 3º aluno recusa em D - "sem vaga", o vínculo futuro ainda ocupa - e cria em D+7, liberado a partir da data encerrada; 3 linhas no fim) |
| A prova de C4 (walk) não está publicada de forma durável | O roteiro do walk está fora do repo (`C:\Users\leona\AppData\Local\Temp\opencode\walk-aluno-fixo.mjs`, não commitado) e o Handoff de `tasks.md` segue "(a preencher no fim)" em `**Walked:**`; o único registro no repo são os checkboxes de T5 | Registrar o walk no `**Walked:**` do Handoff de `tasks.md` (como o admin-turmas fez no round 2) com os asserts 10/10, ou commitar o roteiro do walk | `65bfb2e` - test(students): prove both re-end branches and the future end-date occupancy (o Handoff de `tasks.md` ganhou o `**Walked:**` completo com os asserts do round e o roteiro foi commitado em `.specs/features/aluno-fixo-limite/walk.mjs`) |
| `proofs.md` referido no verdict não está commitado | `git status` em d088db2 mostra `?? .specs/features/aluno-fixo-limite/proofs.md` (untracked); no commit d088db2 o arquivo não existe | Commitar `proofs.md` junto com este `verification.md` | `65bfb2e` - decisão do autor: `proofs.md` permanece untracked, precedência admin-turmas (o arquivo carrega o hash do HEAD em que foi gerado; commitá-lo deixaria o `**HEAD**` do proofs.md atrás do commit que o contém e o gate `validate_verification.py` exige que `proofs.md` bata com o HEAD vivo) |

## Own examples

Probes de integração descartáveis no HEAD `d088db2` (`probe-verifier.int.test.ts`,
removido após a rodada; nada foi commitado). Docker Desktop ativo; 3/3 pass.

| Regra | Exemplo | Resultado |
| --- | --- | --- |
| Re-encerramento após fim POR DATA (perna ausente de C5) | vínculo encerrado com `{ date: D }`, depois re-encerrado sem data e com data futura | recusado nas duas tentativas com "vinculo ja encerrado em 2026-11-17" (guard do `endDate`); linha intocada — implementação correta, prova é que falta |
| Vínculo com `endDate` FUTURA na composição (perna ausente de C2) | vínculo encerrado para D+7 em turma de capacidade 1: tentar fixo de outro aluno em D e em D+7 | em D recusa "sem vaga" (ainda conta); em D+7 cria com sucesso (libera a partir do fim) — implementação correta, prova é que falta |
| `endDate` futura no limite do plano | plano 1x, vínculo encerrado para D+7, tentar o 2º vínculo hoje | recusa "Plano ... 1x/semana: a aluna ja esta fixa em 1 turma" — a contagem trata fim futuro como ativo hoje, coerente com o perfil |
| Suítes nomeadas pelas provas | `enrollments.int.test.ts` + `students.int.test.ts` + `conversion.int.test.ts` | 42 testes verdes (12 + 19 + 11), confirmando o `proofs.md` |
