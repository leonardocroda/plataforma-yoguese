# Admin Calendario screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 2

Pictures retaken by this verifier from the running app (chromium/playwright-core, 1440x900 viewport, full page, 1x, overwriting both files): `admin-calendario-semana.running.png` (1440x1501) and `admin-calendario-painel.running.png` (1440x1947). Logged in through `/login` (admin@yoguese.com) and reached the two states the `**Walked:**` line names: `/grade?view=semana&data=2026-11-18` (week 16/11-22/11, the holiday block on Wednesday, the cancelled Monday 19h as the first occurrence and therefore the panel) and `/grade?view=semana&data=2026-11-28&ocorrencia=<slot>|2026-11-24` (panel of Tuesday 24/11: 5 fixed, 1 makeup, 1 experimental, 1 free vaga). The database at capture time agrees: 16/11 CANCELADA, 18/11 BLOQUEADA by `Walk Calendario feriado`, 24/11 AGENDADA with the `Walk Calendario 5` makeup and the approved experimental. Judged against the binding guide `.specs/features/redesign-marca/captures/yogue-se-brand.html`, section "Admin: calendário e turma", applying the `## Differences from the source` table of `spec.md`. Round 1 had no `differs` rows; this round reopens both pictures and every row because the fix pass changed code both pictures draw (the week legend and the makeup `Ver cadastro` link). The dark circle at the lower left of both pictures is the Next.js dev-server badge, not the app, and is not judged. No console errors, no horizontal scroll (`scrollWidth` = `clientWidth` = 1440) on either state.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/admin-calendario-semana.running.png` | guide: Admin: calendário e turma (section) | matches | |
| `captures/admin-calendario-painel.running.png` | guide: Admin: calendário e turma (section) | matches | |

### `captures/admin-calendario-semana.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: admin nav (logo, `Grade`, `Turmas`, `Alunos`, `Experimentais`, `Planos`, `Créditos`, `Feriados`, `Admin Yogue-se`, `Sair` pill) and its 2px black rule | same | the guide's admin screen draws only the workspace frame, no nav; the shell follows the app's admin layout on the brand tokens |
| calendar nav: tabs `Diária`, `Semanal` (peach, pressed), `Mensal`; `← Anterior`, `Próxima →`; `Data` field `18/11/2026`, `Ir`, `Hoje` | same | not drawn in the guide; the navigation the spec fixes (CAL-02..04, CAL-22), laid out on the brand pill/field components |
| page frame: 2px black border, 28px radius, two columns 1.75fr / 1fr with a 2px vertical rule | same | |
| left region heading `Semana`, 34px | same | |
| left region sentence `16/11/2026 a 22/11/2026. Cada horário mostra as vagas da turma.` | same | the guide reads `Cada horário mostra as 8 vagas da turma.`; the approved difference (last row of the table) makes the legend speak of the class's vacancies, and the selected-period prefix is real data |
| week grid: hour column plus 7 day columns `Seg`..`Dom` with the short date under each, 6px gaps | same | the guide draws 5 weekdays without dates; the spec fixes the Monday-to-Sunday week (CAL-01, approved difference) and the dates are real data |
| hour rows `09h30` and `19h` | same | real turma times replace the guide's example rows 7h / 19h / 20h |
| filled slot: 2px border, 16px radius, 72px minimum height, short modality at 13.5px/800 and 8 mini dots in a 4x2 grid | same | |
| slot state mark `Cancelada` under Monday 19h and `Bloqueada` under Wednesday 09h30, red 11px | same | the guide draws no state mark; cancelled and blocked visible with a selo is the spec's difference (CAL-07, CAL-08) |
| pressed slot (Monday 19h): peach fill and 2px black border | same | |
| empty slot: 2px dashed `--linha` border, 72px | same | |
| render: no overlap, nothing cut off, no horizontal scroll at 1440 (frame 1376 wide) | same | |
| panel: `--papel-2` fill, 2px black rule on the left, 26/28px padding | same | |
| panel title `Segunda, 19h`, 30px | same | the guide sets the same title at 34px (type-size note) |
| panel modality line `Superioga Clássico · 16/11/2026`, grey 15px | same | the class name is the registered one; the date is extra data |
| panel state sentence `Cancelada: a grade da turma mudou.` in the error token | same | the guide draws no state sentence; the cancelled occurrence carries it (approved difference, CAL-08) |
| free count `7` at 40px with `vagas livres` | same | |
| duck row: 8 lg ducks 40x52, 1 fixed black and 7 free dashed, below the count | same | the guide draws 8 ducks at 24x31 above the count (size and order note) |
| group chip `Fixo · 1` with 8 xs dots (1 black, 7 dashed) | same | the guide draws the heading `Alunos fixos` with one xs duck; the picture uses the guide's `Fixo` chip and adds the count (approved difference, CAL-10/CAL-11) |
| fixed roster row `Elisa Conversao` with the underlined `Ver cadastro` link, 1px divider | same | |
| `Reposições` and `Aulas experimentais` groups | same | absent because this turma has no makeup or experimental in this state; the guide draws them for its example Tuesday |
| notices block: `Ana Walk: cancelamento, sem crédito` and `1 reservas canceladas pelo estúdio` | same | extra: the occurrence history CRD-09 requires; the guide draws none, and the count line is the app's existing copy |
| `Adicionar agendamento` heading at 20px with the booking forms expanded below | same | the guide draws a black pill that opens one Aluno/Tipo form; the picture keeps the app's existing booking forms open (spec keeps the booking flow untouched) |
| form `Reserva manual` select, `Tipo` select (`Reposição`), `Crédito da reposição` select, helper sentence, `Reservar` pill | same | the app's existing manual-booking form; the guide's form names the fields `Aluno` / `Tipo` |
| form `Horário fixo` select + `Vincular fixo` pill | same | extra: the app's existing fixed-enrolment form |
| form `Avisar que não vou` select + `Registrar aviso` pill | same | extra: the app's existing absence-notice form (CRD-09) |
| `Cancelar aula` secondary pill | same | extra: studio cancellation (CAL-12..17), not drawn in the guide |
| render: panel content fits the frame, no overlap or cut off; full page closes with the frame's bottom border visible | same | |

