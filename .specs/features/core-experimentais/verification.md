# core-experimentais verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 874a4d8
**Verifier**: independent sub-agent (author != verifier)
> **Fechamento (autor, 2026-11-12)**: os 7 findings do Verifier foram fechados em uma passada - um commit
> por finding (F1-F5 fecham a cobertura dos testes; F6-F7 mudam a prova das telas de walk, com o round 1
> do browser de 12/11/2026 ja registrado no `**Walked:**`). O Verifier achou ainda um bug pre-existente de
> outra feature (F8: o default de `enrollment_date` usava a data UTC do Postgres e a suite ficava vermelha
> entre 21h e 23h59), fechado em um commit proprio. Round 2 = `check_proofs.py` sobre o HEAD com os fixes.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `src/app/(site)/page.tsx` `walk - home do site tem o controle "Agendar aula experimental" que leva a /experimental` | yes |
| C2 | `src/app/(site)/experimental/experimental-form.tsx` `walk - formulario mostra nome, telefone, modalidade, dia/horario, R$ 45,00 e a declaracao exata antes do envio` | yes |
| C3 | `src/app/(site)/experimental/experimental-form.tsx` `walk - declaracao exata do PRD visivel e obrigatoria (checkbox required)` | yes |
| C4 | `src/app/(site)/experimental/experimental-form.tsx` `walk - formulario filtra por modalidade e mostra data, horario e vagas` | yes |
| C5 | `src/app/(site)/experimental/experimental-form.tsx` `walk - estado vazio "Nenhuma aula experimental com vaga no momento" e nenhum formulario para enviar` | yes |
| C6 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `cria solicitacao pendente sem ocupar vaga` | yes |
| C7 | `src/modules/experimentals/domain/__tests__/validators.test.ts` `recusa nome vazio, telefone invalido e declaracao nao aceita` | yes - fechado em 1b62fe1: o mesmo teste agora tambem recusa `classTypeId`, `classSlotId` e `date`, cada um com o campo exato |
| C8 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `bloqueia telefone com experimental anterior mesmo com mascara diferente` | yes - fechado em 8abe4c5: o mesmo teste bloqueia um canonico em APROVADA, CANCELADA_COM_DIREITO, CANCELADA_SEM_DIREITO, FALTA e CONVERTIDA, com a tentativa DUPLICADA ligada |
| C9 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `registra a tentativa bloqueada como duplicada` | yes |
| C10 | `src/modules/experimentals/domain/__tests__/phone.test.ts` `mascara e codigo do pais nao mudam a identidade do telefone` | yes |
| C11 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `cria solicitacao pendente sem ocupar vaga` | yes |
| C12 | `src/app/(site)/experimental/experimental-form.tsx` `walk - envio valido mostra a confirmacao de aprovacao pendente e o contato via WhatsApp` | yes |
| C13 | `src/modules/experimentals/services/__tests__/occurrences.int.test.ts` `opcao publica nao carrega nome nem telefone de ninguem` | yes - a opcao e a unica fonte de dados da pagina e o teste fixa o seu shape |
| C14 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `duas submissoes concorrentes geram uma solicitacao e uma duplicada` | yes |
| C15 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `nao cria solicitacao sem vaga ou em ocorrencia bloqueada` | yes - fechado em 01713c3: o mesmo teste recusa tambem a ocorrencia CANCELADA, a turma INATIVA e a modalidade INATIVA, sem gravar nada |
| C16 | `src/db/__tests__/experimentals-schema.int.test.ts` `experimental guarda a declaracao e o instante da solicitacao` | yes |
| C17 | `src/app/(admin)/experimentais/page.tsx` `walk - /experimentais lista nome, telefone, aula, modalidade, status, pagamento e solicitada em` | yes |
| C18 | `src/modules/experimentals/services/__tests__/reads.int.test.ts` `busca por telefone devolve todas as tentativas` | yes |
| C19 | `src/modules/experimentals/services/__tests__/reads.int.test.ts` `detalhe mostra os dados e a aluna convertida` | yes - 14 of the 15 items EXP-19 names; `cancelledAt` vem da projecao da linha inteira e a tela o renderiza |
| C20 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `aprova com vaga e ocupa a ocorrencia` | yes |
| C21 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `recusa aprovacao sem vaga, bloqueada ou cancelada e mantem pendente` | yes - fechado em d9de766: o mesmo teste recusa a aprovacao com a modalidade INATIVA e mantem a solicitacao PENDENTE |
| C22 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `duas aprovacoes concorrentes na ultima vaga confirmam uma` | yes |
| C23 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `recusada libera o telefone para nova solicitacao` | yes |
| C24 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `troca de data de pendente mantem pendente e de aprovada troca a vaga` | yes |
| C25 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `registra pagamento nos quatro status` | yes |
| C26 | `src/modules/experimentals/services/__tests__/approval.int.test.ts` `registra contato via WhatsApp` | yes |
| C27 | `src/modules/experimentals/domain/__tests__/validators.test.ts` `declaracao e preco sao os textos fixos do PRD` | yes - fechado em 3c4af45: a linha "Aula experimental: R$ 45,00" do detalhe entrou como prova de walk (round 1, 12/11/2026) |
| C28 | `src/modules/experimentals/__tests__/actions.int.test.ts` `toda action admin exige sessao de ADMIN` | yes |
| C29 | `src/app/(admin)/experimentais/[id]/experimental-forms.tsx` `walk - cada action mostra sucesso ou erro sem perder a lista` | yes |
| C30 | `src/app/(admin)/experimentais/page.tsx` `walk - /experimentais sem solicitacoes mostra o estado vazio` | yes |
| C31 | `src/app/(admin)/experimentais/[id]/experimental-forms.tsx` `walk - recusar, cancelar sem direito, falta e converter pedem confirmacao` | yes |
| C32 | `src/modules/experimentals/domain/__tests__/validators.test.ts` `termos de status e pagamento sao os do PRD` | yes - a tela renderiza o proprio mapa, entao o teste fixa o que o admin ve |
| C33 | `src/modules/experimentals/domain/__tests__/validators.test.ts` `termos de status e pagamento sao os do PRD` | yes - idem C32, para os quatro termos de pagamento |
| C34 | `src/modules/experimentals/services/__tests__/cancellation.int.test.ts` `cancelamento com 24h exatas vira cancelada com direito` | yes |
| C35 | `src/modules/experimentals/services/__tests__/cancellation.int.test.ts` `cancelamento com 23h59 vira cancelada sem direito` | yes |
| C36 | `src/modules/experimentals/services/__tests__/cancellation.int.test.ts` `falta depois do inicio encerra o direito e libera a vaga` | yes |
| C37 | `src/modules/experimentals/services/__tests__/cancellation.int.test.ts` `cancelamento depois do inicio e recusado` | yes |
| C38 | `src/modules/experimentals/domain/__tests__/rules.test.ts` `status terminal recusa cancelar e reagendar` | yes |
| C39 | `src/modules/experimentals/services/__tests__/reschedule.int.test.ts` `reagenda cancelada com direito com vaga e grava a ocorrencia anterior` | yes |
| C40 | `src/modules/experimentals/services/__tests__/reschedule.int.test.ts` `reagendamento sem vaga recusa e mantem o direito` | yes |
| C41 | `src/modules/bookings/services/__tests__/composition-experimentals.int.test.ts` `aprovada ocupa a vaga e pendente nao ocupa` | yes |
| C42 | `src/modules/bookings/services/__tests__/composition-experimentals.int.test.ts` `cancelada com direito, falta e convertida liberam a vaga` | yes - fechado em 1c73ef1: o mesmo teste prova que RECUSADA, CANCELADA_SEM_DIREITO e DUPLICADA nao contam na composicao |
| C43 | `src/modules/experimentals/services/__tests__/reads.int.test.ts` `grade lista a aprovada como participante experimental` | yes - fechado em 3c4af45: a listagem da grade com "Ana Aprovada (experimental)" entrou como prova de walk (round 1, 12/11/2026) |
| C44 | `src/modules/experimentals/services/__tests__/occurrences.int.test.ts` `a aprovada reduz a vaga ofertada` | yes |
| C45 | `src/modules/classes/services/__tests__/blocks-experimentais.int.test.ts` `bloqueio, cancelamento e edicao de turma cancelam a experimental com direito` + `src/modules/credits/services/__tests__/studio-cancellation-experimentals.int.test.ts` `cancela a experimental da ocorrencia com direito` | yes - os tres caminhos de EXP-45 provados |
| C46 | `src/modules/classes/services/__tests__/blocks-experimentais.int.test.ts` `desbloquear nao restaura a experimental cancelada` | yes |
| C47 | `src/modules/experimentals/services/__tests__/reschedule.int.test.ts` `o direito so se exerce no mesmo registro` | yes |
| C48 | `src/modules/experimentals/services/__tests__/requests.int.test.ts` `recusada libera o telefone para nova solicitacao` | yes |
| C49 | `src/app/(admin)/experimentais/[id]/experimental-forms.tsx` `walk - tentativa duplicada aparece como "Tentativa duplicada" e sem acoes` | yes |
| C50 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `cria aluna ativa com plano, horarios fixos e declaracao copiada` | yes |
| C51 | `src/modules/experimentals/domain/__tests__/validators.test.ts` `conversao exige email, nascimento, plano e ao menos um horario` | yes |
| C52 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `email duplicado ou invalido recusa e nao cria nada` | yes - inclui o caso ignorando maiusculas |
| C53 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `plano inexistente ou inativo e recusado` | yes |
| C54 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `um horario lotado recusa a conversao inteira` | yes - a recusa nomeia o horario |
| C55 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `um horario lotado recusa a conversao inteira` | yes - a recusa sem nada gravado prova a transacao |
| C56 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `conversao antes do fim ou status nao aprovado e recusada` | yes |
| C57 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `cria aluna ativa com plano, horarios fixos e declaracao copiada` | yes - grava CONVERTIDA, converted_student_id e attended_at |
| C58 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `aluna convertida aparece na listagem e ocupa vaga` | yes |
| C59 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `segunda conversao e recusada` | yes |
| C60 | `src/modules/experimentals/services/__tests__/reads.int.test.ts` `detalhe mostra os dados e a aluna convertida` | yes |
| C61 | `src/modules/experimentals/services/__tests__/conversion.int.test.ts` `aluna convertida nao recebe login nesta versao` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C7's test proves 3 of the 5 field refusals EXP-07 names | `src/modules/experimentals/domain/__tests__/validators.test.ts:51` - asserts name, phone and healthDeclaration only; `classTypeId` and `classSlotId` errors the service returns have no assertion (my probe confirmed both are refused with the right field at HEAD) | assert `field` `classTypeId` and `classSlotId` (and `date`) in the same test | 1b62fe1 - test(experimentals): assert classTypeId, classSlotId and date refusals; check C7 (o mesmo teste recusa os 5 campos de EXP-07, com o campo exato) |
| C8's test proves one status of the "anything but RECUSADA" set | `src/modules/experimentals/services/__tests__/requests.int.test.ts:154` - the canonical is always PENDENTE; `findCanonicalByPhone`'s `ne(status, "RECUSADA")` filter is otherwise unasserted (my probe showed APROVADA, CANCELADA_COM_DIREITO, CANCELADA_SEM_DIREITO, FALTA and CONVERTIDA all block at HEAD) | add one blocked case per non-RECUSADA status and keep the RECUSADA case free | 8abe4c5 - test(experimentals): block every non-recusada canonical status; check C8 (um caso por status nao recusada, com a tentativa DUPLICADA ligada) |
| C15's test proves 2 of the 5 situations EXP-15 names | `src/modules/experimentals/services/__tests__/requests.int.test.ts:291` - sem vaga and bloqueada only (the past date lives in another title); a cancelled occurrence and an inactive turma/modalidade are refused by the code but unasserted | add the CANCELADA-session and INATIVA slot/classType cases to the same test | 01713c3 - test(experimentals): refuse cancelled occurrence and inactive slot or modality; check C15 (ocorrencia cancelada, turma inativa e modalidade inativa) |
| C21's test proves 4 of the 5 situations EXP-21 names | `src/modules/experimentals/services/__tests__/approval.int.test.ts:110` - sem vaga, bloqueada, cancelada and turma inativa; the `classType.status === "INATIVA"` branch (`services/experimentals.ts:420`) is unasserted (my probe confirmed it refuses and keeps the request PENDENTE) | add an inactive-modality approval refusal that leaves the request PENDENTE | d9de766 - test(experimentals): refuse approval of inactive modality; check C21 (aprovacao recusada e solicitacao mantida PENDENTE) |
| C42's test proves 4 of the 7 statuses EXP-42 names | `src/modules/bookings/services/__tests__/composition-experimentals.int.test.ts:88` - loops CANCELADA_COM_DIREITO, FALTA and CONVERTIDA (PENDENTE in the other test); RECUSADA, CANCELADA_SEM_DIREITO and DUPLICADA are absent, so changing the composition filter to include one of them would keep every test green | assert the three remaining statuses leave experimentalCount 0 and availableSpots at capacity | 1c73ef1 - test(bookings): recusada, sem direito and duplicada free the spot; check C42 (os tres status restantes nao contam) |
| C27's test pins the price constant, not the admin detail's line | `src/modules/experimentals/domain/__tests__/validators.test.ts:72` - asserts `EXPERIMENTAL_PRICE_CENTS` is 4500; the "Aula experimental: R$ 45,00" render on `src/app/(admin)/experimentais/[id]/page.tsx:128` has only the build gate, so deleting the line keeps the proof green | walk `/experimentais/[id]` and record the R$ 45,00 line, or name it in C2's walk | 3c4af45 - docs(core-experimentais): walk proof for the price line and the grade participant; check C27 (walk do detalhe com a linha "Aula experimental: R$ 45,00") |
| C43's test sits at the service layer for a screen criterion | `src/modules/experimentals/services/__tests__/reads.int.test.ts:319` - proves `listApprovedExperimentalsBySession`; the participants list and the "experimental" bond on `src/app/(admin)/grade/page.tsx:133` and `:351` are only build-gated, so removing the JSX keeps C43 green; the Test Coverage Matrix assigns `src/app/**` criteria to a walk | walk `/grade` with an approved experimental and record the participant line as C43's proof | 3c4af45 - docs(core-experimentais): walk proof for the price line and the grade participant; check C43 (walk da grade com "Ana Aprovada (experimental)") |
| F8 (Minor, pre-existente de outra feature) - o default de `enrollment_date` usa `CURRENT_DATE` do Postgres (UTC) e o teste de schema compara com a data local da maquina: entre 21h e 23h59 a suite fica vermelha | `src/db/schema/students.ts:38` (default `CURRENT_DATE`) e `src/db/__tests__/students-schema.int.test.ts:102` (compara com `new Date().toLocaleDateString("sv-SE")`); o app sempre grava a data com `todayInStudio()` (`src/modules/students/services/students.ts:84`), e o calendario do estudio e `America/Sao_Paulo` (RES-06/RES-10) | O default do banco passa a ser a data do estudio (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`) e o teste compara com `todayInStudio()` | a6d85c3 - fix(db): enrollment date default follows the studio calendar; migracao `drizzle/0004_enrollment_date_studio_calendar.sql` |

Own examples run at HEAD (throwaway, deleted): 24h exact and 24h minus one millisecond on classes at 07:30 and 23:45; no-show allowed and cancellation refused at the exact start instant; five approved experimentals filling a capacity-5 occurrence (and the occurrence dropping out of the public agenda); occupancy past capacity (negative spots, still not offered); every non-RECUSADA status blocking a new request and RECUSADA freeing it; a phone freed after its duplicate attempt was recorded; concurrent conversions of the same experimental creating one student; two simultaneous swaps between the same two occurrences; concurrent reschedules and double approvals. None broke. Separately, `npx vitest run` (the whole suite) has one red test that is not this feature's: `src/db/__tests__/students-schema.int.test.ts:102` compares `enrollment_date` (a `DEFAULT CURRENT_DATE` evaluated in UTC by Postgres) with the machine's local date, so it only fails between 21:00 and 23:59 local - it failed at 21:36 local and passes at the 20:54 hour the proofs were taken.
