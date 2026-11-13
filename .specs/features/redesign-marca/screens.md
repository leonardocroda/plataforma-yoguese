# Redesign da Marca screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 2

Pictures retaken by this verifier from the running app (Edge/playwright-core, full page): all sixteen captures, `home`, `experimental`, `experimental-filled`, `experimental-confirm`, `login`, `login-error`, `admin-shell`, `grade`, `grade-panel`, `alunos`, `planos`, `creditos`, `feriados`, `experimentais` at 1440x900; `home-390` and `experimental-390` at 390x844. Judged against the binding guide screen named in each row (`.specs/features/redesign-marca/captures/yogue-se-brand.html`, section "Telas de exemplo"), applying the differences listed in `spec.md` "Differences from the source". In this second round only the rows that differed in round 1 were opened and marked again; the rows already marked `same` stay as they were. Every picture carries the Next.js dev-server badge in the lower left corner; that overlay is not part of the app and is not judged.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/home.running.png` | guide: Home pública (telas) | matches | |
| `captures/home-390.running.png` | guide: Home pública (telas) | matches | |
| `captures/experimental.running.png` | guide: Agendar aula experimental (telas) | matches | |
| `captures/experimental-filled.running.png` | guide: Agendar aula experimental (telas) | matches | |
| `captures/experimental-390.running.png` | guide: Agendar aula experimental (telas) | matches | |
| `captures/experimental-confirm.running.png` | guide: Agendar aula experimental (telas) | matches | |
| `captures/login.running.png` | no guide screen - spec P1: Login (BRAND-32..34) | matches | |
| `captures/login-error.running.png` | no guide screen - spec P1: Login (BRAND-32..34) | matches | |
| `captures/admin-shell.running.png` | guide: Admin: calendário e turma (telas) | matches | |
| `captures/grade.running.png` | guide: Admin: calendário e turma (telas) | matches | |
| `captures/grade-panel.running.png` | guide: Admin: calendário e turma (telas) | matches | |
| `captures/alunos.running.png` | guide: admin shell/nav (no admin screen for this route) - spec BRAND-27 | matches | |
| `captures/planos.running.png` | guide: admin shell/nav (no admin screen for this route) - spec BRAND-27 | matches | |
| `captures/creditos.running.png` | guide: admin shell/nav (no admin screen for this route) - spec BRAND-27 | matches | |
| `captures/feriados.running.png` | guide: admin shell/nav (no admin screen for this route) - spec BRAND-27 | matches | |
| `captures/experimentais.running.png` | guide: admin shell/nav (no admin screen for this route) - spec BRAND-27 | matches | |

### `captures/home.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| header: logo `Yogue-se` on the left, 34px | same | |
| header: nav links `Método`, `Professora`, `Horários`, `Contato` | same | removed by the spec's nav difference (AD-042): the header draws the logo, `Entrar` and the primary CTA |
| header: `Entrar` secondary pill | same | |
| header: primary black pill `Agendar aula experimental` | same | drawn in the header together with `Entrar`, as the spec's nav difference (AD-042) sets |
| hero: large peach dotted circle at the top right | same | |
| hero: second, smaller dotted circle below it | same | |
| hero: duck mascot in lotus over the dotted circle | same | |
| hero: staggered giant title `Yoga` / `do` / `Pato`, middle line indented | same | letter spacing and clamp size follow the guide |
| hero: lead sentence `Turmas de até 8 pessoas, com a professora acompanhando cada uma de perto.` | same | |
| hero: position of the primary CTA (guide draws it in an actions row under the lead; product draws it in the header) | same | applied from the spec's nav difference (AD-042): the nav carries the black `Agendar aula experimental` pill and the `Ver horários` text button left with the placeholder anchors; the lead, mascot and circles keep their places |
| section rule: 2px black line above the list | same | |
| list heading `Próximas aulas com vaga` 26px | same | |
| list: three-column grid with one divider per row | same | real data draws 8 rows, the guide's mock draws 3 |
| list item: weekday and time, 22px extrabold | same | real data (`Segunda, 19:00`) replaces the guide's example `Terça, 19h` |
| list item: short date beside the time (grey 15px) | same | extra data, added so the same slot on different weeks does not read as a duplicate; the guide's mock has no date |
| list item: modality, grey 14.5px | same | |
| list item: vacancy ducks, md 28x36, fixed solid black and free grey dashed | same | |
| list item: vacancy count `N vagas` | same | count now stacks directly under the duck group, left aligned, dark 14px semibold, the guide's `.lista-aulas .vg` arrangement; only the vertical gap above it is slightly tighter than the guide's 8px grid gap |
| list item: 1px `--linha` divider | same | |
| method band: `Superioga clássico` and `Superioga intenso` cards under the list | same | left out by the spec's difference; the home keeps the upcoming-classes list only |
| render: no overlap, cut off or horizontal scroll | same | the dark circle at the lower left is the Next dev badge (dev-server overlay) |

