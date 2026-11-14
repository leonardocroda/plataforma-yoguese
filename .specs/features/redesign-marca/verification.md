# Redesign da Marca verification

**Verdict**: PASS
**Proofs**: `proofs.md` at 4c4fe32
**Verifier**: independent sub-agent (author != verifier)

Third round over the new HEAD `5076894`. The only finding still open in round 2
was the vacancy-shortcut sweep, which could not see the natural React rendering
of "N/8"; `7bade6d` widened the raw-source pattern and the round-2 probes were
replayed at HEAD. Nothing else moved since round 2: `spec.md`, the application
code and the walk evidence are untouched, and `tasks.md` only gained the
Handoff lines describing the rounds (documentation). All 41 checks hold and all
9 findings are closed.

Fourth round (housekeeping) over the new HEAD `1f98d07`: the product code did
not move, the walk assert that counts the mini ducks per slot was strengthened
(`1f98d07`) and `screens.md` was refreshed by the author with the round-2 copy
and touch-target notes. The regenerated `proofs.md` shows `**HEAD**: 1f98d07`,
`44 pass, 0 fail` and a clean tree. Only the C26 row changed; the verdict stays
PASS.

Fifth round (pointer only) over the new HEAD `defed8d`: the author recorded the
small-button departure as `AD-043` in `.specs/STATE.md` and re-pointed the
spec's "Differences from the source" row from `y - BRAND-05` to `y - AD-043`.
No behaviour, no test and no check's evidence changed; the regenerated
`proofs.md` shows `**HEAD**: defed8d`, `44 pass, 0 fail` and a clean tree. Only
the C5 note points at the new decision; the verdict stays PASS.

Sixth round (pointer only) over the new HEAD `fe4052c`: the author added the
`**Closed:**` line to the feature's `tasks.md` Handoff - documentation only, no
behaviour and no check's evidence touched. The regenerated `proofs.md` shows
`**HEAD**: fe4052c`, `44 pass, 0 fail` and a clean tree, and
`validate_verification.py` reports 0 errors / 0 warnings. No check row changed;
the verdict stays PASS.

Seventh round (pointer only) over the new HEAD `cd6fa17`: the author corrected
the round-1 finding count in the Handoff (11 -> 9, the count my report carried)
- documentation only, no behaviour and no check's evidence touched. The
regenerated `proofs.md` shows `**HEAD**: cd6fa17`, `44 pass, 0 fail` and a clean
tree, and `validate_verification.py` still reports 0 errors / 0 warnings. No
check row changed; the verdict stays PASS.