### `captures/admin-calendario-painel.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: admin nav (logo, `Grade`, `Turmas`, `Alunos`, `Experimentais`, `Planos`, `Créditos`, `Feriados`, `Admin Yogue-se`, `Sair` pill) and its 2px black rule | same | no nav in the guide's admin screen; the app's admin layout |
| calendar nav: tabs with `Semanal` pressed, `← Anterior`, `Próxima →`, `Data` field `28/11/2026`, `Ir`, `Hoje` | same | not drawn in the guide; the spec's navigation (CAL-02..04, CAL-22) |
| page frame: 2px black border, 28px radius, 1.75fr / 1fr columns with the 2px vertical rule | same | |
| left region heading `Semana` and the sentence `23/11/2026 a 29/11/2026. Cada horário mostra as vagas da turma.` | same | the guide's sentence with the selected-period prefix and the approved legend change (last row of the table) |
| week grid: hour column plus 7 day columns `Seg`..`Dom` dated 23/11..29/11, 6px gaps | same | 7 columns per CAL-01 (approved difference); dates are extra data |
| hour rows `09h30` and `19h` | same | real data replaces the guide's example rows |
| filled slots: 2px border, 16px radius, 72px, short modality and 8 mini dots in 4x2 | same | |
| pressed slot (Tuesday 19h): peach fill, 2px black border | same | |
| empty slots: 2px dashed `--linha`, 72px | same | |
| render: no overlap, cut off or horizontal scroll at 1440 | same | |
| panel: `--papel-2` fill, 2px black rule on the left | same | |
| panel title `Terça, 19h`, 30px | same | the guide sets the same title at 34px (type-size note) |
| panel modality line `Superioga Intenso · 24/11/2026`, grey | same | registered class name and real date |
| free count `1` at 40px with `vaga livre` | same | the guide's example reads the same; real composition |
| duck row: 8 lg ducks 40x52 below the count, 5 fixed black, 1 makeup, 1 experimental dotted peach, 1 free dashed | same | the guide draws 24x31 above the count and its example carries no makeup duck (size and order note) |
| group chip `Fixo · 5` with 8 xs dots | same | the guide draws the `Alunos fixos` heading with one xs duck; chips with counts are the approved difference (CAL-10/CAL-11) |
| fixed roster: `Elisa Conversao`, `Walk Calendario 1`, `Walk Calendario 2`, `Walk Calendario 3`, `Walk Calendario 4`, each with the underlined `Ver cadastro` link and a 1px divider | same | real roster (5 fixed) |
| `Reposições` group: chip `Reposição · 1`, row `Walk Calendario 5` with the `Confirmada` chip and the underlined `Ver cadastro` link | same | the guide draws the `Reposições` heading and marks its makeup only with `Confirmada`; the chip is the approved difference, and the link is CAL-11 (a participant opens the cadastro) applied to this roster row as it already is to the fixed ones |
| group chip `Experimental · 1` and the row `Walk Calendario Visitante` | same | the guide draws the `Aulas experimentais` heading and marks the experimental `Aprovar` (pending) or `Aprovada`; this panel shows the vínculo only, approving lives on `/experimentais` (core-experimentais) |
| `Bloqueio nesta data` heading + `Bloquear nesta data` secondary pill | same | extra: the per-class/date block the spec adds (CAL-18..21); the guide draws no block control |
| `Adicionar agendamento` heading with the forms expanded | same | the guide draws a black pill that opens one form; the picture keeps the app's existing forms open |
| `Reserva manual` select, `Tipo` select (`Reposição`), `Crédito da reposição` select, helper sentence, `Reservar` pill | same | the app's existing manual-booking form |
| `Horário fixo` select + `Vincular fixo` pill | same | extra: the existing fixed-enrolment form |
| `Avisar que não vou` select + `Registrar aviso` pill | same | extra: the existing absence-notice form |
| `Cancelar aula` secondary pill | same | extra: studio cancellation (CAL-12..17) |
| render: full page 1440x1947, frame closes with its bottom border visible, no overlap or unreadable text | same | |