### `captures/home-390.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| header: logo on its own line, `Entrar` + `Agendar aula experimental` on the next | same | |
| header: nav links `Método`, `Professora`, `Horários`, `Contato` | same | removed by the spec's nav difference (AD-042), as on the desktop home |
| hero: duck mascot 170px over the dotted circle, no overlap with the title | same | |
| hero: staggered title stacked in three lines, 64px | same | |
| hero: lead sentence | same | |
| hero: dotted circle 1 kept, circle 2 hidden | same | guide hides the second circle below 820px |
| list: single column, heading `Próximas aulas com vaga`, 1px divider per row | same | |
| list item: weekday and time, short date, modality | same | |
| list item: vacancy ducks md 28x36 | same | |
| list item: vacancy count | same | count stacks under the ducks, left, dark 14px, as the guide |
| method band: `Superioga clássico` / `Superioga intenso` cards | same | left out by the spec's difference |
| render: title, mascot and list stack with no horizontal overflow | same | |

### `captures/experimental.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page column: the guide frames the whole form in its 390px card | same | the form sits in a 390px card centred on the page, 2px black border and 38px radius, 20px side padding, the guide's own `.celular` drawing |
| title `Aula experimental`, 44px, two lines in the guide's card | same | two lines, as the guide's card wraps it |
| subtitle `Escolha uma turma com vaga.` | same | |
| option list: one bordered row per occurrence, 8px gap | same | real data draws 8 occurrences, the guide's mock draws 3 |
| option row: bold time line plus small grey modality | same | |
| option row: one vacancy-duck group at the right, xs 12x16 | same | |
| option row: `--pena` fill, 2px `--linha` border, 16px radius | same | |
| option row state: no option pressed in this state | same | |
| field `Seu nome` with 2px black border and 16px radius | same | |
| field `Telefone`, placeholder `11 91234-5678`, help `A professora vai te avisar por aqui.` | same | |
| checkbox + health declaration sentence | same | product's official declaration is longer than the guide's example sentence (domain text with its own test); the guide's section says its screen texts are illustrative |
| price rule: 2px black line above `Valor da aula` | same | |
| price: `Valor da aula` grey left, `R$ 45,00` bold tabular right | same | value follows AD-040 |
| submit `Pedir aula experimental`, disabled (grey) before the form is complete | same | |
| submit width: guide's primary action spans the form column | same | pill spans the column (342px of the card's inner width), as the guide's `width:100%` |
| render: no overlap or scroll trap | same | |

### `captures/experimental-filled.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page column | same | 390px centred card, the guide's `.celular` width; same column the idle state draws |
| title and subtitle | same | |
| option list, 8 rows | same | |
| first option pressed: black 2px border and `--pessego-claro` fill | same | |
| pressed option ducks: 8 xs ducks, 5 fixed black, own duck solid peach, 2 free dashed | same | own duck is the first free one, as in the guide |
| field `Seu nome` with `Walk da Marca` | same | |
| field `Telefone` with `11 97777-0001` and help sentence | same | |
| checkbox checked (black) + declaration | same | |
| price rule and `R$ 45,00` | same | |
| submit `Pedir aula experimental` enabled (black pill) | same | |
| submit width | same | pill spans the column, same width as the idle state |
| render | same | |

### `captures/experimental-390.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page column: 390px card | same | content fills the 390 viewport inside the card with 20px side padding; the frame follows the guide's card because the desktop state now draws it too |
| title `Aula experimental` in two lines, subtitle | same | |
| option list: 8 bordered rows, bold time + date, small modality, xs ducks at the right | same | |
| option row idle drawing: pena fill, 2px linha border, 16px radius | same | |
| fields `Seu nome` and `Telefone` with help | same | |
| checkbox + declaration | same | |
| price rule 2px black, `Valor da aula`, `R$ 45,00` | same | |
| submit `Pedir aula experimental` (disabled grey) | same | |
| submit width: guide's primary action spans the column | same | disabled pill spans the card's inner column (350px) edge to edge |
| render: no horizontal overflow | same | |