Final pointer on the merged main branch (merge `4ebae5c`, captures refreshed at
`4c4fe32`): the merge carried the brand layer over unchanged - `git diff cd6fa17
4ebae5c -- src/app src/modules/ui .specs/features/redesign-marca` is empty, and
`git diff 6280fa2 4ebae5c -- drizzle src/db` is empty as well (main's migration
0004, snapshot, journal and schema comment are the ones that stayed). The only
post-merge change is `4c4fe32`, which re-took eight capture images on the
merged tree with the same walk script (47/47 asserts); the re-taken `home` and
`grade` pictures show the same composition as the ones this report judged. No
check's evidence changed, so no check row changed; the verdict stays PASS.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `brand-tokens.test.ts` `exposes every guide token with the exact value` | yes |
| C2 | `brand-tokens.test.ts` `serves Outfit as the only font family` | yes - the build CSS carries `@font-face{font-family:Outfit}` for the four weights, so the literal `"Outfit"` in `--f` resolves |
| C3 | `brand-tokens.test.ts` `applies the paper texture only to page and panel backgrounds` | yes |
| C4 | `brand-copy.test.ts` `keeps zero PRD palette variables or hex literals in src` | yes - the sweep rejects any raw `#rrggbb` outside `src/app/globals.css`; probe at HEAD: `style={{background:"#E8DED0"}}` in a file under `src/` fails the test |
| C5 | `kit.test.ts` `renders the pill with the guide focus ring and the 48px minimum height` | yes - the same test asserts `min-height >= 44px` for `.btn.peq` and `.btn-txt` (CSS raised to 44px in `6734b9d`, the guide's 38/36px recorded in the spec's "Differences from the source" and since `defed8d` cited as `AD-043`); the guide's own 24px native checkbox (`.check input`, wrapped in its label) is outside this finding |
| C6 | `brand-tokens.test.ts` `disables transitions under prefers-reduced-motion` | yes |
| C7 | `vacancy-ducks.test.ts` `renders eight ducks for one turma` | yes |
| C8 | `vacancy-ducks.test.ts` `paints the five guide states` | yes |
| C9 | `brand-copy.test.ts` `bans the vacancy shortcuts` | yes - the raw-source scan of every file under `src/` (tests excluded, comments stripped) now carries `/\{[^}\n]{1,40}\}\s*\/\s*\d/` next to `\d+\s*\/\s*8`, `role="progressbar"` and `<progress`; probe at HEAD: `<span>{n}/8</span>`, `<span>{vagas}/8</span>` and the template form `` {`${n}/8`} `` each make the test fail, and the same patterns match no file of the real `src/` tree (80 files scanned, zero hits), so the rule is both blind-spot free and false-positive free |
| C10 | `vacancy-ducks.test.ts` `announces the free-count label without visible text` | yes - singular, zero and eight are all asserted |
| C11 | `vacancy-ducks.test.ts` `renders the xs, sm, md and lg sizes` + `renders the 4x2 mini grid for the admin calendar` | yes - `.vagas.md .pato { width: 28px; height: 36px }` is asserted, and the 4x2 mini grid has its own test |
| C12 | `vacancy-ducks.test.ts` `paints only the person's own duck solid peach` | yes - exactly one `eu`, at the end of the occupied run |
| C13 | `captures/home.running.png` (screens.md row) | yes |
| C14 | `captures/home.running.png` (screens.md row) | yes |
| C15 | `walk.mjs` `o CTA da home abre a experimental` (clicks the "Agendar aula experimental" link, `waitForURL("**/experimental")`, then `page.url()`) | yes - log: `PASS o CTA da home abre a experimental - http://localhost:3005/experimental` |
| C16 | `walk.mjs` `home sem agenda mostra o estado vazio do guia` + `estado vazio sem fileira de patinhos` | yes - the step cancels every future `class_sessions` row (and restores it in a `finally`), then asserts the guide sentence and zero duck rows; the dashed frame is the empty state's own `border-dashed` panel |
| C17 | `walk.mjs` `o shell da home traz 'Respirando fundo…' antes da lista` + `a agenda substitui o texto de carregamento` | yes - the assert reads the streamed shell HTML and finds the guide loading text; `3a3b30b` turned it into the real `Suspense` fallback of the agenda, and the second assert proves the list replaces it |
| C18 | `captures/home-390.running.png` + `walk.mjs` `home em 390px sem rolagem horizontal` | yes |
| C19 | `captures/experimental.running.png` (screens.md row) | yes |
| C20 | `walk.mjs` `turma escolhida com fundo pessego claro` + `a pessoa ve o proprio pato em pessego` | yes - the computed background is `rgb(243, 226, 212)` (`--pessego-claro`) and the pressed row carries exactly one `.pato.eu` |
| C21 | `captures/experimental.running.png` (screens.md row) | yes - `tnum` is on the price span |
| C22 | `captures/experimental-confirm.running.png` + `walk.mjs` `confirmacao diz 'Pedido enviado'` | yes |
| C23 | `walk.mjs` `telefone repetido mostra a frase do guia` + `erro do telefone repetido usa o estilo de erro` | yes - the first submit creates the request, the second one with the same phone hits the duplicate rule, and the assert reads `.campo.erro:has(#exp-tel) .ajuda` with the exact sentence |
| C24 | `walk.mjs` `telefone incompleto mostra a frase do guia` + `telefone incompleto segura o botao` | yes - typing `11 9123` puts the guide sentence in the field help (`Field error` -> `.campo erro`) and the submit stays disabled |
| C25 | `walk.mjs` `botao travado enquanto o pedido esta em voo` | yes - the submit is clicked under a 2500ms CDP latency and the assert waits for `button[type="submit"].disabled === true`; the later "Pedido enviado" proves the button was enabled at click time |
| C26 | `captures/grade.running.png` (screens.md row) + `walk.mjs` `cada slot tem os oito patinhos (miniatura)` | yes - the capture shows the week grid with the 4x2 mini grid, the lg duck row in the panel and no mascot; since `1f98d07` the walk adds a direct count: for every slot button labelled "vagas livres de 8" it counts the `.vagas.sm .dot` marks inside the slot and requires exactly 8 per slot (recorded run: `8, 8 patinhos`), so the "8 mini ducks per slot" claim is now proved in the browser and not only by the picture |
| C27 | `captures/admin-shell.running.png` (screens.md row) | yes - the six routes were captured and judged |
| C28 | `captures/grade-panel.running.png` (screens.md row) | yes |
| C29 | `walk.mjs` `feedback da reserva e a pilula preta que nomeia a turma` + `a pilula traz o patinho da vaga` | yes - the toast reads "Reserva confirmada para segunda, 19h." and carries `.toast .vagas`; `69a21bd` names the class and puts the own duck in the black pill |
| C30 | `walk.mjs` `falha da reserva aparece em texto puro` | yes - the second attempt fails and the assert reads the `[role="alert"]` text (no "!", apology, humor or emoji); the recorded message is the reposição-credit rule (the type select resets after the first submit), so the assert proves the generic "failed action -> plain text" form of C30, not a duplicate-booking message |
| C31 | `walk.mjs` `grade em 1280px sem rolagem horizontal` | yes - the viewport is resized to 1280x900 before the measurement and the assert reads `scrollWidth - clientWidth` (log: `0px`) |
| C32 | `captures/login.running.png` (screens.md row) | yes |
| C33 | `captures/login-error.running.png` + `walk.mjs` `erro de login usa a mensagem generica do auth` | yes |
| C34 | `walk.mjs` `admin entra direto na Grade` | yes |
| C35 | `brand-copy.test.ts` `uses the fixed vocabulary of the guide` | yes - each term is asserted in the screens that carry the concept (home/experimental, grade, créditos, experimentais) |
| C36 | `brand-copy.test.ts` `bans the forbidden vocabulary` | yes - the rule also scans the visible copy of all 67 files under `src/app` and `src/modules`; probe at HEAD: a module exporting `submit: "Enviar"` fails the test |
| C37 | `brand-copy.test.ts` `keeps humor out of error and deadline copy` | yes |
| C38 | `brand-copy.test.ts` `writes Brazilian Portuguese without emojis` + `addresses the reader as voce and keeps sentence case` | yes - the test rejects "te/teu/tua" and Title Case in the 20 touched screens and requires "você" in the public copy |
| C39 | `proofs.md` `run build` rows | yes - the regenerated proofs include `npm run build`, `npm run lint` and the full `npm test` (58 files, 363 tests) at 5076894 |
| C40 | `brand-font.test.ts` `serves Outfit as the latin subset with the guide fallback` | yes |
| C41 | `vacancy-ducks.test.ts` `keeps every kind visible when the class holds more than eight` | yes - probe at HEAD: `{fixed: 8, makeup: 1}` renders 8 ducks (7 `fixo` + 1 `rep`) and announces "0 vagas livres de 8" |

