# Redesign da Marca Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: none - decisions inline in `context.md` and this file (straightforward reskin: tokens + small UI kit + screen rewrites; no new architecture)
**Status**: Approved
**Approved**: 2026-11-12 - user: "Aprovo"
**Build**: `npm run build; npm run lint; npm test`
**Run brand**: `npx vitest run src/modules/ui/__tests__/kit.test.ts src/modules/ui/__tests__/vacancy-ducks.test.ts src/app/__tests__/brand-tokens.test.ts src/app/__tests__/brand-font.test.ts src/app/__tests__/brand-copy.test.ts --reporter=verbose`
**Run build**: `npm run build; npm run lint; npm test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `vitest.config.ts` (convention comment: `*.test.ts` unit, `*.int.test.ts` integration with Testcontainers). No component/e2e harness exists in the repo (no @testing-library, no Playwright suite); the previous features proved screens with walks over playwright-core against the dev server - same pattern used here.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| UI kit / ducks (presentation) | unit (markup assertions via `react-dom/server`, node env) | All branches of each component: every state, size, a11y label, disabled | `src/modules/ui/__tests__/*.test.ts` | `npx vitest run <file> --reporter=verbose` |
| Design tokens / CSS config | unit (file-content assertions on `globals.css`) | Every token of the guide with exact value; zero PRD palette variables; reduced-motion block | `src/app/__tests__/brand-tokens.test.ts` | `npx vitest run src/app/__tests__/brand-tokens.test.ts --reporter=verbose` |
| Root layout font wiring | unit (file-content assertions on `layout.tsx`) | Outfit latin subset + guide fallback declared once | `src/app/__tests__/brand-font.test.ts` | `npx vitest run src/app/__tests__/brand-font.test.ts --reporter=verbose` |
| Screen copy (voice) | unit (file-content assertions on the touched route files) | Fixed vocabulary present; forbidden vocabulary absent; no emojis; humor nowhere near errors | `src/app/__tests__/brand-copy.test.ts` | `npx vitest run src/app/__tests__/brand-copy.test.ts --reporter=verbose` |
| Routes / screens | none in-repo harness - walk + browser captures against the dev server (playwright-core, precedent of `admin-base`/`core-feriados-recessos` walks) | Every route in scope at desktop + 390px: happy, empty, error, loading | `.specs/features/redesign-marca/screens.md` | `node .specs/features/redesign-marca/walk.mjs` |
| Business rules | none - unchanged by this feature; existing suite guards them | `npm test` green | `src/**/__tests__` | `npm test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only (T1-T4, T13) | `npx vitest run src/modules/ui/__tests__ src/app/__tests__/brand-tokens.test.ts src/app/__tests__/brand-font.test.ts --reporter=verbose` |
| Full | After the walk-dependent tasks (T4-T13, run after the batch's screens are up) | `npm run build; npm run lint; npm test` |
| Build | After phase completion or config/entity-only tasks | `npm run build; npm run lint; npm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. Every arrow below is one declared `Depends on`.

### Phase 1: Foundation

Design tokens, the base UI kit, the ducks and the root wiring - everything the screens stand on.

### Phase 2: Public screens and login

Home, experimental and login reskinned to the reference composition.

### Phase 3: Admin and closing

Admin shell and its six routes reskinned, then the voice pass and the walk.

```
Phase 1:  T1 -> T2
          T1 -> T3
          T1 -> T4

Phase 2:  T1 -> T5
          T2 -> T5
          T3 -> T5
          T1 -> T6
          T2 -> T6
          T3 -> T6
          T1 -> T7
          T2 -> T7

Phase 3:  T1 -> T8
          T2 -> T8
          T1 -> T9
          T2 -> T9
          T3 -> T9
          T8 -> T9
          T8 -> T10
          T8 -> T11
          T8 -> T12
          T5 -> T13
          T6 -> T13
          T7 -> T13
          T8 -> T13
          T9 -> T13
          T10 -> T13
          T11 -> T13
          T12 -> T13
```

**Batch packing (offer-then-confirm before Execute):** Batch A = Phases 1-2 (T1-T7), Batch B = Phase 3 (T8-T13). Two batches > 8 tasks, so the orchestrator offers batch sub-agents before dispatching (sub-agents.md).

---

## Task Breakdown

### T1: Brand tokens and Outfit in globals.css

**What**: Replace the PRD palette in `src/app/globals.css` with the guide's exact tokens (papel, papel-2, pena, preto, grafite, cinza, linha, pêssego, pêssego-claro, pêssego-forte, erro, erro-claro, radii pill/lg/md/sm, focus ring, the `--manchinhas` texture and the `.bolha` dotted-circle helper), load Outfit 400/500/600/800, and delete every `--yoguese-*` variable.
**Where**: `src/app/globals.css`
**Depends on**: None
**Reuses**: guide tokens from `captures/yogue-se-brand.html` (section "Tokens para copiar")
**Requirement**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-06

**Done when**:

- [x] Every token of the guide exists with the exact value; the `--yoguese-*` variables are gone from `globals.css` (the src-wide sweep is proven in T13)
- [x] Outfit is the only family and `--manchinhas` is only referenced by page/panel background rules, never by field, button, chip or toast rules
- [x] `prefers-reduced-motion` block present
- [x] Quick gate passes: `npx vitest run src/app/__tests__/brand-tokens.test.ts --reporter=verbose`
- [x] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

---

### T2: Base UI kit (Button, Field, Chip, Toast)

**What**: One file with the guide's base controls: `Button` (prim/sec/pes/txt variants, pill, 2px black border, 48px min-height, `peq` and disabled states), `Field` (label + control + help + error state), `Chip` (default/pêssego/pêssego-claro/erro) and the black `Toast` pill.
**Where**: `src/modules/ui/components/kit.tsx`
**Depends on**: T1
**Reuses**: tokens from T1; existing form markup patterns in `src/app/(admin)` screens
**Requirement**: BRAND-05

**Done when**:

- [x] Each control renders with the guide's shape, border, radius and focus ring; disabled Button keeps 35% opacity
- [x] Field error state shows the help text in the error token
- [x] Toast is the black pill, `role="status"`
- [x] Quick gate passes: `npx vitest run src/modules/ui/__tests__/kit.test.ts --reporter=verbose`
- [x] Test count: 5 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

---

### T3: VacancyDucks component

**What**: The duck row: 8 ducks per turma in the five states (fixed, makeup, experimental, own, free), sizes xs/sm/md/lg, the sm variant as the 4x2 mini grid for the admin calendar, and the screen-reader label "N vagas livres de 8"; the duck artwork is `public/assets/pato.png` derived SVG per the guide (never redrawn).
**Where**: `src/modules/ui/components/vacancy-ducks.tsx`
**Depends on**: T1
**Reuses**: the duck SVG symbol of the guide (`#pato`, states via `--d-*` custom properties), `public/assets/pato.png`
**Requirement**: BRAND-07, BRAND-08, BRAND-09, BRAND-10, BRAND-11, BRAND-12

**Done when**:

- [x] Every state paints exactly as the guide (solid black / pena+outline / peach dotted / solid peach / grey dashed); only the person's own duck is solid peach
- [x] The accessible label is `aria-label` (or sr-only text) with the free count, invisible on screen
- [x] The sm variant renders the 4x2 grid; xs/md/lg exist
- [x] Quick gate passes: `npx vitest run src/modules/ui/__tests__/vacancy-ducks.test.ts --reporter=verbose`
- [x] Test count: 6 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

---

### T4: Root layout wiring (font, papel body, texture)

**What**: `src/app/layout.tsx` applies the Outfit variable to `<html>` (latin subset, guide fallback stack), the papel background + manchinhas texture to `<body>`, and the guide's base typography (h1-h5 Outfit 800, tracking -0.03em; body Outfit 400/500 16-18px, line-height 1.6); no screen keeps hardcoded hex colors.
**Where**: `src/app/layout.tsx`
**Depends on**: T1
**Reuses**: tokens from T1
**Requirement**: BRAND-01, BRAND-02, BRAND-03, BRAND-40

**Done when**:

- [x] `<html>` carries the Outfit CSS variable (latin subset + guide fallback) and `<body>` the papel + texture background; no `bg-[#...]` literal survives in `src/app`
- [x] Quick gate passes: `npx vitest run src/app/__tests__/brand-font.test.ts --reporter=verbose`
- [x] Build gate passes: `npm run build`
- [x] Test count: 2 tests pass (no silent deletions)

**Tests**: unit
**Gate**: build

---

### T5: Public home reskin

**What**: `src/app/(site)/page.tsx` renders the guide's "Home pública" reference: logo top bar with "Entrar" + experimental CTA, staggered giant title "Yoga do Pato" over the dotted peach circle with the mascot, and the list of next classes with vacancy as duck rows; the voice loading/empty texts.
**Where**: `src/app/(site)/page.tsx`
**Depends on**: T1, T2, T3
**Reuses**: `src/app/(site)/api/agenda` occurrences; `VacancyDucks`, `Button`, `public/assets/logo.png`, `public/assets/pato.png`
**Requirement**: BRAND-13, BRAND-14, BRAND-15, BRAND-16, BRAND-17, BRAND-18

**Done when**:

- [x] Composition matches `captures/yogue-se-brand.html` (screen "Home pública"): staggered title, mascot + bolha, próxima aulas list with one duck row each and guide dividers; empty state shows the guide's sentence; loading shows "Respirando fundo…" (the screen keeps the existing occurrences query untouched)
- [x] Primary CTA navigates to `/experimental`; 390px stacks with no horizontal overflow
- [x] Walk evidence recorded at the feature walk (step 9 - script `.specs/features/redesign-marca/walk.mjs`, captures `captures/home.running.png`, `captures/home-390.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T6: Experimental screen reskin

**What**: `src/app/(site)/experimental/page.tsx` + `experimental-form.tsx` render the guide's "Agendar aula experimental" reference: occurrence options with duck rows (pressed state pêssego-claro, own duck peach), name/phone/health fields in the guide field style, R$ 45,00 with tabular numerals, black primary button disabled until valid, the confirmation card with the mascot, and the guide's error texts.
**Where**: `src/app/(site)/experimental/page.tsx`
**Depends on**: T1, T2, T3
**Reuses**: existing `ExperimentalRequestForm` contract (options, declaration, price) and actions; `VacancyDucks`, `Field`, `Button`
**Requirement**: BRAND-19, BRAND-20, BRAND-21, BRAND-22, BRAND-23, BRAND-24, BRAND-25

**Done when**:

- [x] Screen matches the guide reference; selected occurrence paints its own duck peach; duplicate phone shows "Já existe uma aula experimental para este telefone."; incomplete phone shows the guide's help in error state; confirmation card shows "Pedido enviado" + mascot + the guide sentence; price R$ 45,00 (AD-040); no double submit
- [x] Walk evidence recorded at the feature walk (step 9 - captures `captures/experimental.running.png`, `captures/experimental-390.running.png`, `captures/experimental-confirm.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T7: Login reskin

**What**: `src/app/login/page.tsx` + `login-form.tsx` render a centered card on papel with the logo, e-mail/password in the guide field style, one black "Entrar" button, and the existing generic auth error in the guide error style.
**Where**: `src/app/login/page.tsx`
**Depends on**: T1, T2
**Reuses**: existing `LoginForm` + `loginAction`; `public/assets/logo.png`
**Requirement**: BRAND-32, BRAND-33, BRAND-34

**Done when**:

- [x] Card composition per guide style; invalid or ALUNO credentials keep the generic error message (AUTH-09) in the error field style; success redirects to `/grade` (unchanged)
- [x] Walk evidence recorded at the feature walk (step 9 - captures `captures/login.running.png`, `captures/login-error.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T8: Admin shell reskin (layout, nav, logout)

**What**: `src/app/(admin)/layout.tsx` renders the guide's sober admin shell: papel/pena surfaces, 2px black borders, pill actions, top nav with the six routes, admin name + "Sair" - desktop-first, no mascot.
**Where**: `src/app/(admin)/layout.tsx`
**Depends on**: T1, T2
**Reuses**: existing nav links, `logoutAction`, `requireAdminSession` guard (unchanged)
**Requirement**: BRAND-26, BRAND-27

**Done when**:

- [x] Shell follows the guide's admin tone on brand tokens; every admin route keeps its current guard and behavior
- [x] Walk evidence recorded at the feature walk (step 9 - capture `captures/admin-shell.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T9: Grade reskin (week calendar + class panel)

**What**: `src/app/(admin)/grade/page.tsx` renders the guide's "Admin: calendário e turma" reference: week grid with 8 mini ducks per slot (fixed/makeup/experimental distinguished), the side panel with roster chips and large ducks, the guide's black pill toast on success, error text on failure, BLOQUEADA slots kept marked (AD-014).
**Where**: `src/app/(admin)/grade/page.tsx`
**Depends on**: T1, T2, T3, T8
**Reuses**: existing grade query and actions (`booking-forms.tsx` follows in T10); `VacancyDucks`
**Requirement**: BRAND-26, BRAND-28, BRAND-29, BRAND-30, BRAND-31

**Done when**:

- [x] Composition matches the guide's admin screen; each slot shows its 8 mini ducks; success confirms with the black pill toast naming the result; failures show plain error text; 1280px renders without overflow
- [x] Walk evidence recorded at the feature walk (step 9 - captures `captures/grade.running.png`, `captures/grade-panel.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T10: Students screen reskin

**What**: `src/app/(admin)/alunos/page.tsx` + `student-forms.tsx` reskin: student list and forms on brand tokens, guide fields and pills, guide voice for statuses ("Ativo"/"Inativo" kept, per F3 precedent), success toast.
**Where**: `src/app/(admin)/alunos/page.tsx`
**Depends on**: T8
**Reuses**: existing students services/actions (unchanged); kit from T2
**Requirement**: BRAND-27, BRAND-29, BRAND-31

**Done when**:

- [x] List + forms follow the guide components; no zebra table, no colored alert box; create/edit flows unchanged in behavior
- [x] Walk evidence recorded at the feature walk (step 9 - capture `captures/alunos.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T11: Plans screen reskin

**What**: `src/app/(admin)/planos/page.tsx` + `plan-forms.tsx` reskin: plan list and forms on brand tokens, guide fields and pills.
**Where**: `src/app/(admin)/planos/page.tsx`
**Depends on**: T8
**Reuses**: existing plans services/actions (unchanged); kit from T2
**Requirement**: BRAND-27, BRAND-29, BRAND-31

**Done when**:

- [x] List + forms follow the guide components; plan create/edit behavior unchanged
- [x] Walk evidence recorded at the feature walk (step 9 - capture `captures/planos.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T12: Credits, holidays and experimentals reskin

**What**: `src/app/(admin)/creditos/page.tsx`, `src/app/(admin)/feriados/page.tsx` and `src/app/(admin)/experimentais/page.tsx` reskin: the three screens on brand tokens with the kit, guide voice for chip statuses, toast on success, plain errors; each keeps its server actions untouched.
**Where**: `src/app/(admin)/creditos/page.tsx`
**Depends on**: T8
**Reuses**: existing services/actions of the three modules (unchanged); kit from T2
**Requirement**: BRAND-27, BRAND-28, BRAND-29, BRAND-30, BRAND-31

**Done when**:

- [x] The three screens follow the guide components and voice; approve/refuse/convert/cancel actions behave exactly as before
- [x] Walk evidence recorded at the feature walk (step 9 - captures `captures/creditos.running.png`, `captures/feriados.running.png`, `captures/experimentais.running.png`)
- [x] Build gate passes: `npm run build; npm run lint; npm test`
- [x] Test count: existing suite green (no deletions)

**Tests**: none (route layer - walk + browser captures per the matrix)
**Gate**: build

---

### T13: Voice pass and copy verification

**What**: Sweep the touched screens to the guide voice - fixed vocabulary, no forbidden terms, sentence case, no emojis, humor only in success/empty/loading - and add `src/app/__tests__/brand-copy.test.ts` asserting it across the touched route files (vocabulary, forbidden terms, vacancy shortcuts, humor placement, pt-BR without emojis, and the zero `--yoguese-*`/hex-literal sweep over `src/`); fix any copy drift found.
**Where**: `src/app/__tests__/brand-copy.test.ts`
**Depends on**: T5, T6, T7, T8, T9, T10, T11, T12
**Reuses**: voice table of the guide; the touched route file list of this feature
**Requirement**: BRAND-04, BRAND-08, BRAND-35, BRAND-36, BRAND-37, BRAND-38

**Done when**:

- [x] The copy test passes on every touched file: fixed vocabulary present, forbidden vocabulary absent, no "N/8" vacancy shortcut, no emoji, no apology/humor in error strings, and zero PRD palette variables or `#[hex]` literals under `src/`
- [x] Quick gate passes: `npx vitest run src/app/__tests__/brand-copy.test.ts --reporter=verbose`
- [x] Test count: 6 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

---

## Checks

**Run brand**: `npx vitest run src/modules/ui/__tests__/kit.test.ts src/modules/ui/__tests__/vacancy-ducks.test.ts src/app/__tests__/brand-tokens.test.ts src/app/__tests__/brand-font.test.ts src/app/__tests__/brand-copy.test.ts --reporter=verbose`

**C1** - `globals.css` exposes every guide token with the exact hex (papel #F3F2F1, pena #FFFBF9, preto #000, pêssego #FFC798, erro #B3261E, radii 999/28/16px) (BRAND-01, AC 1)
Proof: run brand | ✓ src/app/__tests__/brand-tokens.test.ts > brand tokens > exposes every guide token with the exact value

**C2** - Outfit 400/500/600/800 is the only family declared in the product CSS (BRAND-02, AC 2)
Proof: run brand | ✓ src/app/__tests__/brand-tokens.test.ts > brand tokens > serves Outfit as the only font family

**C3** - `--manchinhas` is referenced only by page/panel background rules, never by field, button, chip or toast rules (BRAND-03, AC 3)
Proof: run brand | ✓ src/app/__tests__/brand-tokens.test.ts > brand tokens > applies the paper texture only to page and panel backgrounds

**C4** - zero occurrences of `--yoguese-off-white`, `--yoguese-bege`, `--yoguese-salvia`, `--yoguese-cinza` and `bg-[#` literals under `src/` (BRAND-04, AC 4)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > sweep > keeps zero PRD palette variables or hex literals in src

**C5** - every interactive control shows the guide focus ring (3px papel + 5px preto) and a >=44px touch target (BRAND-05, AC 5)
Proof: run brand | ✓ src/modules/ui/__tests__/kit.test.ts > Button > renders the pill with the guide focus ring and the 48px minimum height

**C6** - transitions and smooth scroll are no-ops under `prefers-reduced-motion` (BRAND-06, AC 6)
Proof: run brand | ✓ src/app/__tests__/brand-tokens.test.ts > brand tokens > disables transitions under prefers-reduced-motion

**C7** - a shown turma renders 8 ducks (BRAND-07, AC 1)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > renders eight ducks for one turma

**C8** - the five states paint exactly as the guide - fixed solid black, makeup pena+black outline, experimental peach dotted, own solid peach, free grey dashed (BRAND-07, AC 1)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > paints the five guide states

**C9** - no screen renders vacancies as "N/8" text or a progress bar (BRAND-08, AC 2)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > voice > bans the vacancy shortcuts

**C10** - each duck group announces "N vagas livres de 8" to assistive tech with no visible duplicate (BRAND-09, AC 3)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > announces the free-count label without visible text

**C11** - xs/sm/md/lg sizes exist with identical shapes; sm is the 4x2 mini grid (BRAND-10, AC 4)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > renders the xs, sm, md and lg sizes

**C12** - only the person's own duck is solid peach (BRAND-12, AC 6)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > paints only the person's own duck solid peach

**C13** - `/` renders the guide reference composition: staggered "Yoga do Pato" title, mascot over the dotted circle, logo top bar with Entrar + experimental CTA (BRAND-13, AC 1)
Proof: browser captures/home.running.png

**C14** - each home row shows weekday/time, modality and one duck group with the guide dividers (BRAND-14, AC 2)
Proof: browser captures/home.running.png

**C15** - the home primary CTA navigates to `/experimental` (BRAND-15, AC 3)
Proof: walk - click "Agendar aula experimental" on `/` and the browser lands on `/experimental`

**C16** - empty agenda shows the guide's empty-state pattern (dashed frame, heading + one sentence, no duck row for a full class) and no broken layout (BRAND-16, AC 4)
Proof: walk - with every future occurrence cancelled the home renders the guide empty pattern and no duck row

**C17** - slow feed shows "Respirando fundo…" without a broken layout (BRAND-17, AC 5)
Proof: walk - the home shell ships the guide loading text ("Respirando fundo…") before the list arrives

**C18** - at 390px the title, mascot and list stack without horizontal overflow (BRAND-18, AC 6)
Proof: browser captures/home-390.running.png

**C19** - `/experimental` renders the guide reference: occurrence options with duck rows, name/phone/health fields, price, primary button (BRAND-19, AC 1)
Proof: browser captures/experimental.running.png

**C20** - selecting an occurrence marks it pressed (pêssego-claro) and paints its own duck peach (BRAND-20, AC 2)
Proof: walk - choose an occurrence and the option shows the pressed peach background plus one own duck

**C21** - the price renders as R$ 45,00 with tabular numerals (BRAND-21, AC 3)
Proof: browser captures/experimental.running.png

**C22** - a valid submit shows the confirmation card "Pedido enviado" with the mascot and the guide sentence (BRAND-22, AC 4)
Proof: browser captures/experimental-confirm.running.png

**C23** - a duplicate phone shows "Já existe uma aula experimental para este telefone." in the error style (BRAND-23, AC 5)
Proof: walk - submit a phone with a prior request and the guide sentence appears under the phone field

**C24** - an incomplete phone shows "Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678." (BRAND-24, AC 6)
Proof: walk - type "11 9123" and the guide sentence replaces the help text while the button stays disabled

**C25** - the submit button stays disabled while the request is in flight (BRAND-25, AC 7)
Proof: walk - submit with a slow network and the button stays disabled until the confirmation arrives

**C26** - `/grade` renders the guide's admin reference: week grid with 8 mini ducks per slot, roster panel with large ducks, no mascot (BRAND-26, AC 1)
Proof: browser captures/grade.running.png

**C27** - the admin shell and the six admin routes render on the brand tokens, desktop-first, sober (BRAND-27, AC 2)
Proof: browser captures/admin-shell.running.png

**C28** - vacancy types appear as the guide chips with the xs duck - Fixo, Reposição, Experimental (BRAND-28, AC 3)
Proof: browser captures/grade-panel.running.png

**C29** - a successful booking confirms with the black pill toast naming the result, never a colored alert box (BRAND-29, AC 4)
Proof: walk - reserve a student on `/grade` and the black pill names the turma and carries its duck

**C30** - a failed action shows plain error text, no apology, no humor (BRAND-30, AC 5)
Proof: walk - reserve the same student twice and the failure appears as plain error text

**C31** - at 1280px grid, panel and forms render without overflow or scroll traps (BRAND-31, AC 6)
Proof: walk - at 1280px the grade renders without horizontal overflow (the capture shows the 1440 layout)

**C32** - `/login` renders the centered card on papel with the logo, guide fields and one black "Entrar" (BRAND-32, AC 1)
Proof: browser captures/login.running.png

**C33** - invalid or ALUNO credentials keep the generic auth error in the guide error style (BRAND-33, AC 2)
Proof: browser captures/login-error.running.png

**C34** - valid admin credentials redirect to `/grade` (BRAND-34, AC 3)
Proof: walk - sign in with the seeded admin and `/grade` renders

**C35** - every touched screen uses the fixed vocabulary - turma, vaga, aula fixa, reposição, crédito de reposição, aula experimental, "Avisar que não vou" (BRAND-35, AC 1)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > voice > uses the fixed vocabulary of the guide

**C36** - zero forbidden vocabulary - slot, booking, sessão, agendamento recorrente, "Submit", "Enviar", "OK" as label, "Ocorreu um erro inesperado" (BRAND-36, AC 2)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > voice > bans the forbidden vocabulary

**C37** - humor appears only in success/empty/loading copy - never in errors, deadlines, charges or the 24h rule (BRAND-37, AC 3)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > voice > keeps humor out of error and deadline copy

**C38** - new copy is pt-BR with "você", sentence case, no emojis (BRAND-38, AC 4)
Proof: run brand | ✓ src/app/__tests__/brand-copy.test.ts > voice > writes Brazilian Portuguese without emojis

**C39** - build, lint and the whole suite pass green at the closing commit (BRAND-39, AC 1)
Proof: run build | ✓ Compiled successfully

**C40** - Outfit ships as the next/font latin subset with the system fallback of the guide (BRAND-40, AC 2)
Proof: run brand | ✓ src/app/__tests__/brand-font.test.ts > brand font > serves Outfit as the latin subset with the guide fallback

**C41** - a class over eight places still draws eight ducks, keeping one duck for each kind present (BRAND-41, AC 7)
Proof: run brand | ✓ src/modules/ui/__tests__/vacancy-ducks.test.ts > VacancyDucks > keeps every kind visible when the class holds more than eight

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** Fix de fuso autorizado pelo usuario antes da T1 ("Eu corrijo agora"): commit 2ed8cd1 `fix(db): stamp enrollment_date in America/Sao_Paulo` + migracao 0004 - o gate do repo estava vermelho depois das 21h (default do Banco em UTC vs. data local) e bloquearia as 13 tasks.
**Dispatched:** batch worker 1 (Phase 2: T5-T7) at HEAD 56a2552 - dispatched 2026-11-13 - returned: T5 @ ccd92cb, T6 @ b9a1fd0, T7 @ f4f0ce6, suite 355 passed. Desvios reportados: CTAs como `<Link>` com classes `.btn` (kit nao tem variante link), classes de tela (.opt/.valor/.confirma/.msg-erro/.lista-aulas) compostas com utilitarios Tailwind dentro das rotas em vez de globals.css, declaracao de saude com o texto do servidor, erro de telefone ao vivo no campo.
**Dispatched:** batch worker 2 (Phase 3: T8-T13) at HEAD f4f0ce6 - dispatched 2026-11-13 - caiu por erro de infra (stream) apos comitar T8 @ d69400a; arvore limpa. Re-dispatch worker 2b (T9-T13) a seguir.
**Walked:** 2026-11-13 - `walk.mjs` (playwright-core/Edge headless) em `http://localhost:3005` sobre o Postgres de dev: 30/30 asserts, capturas `captures/*.running.png`, julgamento por tela em `screens.md`. Defeitos achados e corrigidos no walk: login sem cartao (classe `caixa` inexistente), turmas indistinguiveis sem a data curta (home + experimental), favicon 404 (`src/app/icon.png` com o pato do guia).

---

## Phase Execution Map

Visual representation of task ordering - identical edge set to the Execution Plan, grouped for reading. Phases run in sequence, and tasks within a phase run in order; execution is strictly sequential, with no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order:

```
Phase 1:  T1 -> T2
          T1 -> T3
          T1 -> T4

Phase 2:  T1 -> T5
          T2 -> T5
          T3 -> T5
          T1 -> T6
          T2 -> T6
          T3 -> T6
          T1 -> T7
          T2 -> T7

Phase 3:  T1 -> T8
          T2 -> T8
          T1 -> T9
          T2 -> T9
          T3 -> T9
          T8 -> T9
          T8 -> T10
          T8 -> T11
          T8 -> T12
          T5 -> T13
          T6 -> T13
          T7 -> T13
          T8 -> T13
          T9 -> T13
          T10 -> T13
          T11 -> T13
          T12 -> T13
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: tokens + font | 1 file (globals.css) | ✅ Granular |
| T2: Button/Field/Chip/Toast | 4 cohesive controls in 1 file | ✅ Granular |
| T3: VacancyDucks | 1 component | ✅ Granular |
| T4: root layout wiring | 1 file (layout.tsx) | ✅ Granular |
| T5: home reskin | 1 route (+ paired agenda route reused as-is) | ✅ Granular |
| T6: experimental reskin | 1 route (+ its form file, same screen) | ✅ Granular |
| T7: login reskin | 1 route (+ its form file, same screen) | ✅ Granular |
| T8: admin shell | 1 file (layout.tsx) | ✅ Granular |
| T9: grade reskin | 1 route | ✅ Granular |
| T10: alunos reskin | 1 route (+ its forms file, same screen) | ✅ Granular |
| T11: planos reskin | 1 route (+ its forms file, same screen) | ✅ Granular |
| T12: créditos + feriados + experimentais | 3 sibling list screens, same treatment, one panel family | ✅ Granular (cohesive) |
| T13: voice pass + copy test | 1 test file + copy fixes in touched files | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | no incoming arrow | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1, T2, T3 | T1 → T5, T2 → T5, T3 → T5 | ✅ Match |
| T6 | T1, T2, T3 | T1 → T6, T2 → T6, T3 → T6 | ✅ Match |
| T7 | T1, T2 | T1 → T7, T2 → T7 | ✅ Match |
| T8 | T1, T2 | T1 → T8, T2 → T8 | ✅ Match |
| T9 | T1, T2, T3, T8 | T1 → T9, T2 → T9, T3 → T9, T8 → T9 | ✅ Match |
| T10 | T8 | T8 → T10 | ✅ Match |
| T11 | T8 | T8 → T11 | ✅ Match |
| T12 | T8 | T8 → T12 | ✅ Match |
| T13 | T5, T6, T7, T8, T9, T10, T11, T12 | T5..T12 → T13 (eight arrows) | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Design tokens / CSS config | unit (file-content) | unit | ✅ OK |
| T2 | UI kit | unit (markup) | unit | ✅ OK |
| T3 | UI ducks | unit (markup) | unit | ✅ OK |
| T4 | Root layout font wiring | unit (file-content) | unit | ✅ OK |
| T5 | Route (home) | walk + captures (no repo harness) | none | ✅ OK |
| T6 | Route (experimental) | walk + captures | none | ✅ OK |
| T7 | Route (login) | walk + captures | none | ✅ OK |
| T8 | Route shell (admin layout) | walk + captures | none | ✅ OK |
| T9 | Route (grade) | walk + captures | none | ✅ OK |
| T10 | Route (alunos) | walk + captures | none | ✅ OK |
| T11 | Route (planos) | walk + captures | none | ✅ OK |
| T12 | Route (créditos/feriados/experimentais) | walk + captures | none | ✅ OK |
| T13 | Copy verification (source-reading unit) | unit | unit | ✅ OK |