### `captures/experimental-confirm.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page column | same | the confirmation state keeps the form state's 390px centred card, so the column no longer changes between states |
| title `Aula experimental` | same | |
| confirmation card: peach fill, 16px radius, 18px padding | same | |
| card heading `Pedido enviado`, 24px | same | |
| card sentence `A professora confirma e te avisa pelo telefone. Enquanto isso, respire fundo.` | same | |
| card duck mascot at the right, 74px | same | |
| card aria-live status | same | |
| render: no overlap, cut off or unreadable text | same | |

### `captures/login.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| centred card on papel, 2px black border, 28px radius | same | criterion BRAND-32 has no guide capture; card is 376px wide and centred |
| logo `Yogue-se` inside the card | same | |
| page heading `Yogue-se` under the logo | same | not specified by the spec; it repeats the logo word |
| subtitle `Área da professora.` | same | |
| field `E-mail` in the guide field style | same | |
| field `Senha` in the guide field style | same | |
| one black primary pill `Entrar` | same | |
| render | same | |

### `captures/login-error.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| centred card, logo, heading, subtitle | same | |
| fields `E-mail` and `Senha` | same | |
| generic error message in the error token | same | `E-mail ou senha inválidos` above the button, red, no factor revealed (BRAND-33) |
| black `Entrar` pill | same | drawn in a slightly lighter black while the failed submit settles |
| render | same | |

### `captures/admin-shell.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav: logo, `Grade`, `Alunos`, `Experimentais`, `Planos`, `Créditos`, `Feriados`, `Admin Yogue-se`, `Sair` pill | same | the guide has no admin nav; the shell follows BRAND-27 on the brand tokens |
| nav bottom rule 2px black | same | |
| page frame: 2px black border, 28px radius, two columns 1.75fr / 1fr | same | |
| left region: `Semana` 34px + period line | same | |
| week grid: day headers with dates, hour column `19h`, 72px cells | same | real week (7 days from today) instead of the guide's 5 weekdays and 3 example hours; the spec states real data for the same composition |
| slot: pressed slot with peach fill and black 2px border, mini 4x2 dots for fixed/makeup/experimental/free | same | |
| slot label | same | `Clássico` and `Intenso` in full at 13.5px/800 on both slots, the guide's short kind; no ellipsis |
| empty slot: 2px dashed `--linha`, 16px radius, 72px | same | |
| panel: `--papel-2` background, 2px black rule on the left | same | |
| panel title `Segunda, 19h` 30px + `Superioga Clássico · 16/11/2026` | same | |
| panel free count `3` 40px + `vagas livres` | same | |
| panel duck row: 8 ducks, lg 40x52, fixed black / experimental peach dotted / free grey dashed | same | guide draws the row beside the count at 24x31; picture draws it below at lg |
| group chip `Fixo · 2` with 8 xs ducks | same | the guide draws a plain group heading with one xs duck; the spec (BRAND-28) asks for the chip with the xs duck |
| fixed roster rows with `Ver cadastro` link | same | |
| makeup roster group | same | absent because this turma has no makeup; the guide shows the group with its `Confirmada` chip |
| experimental group chip `Experimental · 3` and the three names | same | guide adds `Aprovar` pill / `Aprovada` chip; approving lives on `/experimentais`, behaviour unchanged |
| `Adicionar agendamento` block | same | the guide draws a black pill that opens one form; picture draws a heading with the app's three booking forms expanded below |
| render: no horizontal overflow at 1440 | same | frame is 1376px wide, panel 499px |

### `captures/grade.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav and 2px rule | same | |
| page frame 2px black + 28px radius, 1.75fr / 1fr columns | same | |
| `Semana` + period line | same | |
| week grid day headers and dates, hour label, dashed empty cells | same | real data |
| slot pressed state: peach fill, 2px black border, peach own dot | same | |
| slot mini ducks 4x2, fixed/makeup/experimental/free | same | |
| slot label | same | `Clássico` and `Intenso` in full, 13.5px/800, no ellipsis |
| panel background, divider, title, modality and date | same | |
| panel `3 vagas livres` + duck row lg | same | |
| group chips `Fixo · 2` and `Experimental · 3` with xs ducks | same | |
| fixed rows + `Ver cadastro` | same | |
| experimental rows | same | three names, no status mark; the guide marks `Aprovar`/`Aprovada` (approving is not an action of this screen) |
| booking forms under `Adicionar agendamento` | same | heading + always-open forms instead of the guide's pill |
| render | same | |

