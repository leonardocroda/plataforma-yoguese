# Admin Calendario screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 1

Pictures retaken by this verifier from the running app (Edge/playwright-core, 1440x900 viewport, full page, overwriting the author's files): `admin-calendario-semana` and `admin-calendario-painel`, both 1440 wide at 1x. Logged in through `/login` (admin@yoguese.com), `/grade` opened the week containing today (09/11-15/11); the date selector went to 16/11/2026 for the first picture (Monday 19h of 16/11 selected, the cancelled occurrence) and to 23/11/2026 for the second (Tuesday 19h of 24/11 selected), the routes the `**Walked:**` line names. Judged against the binding guide `.specs/features/redesign-marca/captures/yogue-se-brand.html`, section "Admin: calendário e turma", applying the `## Differences from the source` table of `spec.md`. The dark circle at the lower left of both pictures is the Next.js dev-server badge, not the app, and is not judged. No console errors on either state.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/admin-calendario-semana.running.png` | guide: Admin: calendário e turma (section) | matches | |
| `captures/admin-calendario-painel.running.png` | guide: Admin: calendário e turma (section) | matches | |

### `captures/admin-calendario-semana.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: admin nav (logo, `Grade`, `Turmas`, `Alunos`, `Experimentais`, `Planos`, `Créditos`, `Feriados`, `Admin Yogue-se`, `Sair` pill) and its 2px black rule | same | the guide's admin screen draws only the workspace frame, no nav; the shell follows the app's admin layout on the brand tokens |
| calendar nav: tabs `Diária`, `Semanal` (peach, pressed), `Mensal`; `← Anterior`, `Próxima →`; `Data` field `16/11/2026`, `Ir`, `Hoje` | same | not drawn in the guide; the navigation the spec fixes (CAL-02..04, CAL-22), laid out on the brand pill/field components |
| page frame: 2px black border, 28px radius, two columns 1.75fr / 1fr with a 2px vertical rule | same | |
| left region heading `Semana`, 34px | same | |
| left region sentence `16/11/2026 a 22/11/2026. Cada horário mostra as 8 vagas da turma.` | same | the guide's sentence with the selected-period prefix, extra data |
| week grid: hour column plus 7 day columns `Seg`..`Dom` with the short date under each, 6px gaps | same | the guide draws 5 weekdays without dates; the spec fixes the Monday-to-Sunday week (CAL-01) and the dates are real data |
| hour rows `09h30` and `19h` | same | real turma times replace the guide's example rows 7h / 19h / 20h |
| filled slot: 2px border, 16px radius, 72px minimum height, short modality at 13.5px/800 and 8 mini dots in a 4x2 grid | same | |
| slot state mark `Cancelada` under Monday 19h and `Bloqueada` under Wednesday 09h30, red 11px | same | the guide draws no state mark; cancelled and blocked visible with a selo is the spec's difference (CAL-07, CAL-08) |
| pressed slot (Monday 19h): peach fill and 2px black border | same | |
| empty slot: 2px dashed `--linha` border, 72px | same | |
| render: no overlap, nothing cut off, no horizontal scroll at 1440 (frame 1376 wide) | same | |
| panel: `--papel-2` fill, 2px black rule on the left, 26/28px padding | same | |
| panel title `Segunda, 19h`, 30px | same | the guide sets the same title at 34px |
| panel modality line `Superioga Clássico · 16/11/2026`, grey 15px | same | the class name is the registered one; the date is extra data |
| panel state sentence `Cancelada: a grade da turma mudou.` in the error token | same | the guide draws no state sentence; the cancelled occurrence carries it (spec difference) |
| free count `7` at 40px with `vagas livres` | same | |
| duck row: 8 lg ducks 40x52, 1 fixed black and 7 free dashed, below the count | same | the guide draws 8 ducks at 24x31 beside the count |
| group chip `Fixo · 1` with 8 xs dots (1 black, 7 dashed) | same | the guide draws the heading `Alunos fixos` with one xs duck; the picture uses the guide's `Fixo` chip and adds the count |
| fixed roster row `Elisa Conversao` with the underlined `Ver cadastro` link, 1px divider | same | |
| `Reposições` and `Aulas experimentais` groups | same | absent because this turma has no makeup or experimental in this state; the guide draws them for its example Tuesday |
| notices block: `Ana Walk: cancelamento, sem crédito` and `1 reservas canceladas pelo estúdio` | same | extra: the occurrence history CRD-09 requires; the guide draws none |
| `Adicionar agendamento` heading at 20px with the booking forms expanded below | same | the guide draws a black pill that opens one Aluno/Tipo form; the picture keeps the app's existing forms open |
| form `Reserva manual` select, `Tipo` select (`Reposição`), `Crédito da reposição` select, helper sentence, `Reservar` pill | same | the app's existing manual-booking form; the guide's form names the fields `Aluno` / `Tipo` |
| form `Horário fixo` select + `Vincular fixo` pill | same | extra: the app's existing fixed-enrolment form |
| form `Avisar que não vou` select + `Registrar aviso` pill | same | extra: the app's existing absence-notice form (CRD-09) |
| `Cancelar aula` secondary pill | same | extra: studio cancellation (CAL-12..17), not drawn in the guide |
| render: panel content fits the frame, no overlap or cut off | same | |

### `captures/admin-calendario-painel.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: admin nav (logo, `Grade`, `Turmas`, `Alunos`, `Experimentais`, `Planos`, `Créditos`, `Feriados`, `Admin Yogue-se`, `Sair` pill) and its 2px black rule | same | no nav in the guide's admin screen; the app's admin layout |
| calendar nav: tabs with `Semanal` pressed, `← Anterior`, `Próxima →`, `Data` field `23/11/2026`, `Ir`, `Hoje` | same | not drawn in the guide; the spec's navigation (CAL-02..04, CAL-22) |
| page frame: 2px black border, 28px radius, 1.75fr / 1fr columns with the 2px vertical rule | same | |
| left region heading `Semana` and the sentence `23/11/2026 a 29/11/2026. Cada horário mostra as 8 vagas da turma.` | same | the guide's sentence with the selected-period prefix |
| week grid: hour column plus 7 day columns `Seg`..`Dom` dated 23/11..29/11, 6px gaps | same | 7 columns per CAL-01; dates are extra data |
| hour rows `09h30` and `19h` | same | real data replaces the guide's example rows |
| filled slots: 2px border, 16px radius, 72px, short modality and 8 mini dots in 4x2 | same | |
| pressed slot (Tuesday 19h): peach fill, 2px black border | same | |
| empty slots: 2px dashed `--linha`, 72px | same | |
| render: no overlap, cut off or horizontal scroll at 1440 | same | |
| panel: `--papel-2` fill, 2px black rule on the left | same | |
| panel title `Terça, 19h`, 30px | same | the guide's title is 34px |
| panel modality line `Superioga Intenso · 24/11/2026`, grey | same | registered class name and real date |
| free count `2` at 40px with `vagas livres` | same | the guide's example reads `1 vaga livre`; real composition |
| duck row: 8 lg ducks 40x52 below the count, 5 fixed black, 1 experimental dotted peach, 2 free dashed | same | the guide draws 24x31 beside the count and its example carries a makeup duck |
| group chip `Fixo · 5` with 8 xs dots | same | the guide draws the `Alunos fixos` heading with one xs duck; the picture uses the guide's `Fixo` chip with the count |
| fixed roster: `Elisa Conversao`, `Walk Calendario 1`, `Walk Calendario 2`, `Walk Calendario 3`, `Walk Calendario 4`, each with the underlined `Ver cadastro` link and a 1px divider | same | real roster (5 fixed) |
| `Reposições` group | same | absent in this state: the only makeup booking belongs to `Walk Calendario 1`, already listed as fixed, so the composition does not draw it twice; the guide draws the group with a `Confirmada` chip |
| group chip `Experimental · 1` and the row `Walk Calendario Visitante` | same | the guide draws the `Aulas experimentais` heading and marks the experimental `Aprovar` (pending) or `Aprovada` (approved); this panel lists the participant without a status mark, approving living on `/experimentais` |
| `Bloqueio nesta data` heading + `Bloquear nesta data` secondary pill | same | extra: the per-class/date block the spec adds (CAL-18..21); the guide draws no block control |
| `Adicionar agendamento` heading with the forms expanded | same | the guide draws a black pill that opens one form; the picture keeps the app's existing forms open |
| `Reserva manual` select, `Tipo` select (`Reposição`), `Crédito da reposição` select, helper sentence, `Reservar` pill | same | the app's existing manual-booking form |
| `Horário fixo` select + `Vincular fixo` pill | same | extra: the existing fixed-enrolment form |
| `Avisar que não vou` select + `Registrar aviso` pill | same | extra: the existing absence-notice form |
| `Cancelar aula` secondary pill | same | extra: studio cancellation (CAL-12..17) |
| render: 1836px full page, frame closes at 1797 with its bottom border visible, no overlap or unreadable text | same | |