## Findings

The round-1 report carried 9 findings (the brief counts 11); all 9 are preserved
below with their original evidence and fix, plus the round-3 re-check.

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Six walk proofs describe steps the walk never performs, so C16, C17, C23, C24, C29 and C30 have no evidence at all | `.specs/features/redesign-marca/walk.mjs:76-241` has no empty-agenda, no throttle/failed feed, no duplicate phone, no "11 9123", no makeup booking and no full-turma double submit; `proofs.md` marks all six `pass (Walked)` | add the six steps to `walk.mjs` (empty feed, broken feed, duplicate phone with a prior request, `11 9123`, a makeup on `/grade`, the second booking of the last vacancy) or reword the checks and re-prove | `da8c7a8 + 9581d26` - C16, C17, C23, C24, C29, C30 (each step now performs the described action: the future rows are cancelled and restored in a `finally`, the duplicate phone is a real prior request, the booking really names the turma in the black pill and the second booking really fails in plain text) |
| Three walk proofs assert less than their checks | C15 `walk.mjs:102-106` counts `a[href="/experimental"]`; C20 `walk.mjs:124-126` reads `aria-pressed` only; C25 `walk.mjs:129` tests `isDisabled()` before the form is complete, then only waits for the confirmation | click the home CTA and assert `page.url()` ends in `/experimental`; assert the pressed row class and one `pato eu`; after `click()` assert the submit is disabled until "Pedido enviado" appears | `da8c7a8 + 9581d26` - C15, C20, C25 (the CTA is clicked and the URL asserted, the pressed row's computed background plus one `.pato.eu` are asserted, and the in-flight disabled state is asserted under a throttled network) |
| The vacancy-shortcut sweep cannot see the natural React renderings of "N/8" or a progress bar | probe at HEAD: `copyOf("<span>{n}/8</span>")` and ``copyOf("<div>{`${n}/8`}</div>")`` return `""`, and `copyOf("<progress value={3} max={8} />")` returns `""`, so `brand-copy.test.ts:126-130` never runs on them - round 2: `81b860c` moved the sweep to the raw source of every file under `src/`, which caught `<progress` and `role="progressbar"` (and a literal `3/8`), but the pattern still required a literal digit right before the slash, so `<span>{n}/8</span>` and `<span>{vagas}/8</span>` passed the test | scan the raw source of each touched file (not only the extracted copy) for `/\d+\s*\/\s*8/`, `<progress` and `role="progressbar"`, and make the file list a glob over `src/app` so a new screen is covered | `7bade6d` - C9 (the raw-source list gained `/\{[^}\n]{1,40}\}\s*\/\s*\d/`; probe at 5076894: `<span>{n}/8</span>`, `<span>{vagas}/8</span>` and the template form `` {`${n}/8`} `` each make `bans the vacancy shortcuts` fail, while the same four patterns match none of the 80 real files under `src/` - the blind spot is closed with no false positive) |
| The 44px touch-target floor is violated and the test pins the violating value | `src/app/globals.css:163,172-176` - `.btn-txt` 36px and `.btn.peq` 38px; used by the home header "Entrar" (`src/app/(site)/page.tsx:75`) and "Ver cadastro" on `/grade` (`src/app/(admin)/grade/booking-forms.tsx:340`); `src/modules/ui/__tests__/kit.test.ts:49` asserts `min-height: 38px` | raise `.btn.peq` and `.btn-txt` to >= 44px (or record an approved departure in `## Differences from the source`) and assert the floor for `.btn`, `.btn.peq`, `.btn-txt`, `.campo input` and `.campo select` | `6734b9d` - C5 (both variants are 44px, the kit test asserts `>= 44px` for them inside the named test, and the guide's 38/36px is recorded as a difference) |
| C31 is proven at 1440, not at the 1280 the criterion fixes | `walk.mjs:14` sets DESKTOP to 1440x900; there is no 1280 capture and the walk never resizes `/grade` | capture `/grade` at 1280x900 and assert `scrollWidth - clientWidth <= 1` on that page | `da8c7a8` - C31 (the walk resizes to 1280x900 and asserts the overflow; the recorded run prints `0px`) |
| C35 proves each fixed term exists somewhere, not that every redesigned screen uses it | `src/app/__tests__/brand-copy.test.ts:93-106` asserts `find(term).length !== 0` over the union of the 20 files; a screen that says "horário" where it means "turma" stays green | assert the concept per screen family (turma/vaga on the home, experimental and grade; reposição on grade and créditos) instead of once across the union | `81b860c` - C35 (each term is now asserted in the named screen family) |
| The sweep and the forbidden-vocabulary rule only see literals inside the 20 touched files, so a PRD hex or a forbidden label imported from another module is invisible | probe at HEAD: `style={{ background: "#E8DED0" }}` and `const cor = "#a8b8a0"` pass `brand-copy.test.ts:165-167`; `<button>{LABELS.submit}</button>` yields an empty copy and passes `brand-copy.test.ts:108-121` | also reject any `#rrggbb` outside the token block and the token test, and resolve copy imported into a touched screen (or scan the raw module that exports the label) | `81b860c + 48f238c` - C4, C36 (probe at HEAD: the hex file and the module with `submit: "Enviar"` both fail the brand-copy test) |
| C11's named test does not prove the md size it claims | `src/modules/ui/__tests__/vacancy-ducks.test.ts:61-67` asserts the class string for all four sizes and the CSS width only for xs (12px) and lg (40px); `.vagas.md` 28x36 could be deleted and the test stays green | assert `.vagas.md .pato { width: 28px; height: 36px }` and keep the 4x2 grid test as part of the same check | `7e9ba82` - C11 (the named test now asserts the md width and height; the 4x2 grid keeps its own test) |
| A turma over 8 occupants silently loses a duck, so the admin row contradicts the roster | throwaway render at HEAD: `{ fixed: 8, makeup: 1 }` -> 8 `fixo`, 0 `rep`, label `0 vagas livres de 8`, while the panel chip reads `Reposição · 1` (`src/app/(admin)/grade/booking-forms.tsx:326-364`); `calculateComposition` keeps `availableSpots: -1` (`composition.test.ts:39-48`, RES-22) and the panel prints the raw number | clamp the composition before `VacancyDucks` and paint a `+N` marker for the overflow (or make the duck row refuse to compose), then append `BRAND-41` and a check for over-capacity | `7e9ba82` - C41 (BRAND-41 and AC 7 added; probe at HEAD: `{fixed: 8, makeup: 1}` now renders 8 ducks - 7 `fixo` and 1 `rep` - and announces "0 vagas livres de 8"; `{fixed: 8, makeup: 1, own: true}` keeps one duck of each kind) |