### `captures/grade-panel.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| state: a slot clicked so the aside opens | same | the clicked slot (Segunda, 19h) was already the selected one, so the picture shows the same turma open and the slot pressed |
| page frame, nav, `Semana` region, week grid | same | |
| slot label | same | `Clássico` and `Intenso` in full, no ellipsis |
| aside: closed-to-open state | same | aside open with the turma roster |
| aside content: title, modality, free count, ducks lg, `Fixo · 2`, roster, `Experimental · 3`, three names, booking forms | same | |
| render | same | |

### `captures/alunos.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav, 2px rule, `Sair` pill | same | |
| heading `Alunas` 34px + subtitle `Cadastro completo com telefone, e-mail, plano, status e observações.` | same | no guide screen for this route; shell follows BRAND-27 |
| `Nova aluna` card: 2px black border, 28px radius, pena fill | same | |
| form fields Nome, Telefone, E-mail, Data de nascimento, Data de matrícula, Status, Plano, Observações in the guide field style | same | |
| black pill `Cadastrar aluna` | same | |
| `Alunas cadastradas` list: name, plan line, `Ativo` chip, `Ver detalhe` and `Editar` text links, `Inativar` secondary pill, 1px dividers | same | |
| render: no overlap or cut off | same | |

### `captures/planos.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav, `Sair` pill | same | |
| heading `Planos` + subtitle | same | |
| `Criar plano` card with Nome, Valor mensal (R$), Aulas por semana, Descrição and black pill `Criar plano` | same | |
| `Planos cadastrados` heading + divider | same | |
| plan row: `Mensal 2x`, `2 aulas por semana · Plano do walk`, `R$ 180,00`, `Ativo` chip | same | |
| plan edit form: Nome, Valor mensal, Aulas por semana, Descrição, `Salvar alterações` and `Inativar plano` pills | same | printed open under the row; no guide screen for this route |
| render | same | the `Nome` label is touched by the Next dev badge (dev overlay, not the app) |

### `captures/creditos.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav, `Sair` pill | same | |
| heading `Créditos de reposição` + subtitle | same | |
| `Aluno` label + select in the guide field style | same | |
| secondary pill `Abrir créditos` | same | |
| selected student heading `Aluno Teste 1` | same | |
| `Conceder crédito` card: 2px black border, 28px radius, field `Motivo da concessão`, black pill `Conceder crédito` | same | |
| `Créditos` heading + empty state `Nenhum crédito para este aluno.` | same | empty state as plain text; the guide's dashed card with duck belongs to the student area |
| render: no overlap, text readable | same | the `Créditos` heading sits close under the card |

### `captures/feriados.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav, `Sair` pill | same | |
| heading `Feriados e recessos` + two-line subtitle | same | |
| left card `Cadastrar feriado`: Data, Nome, black pill `Cadastrar feriado` | same | |
| right card `Cadastrar recesso`: Início, Fim, Motivo, black pill `Cadastrar recesso` | same | |
| `Feriados` heading + `Nenhum feriado cadastrado.` | same | |
| `Recessos` heading + `Nenhum recesso cadastrado.` | same | |
| render: the two cards sit side by side at 1440, no overflow | same | |

### `captures/experimentais.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| admin nav, `Sair` pill | same | |
| heading `Aulas experimentais` + subtitle | same | |
| `Buscar por telefone` field with placeholder and secondary pill `Buscar` | same | |
| `Solicitações` heading + 1px dividers | same | |
| request row: name 17px, phone, modality, `Solicitada em` line, class date and time, `Pagamento` line | same | |
| status chip at the right (Pendente de aprovação, Tentativa duplicada, Cancelada sem direito a reagendamento, Convertida em aluna, Falta, Aprovada, Recusada) | same | all statuses use the guide's `.chip.cl` (pessego-claro, no border); the guide's error chip exists for failures, no error state is drawn in this picture |
| `Ver detalhe` underlined text link per row | same | |
| render: long list, no overlap or cut off, rows readable | same | the 4th row is touched by the Next dev badge (dev overlay) |
