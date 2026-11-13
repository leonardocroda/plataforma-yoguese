# Redesign da Marca Specification

**Approved**: 2026-11-12 - user: "aprovo"

## Problem Statement

O frontend atual nasceu com a paleta provisória do PRD ("off-white, bege, verde
sálvia", PRD seção 14) aplicada como valores soltos no Tailwind, e o resultado
ficou datado e desconectado do estúdio. A arte do estúdio já existe e é boa - papel
com manchinhas, pato em lótus, títulos pretos gigantes - e o guia
`captures/yogue-se-brand.html` fecha a direção de interface completa. As features
e as regras de negócio estão prontas; o que falta é trocar a pele de todas as telas
existentes para essa direção, sem alterar comportamento.

## Goals

- [ ] Toda tela existente renderiza sobre os tokens da marca (papel, pena, preto,
      pêssego), com Outfit, e nenhum resquício das cores do PRD (off-white, bege,
      verde sálvia) em `src/`.
- [ ] Vagas de turma são sempre patinhos (8 por turma, 5 estados), com rótulo
      acessível; nenhuma tela mostra "3/8" em texto puro nem barra de progresso.
- [ ] Home pública e `/experimental` reproduzem a composição das telas de
      referência do guia (título gigante escalonado, pato sobre círculo
      pontilhado, lista de próximas aulas, confirmação com pato).
- [ ] Textos das telas seguem o vocabulário e o tom da seção Voz do guia.
- [ ] Admin segue a mesma paleta, sóbrio, desktop-first, sem mascote.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Área do aluno | Não existe rota no produto ainda; o design system a cobre quando a feature chegar |
| Novas features, rotas ou regras de negócio | Este trabalho é pele; comportamento permanece |
| Página 404 do sistema | Fora das telas existentes; o guia só cita o texto |
| App mobile / PWA | PRD é web responsivo |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Escopo de telas | Todas as telas existentes (home, /experimental, /login, admin) | Usuário escolheu a opção recomendada | y |
| Quebra da execução | Fundação (tokens/patinhos/voz) + telas uma a uma | >8 tasks; frentes sequenciais | y |
| Aplicar a voz do guia nos textos existentes | Sim | Usuário escolheu aplicar | y |
| Acessibilidade dos patinhos | Rótulo textual acessível (sr-only) por grupo de vagas | Usuário escolheu a opção recomendada | y |
| Implementação sobre Tailwind v4 | Tokens como CSS custom properties em `globals.css` + componentes em `src/modules/ui/` reutilizando utilitários Tailwind | O repo já usa Tailwind v4; classes utilitárias podem compor os tokens | y - AD-042 |
| Navegação da home (Método, Professora, Horários, Contato) | Links placeholders para seções âncora inexistentes saem; nav vira "Entrar" + CTA experimental | Produto não tem essas páginas; ver Differences | y - AD-042 |
| Valor da experimental | R$ 45,00 conforme AD-040 | Preço vigente no produto | y - AD-042 |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Fundação da marca ⭐ MVP

**User Story**: Como visitante ou aluna, quero que a interface tenha a cara do
estúdio (papel, preto, pêssego, tipografia grande) para que a plataforma pareça o
lugar onde eu pratico.

**Why P1**: Sem a fundação, nenhuma tela pode ser redesenhada; é a base testável de
todo o resto.

**Acceptance Criteria** (each line is one EARS pattern):

1. The system SHALL expose the brand tokens of `captures/yogue-se-brand.html` (`--papel`, `--papel-2`, `--pena`, `--preto`, `--grafite`, `--cinza`, `--linha`, `--pessego`, `--pessego-claro`, `--pessego-forte`, `--erro`, `--erro-claro`, radii and focus ring) in `src/app/globals.css` with the exact values of the guide.  <!-- ubiquitous -->
2. The system SHALL serve the Outfit family (400, 500, 600, 800) as the sole product font, loaded via `next/font` with no additional typeface.  <!-- ubiquitous -->
3. The system SHALL apply the paper texture (guide variable `--manchinhas`) only to page and full-panel backgrounds, never inside fields, buttons or chips.  <!-- ubiquitous -->
4. The system SHALL keep zero occurrences of the PRD palette variables `--yoguese-off-white`, `--yoguese-bege`, `--yoguese-salvia` and `--yoguese-cinza` in `src/`.  <!-- ubiquitous -->
5. WHEN any interactive element receives keyboard focus THEN the system SHALL show the guide focus ring (3px papel + 5px preto) and every control SHALL have a touch target of at least 44px.  <!-- event-driven -->
6. WHILE the user prefers reduced motion the system SHALL render all transitions and smooth scrolling as no-ops.  <!-- state-driven -->

**Independent Test**: Render any route with the dev server: computed background is
`#F3F2F1`, headings resolve to Outfit 800, focus ring matches the guide, and
`grep -r "yoguese-salvia" src/` returns nothing.

---

### P1: Vagas em patinhos ⭐ MVP

**User Story**: Como aluna, quero ver a lotação da turma como uma fileira de
patinhos para entender as vagas de relance, sem ler números.

**Why P1**: É o elemento gráfico que se repete em todas as telas e carrega a
identidade; hoje a composição existe como número/ texto.

**Acceptance Criteria**:

1. WHERE a turma is shown the system SHALL render its 8 vacancies as ducks (component `VacancyDucks` in `src/modules/ui/`) with the five states of the guide: fixed (solid black), makeup (pena fill, black outline), experimental (peach dotted), own (solid peach), free (grey dashed).  <!-- optional-feature -->
2. The system SHALL render no vacancy information as plain "N/8" text or as a progress bar anywhere in the product.  <!-- ubiquitous -->
3. WHEN a group of ducks is rendered by a screen reader THEN the system SHALL announce an accessible label of the form "N vagas livres de 8" (composition-aware) with no visible text duplicate.  <!-- event-driven -->
4. The system SHALL offer the guide's duck sizes (xs, sm mini 4x2 for the admin calendar, md, lg) from one component, with identical shapes.  <!-- ubiquitous -->
5. WHEN the admin calendar shows a time slot THEN the system SHALL show its 8 vacancies as the mini duck grid (`vagas.sm`) distinguishing fixed, makeup and experimental.  <!-- event-driven -->
6. WHILE a student's own vacancy is marked (booking or pending experimental of that person) the system SHALL paint exactly that duck solid peach and no other.  <!-- state-driven -->

**Independent Test**: Render the experimental list and the admin grade: each turma
shows 8 ducks with the right fill per composition; the accessible label reads the
free count; no "3/8" text exists in the DOM.

---

### P1: Home pública

**User Story**: Como visitante, quero ver a apresentação do estúdio com a arte de
referência (título gigante, pato, próximas aulas com vaga) para reconhecer a marca
e pedir minha aula experimental.

**Why P1**: Primeira impressão do produto; o guia traz a tela pronta.

**Acceptance Criteria** (capture: `captures/yogue-se-brand.html`, section "Telas de exemplo" → "Home pública"):

1. WHEN a visitor opens `/` THEN the system SHALL render the reference composition of `captures/yogue-se-brand.html` (screen "Home pública"): staggered giant title "Yoga do Pato", mascot over a dotted peach circle, and the list of next classes with vacancy.  <!-- event-driven -->
2. WHEN the home renders the list of upcoming classes THEN each row SHALL show weekday and time, modality, one vacancy-duck group and the guide's list divider style.  <!-- event-driven -->
3. WHEN a visitor uses the primary button of the home THEN the system SHALL navigate to `/experimental`.  <!-- event-driven -->
4. WHILE no upcoming class has vacancy the home SHALL show the empty state text of the guide voice, without a duck group of a full class.  <!-- state-driven -->
5. IF the occurrence data cannot be loaded THEN the home SHALL show the guide loading text ("Respirando fundo…") and never a broken layout.  <!-- unwanted-behavior -->
6. WHEN the home viewport is at 390px THEN the title, mascot and list SHALL stack without horizontal overflow.  <!-- event-driven -->

**Independent Test**: Open `/` on desktop and 390px: composition matches the capture,
duck groups per row, button navigates to `/experimental`.

---

### P1: Aula experimental

**User Story**: Como visitante, quero pedir minha aula experimental escolhendo
data, horário e modalidade, vendo o valor antes de confirmar.

**Why P1**: É a conversão do estúdio; o guia traz a tela pronta e o fluxo já existe.

**Acceptance Criteria** (capture: `captures/yogue-se-brand.html`, screen "Agendar aula experimental"):

1. WHEN a visitor opens `/experimental` THEN the system SHALL render the reference screen of the guide: title "Aula experimental", list of future occurrences with vacancy (choose date, time, modality - AD-040), the name and phone fields, the health declaration and the price.  <!-- event-driven -->
2. WHEN the visitor selects an occurrence THEN the system SHALL mark that occurrence pressed (guide style `aria-pressed`, pêssego-claro background) and paint its own vacancy duck solid peach.  <!-- event-driven -->
3. WHEN the price is displayed THEN the system SHALL show R$ 45,00 (AD-040) with tabular numerals.  <!-- event-driven -->
4. WHEN the visitor submits a valid request THEN the system SHALL show the confirmation card of the guide ("Pedido enviado", mascot, the guide's reassurance sentence).  <!-- event-driven -->
5. IF the request is a duplicate (AD-038) THEN the system SHALL show the guide error text "Já existe uma aula experimental para este telefone." with the error field style.  <!-- unwanted-behavior -->
6. IF the phone is incomplete THEN the system SHALL show "Telefone incompleto. Use DDD e número, por exemplo 11 91234-5678." as field help in the error state.  <!-- unwanted-behavior -->
7. WHEN the form is submitted the system SHALL keep the button disabled while the request is in flight (no double submit).  <!-- event-driven -->

**Independent Test**: Submit the form with an occurrence selected: confirmation card
appears; duplicate phone shows the exact guide message; invalid phone shows the
field error.

---

### P1: Área administrativa

**User Story**: Como professora, quero um painel sóbrio, desktop-first, com a
mesma paleta e os patinhos em miniatura, para operar a agenda sem ruído.

**Why P1**: 6 telas admin existentes precisam da pele nova; o guia traz a
referência do calendário + painel de turma.

**Acceptance Criteria** (capture: `captures/yogue-se-brand.html`, screen "Admin: calendário e turma"):

1. WHEN the admin opens `/grade` THEN the system SHALL render the reference composition of the guide (screen "Admin: calendário e turma"): week grid with 8 mini ducks per slot, side panel with the class roster and large ducks, no mascot.  <!-- event-driven -->
2. The system SHALL render the admin shell (layout, nav, forms of `/alunos`, `/planos`, `/creditos`, `/feriados`, `/experimentais`) on the same tokens (papel/pena/preto, 2px black borders, pills for actions), desktop-first, with the guide's admin tone.  <!-- ubiquitous -->
3. WHEN the admin panel shows a student's vacancy type THEN the system SHALL show it as the guide's chip with the xs duck (Fixo, Reposição, Experimental).  <!-- event-driven -->
4. WHEN a booking action succeeds THEN the system SHALL confirm with the guide's black pill toast naming the result, not a colored alert box.  <!-- event-driven -->
5. IF an admin action fails THEN the system SHALL show the error message in text with the error token, never an apology nor humor.  <!-- unwanted-behavior -->
6. WHEN the admin viewport is at 1280px THEN the grade grid, panel and forms SHALL render without horizontal overflow or scroll traps.  <!-- event-driven -->

**Independent Test**: Walk `/grade`, `/alunos`, `/planos`, `/creditos`,
`/feriados`, `/experimentais`: same palette, ducks in the grade, toast on success,
field errors on failure.

---

### P1: Login

**User Story**: Como administradora, quero entrar na área logada com uma tela
limpa na cara do estúdio.

**Why P1**: É a porta do admin; hoje é tela provisória.

**Acceptance Criteria** (no capture in the guide - outcomes only):

1. WHEN a visitor opens `/login` THEN the system SHALL render a centered card on papel with the logo, e-mail and password fields in the guide field style and one black primary button "Entrar".  <!-- event-driven -->
2. IF credentials are invalid or belong to an ALUNO role THEN the system SHALL show the generic error message already defined for auth, in the error field style, without revealing which factor failed.  <!-- unwanted-behavior -->
3. WHEN login succeeds THEN the system SHALL redirect to `/grade`.  <!-- event-driven -->

**Independent Test**: Bad password shows the generic error; admin credentials
redirect to `/grade`.

---

### P2: Voz e microcopy nas telas existentes

**User Story**: Como usuária, quero ler a plataforma no vocabulário do estúdio
("turma", "vaga", "reposição") para me sentir no lugar certo.

**Why P2**: Define a personalidade depois que a pele existe.

**Acceptance Criteria**:

1. The system SHALL use the guide's fixed vocabulary ("turma", "vaga", "aula fixa", "reposição", "crédito de reposição", "aula experimental", "Avisar que não vou") in all screens redesigned by this feature.  <!-- ubiquitous -->
2. The system SHALL never use the forbidden vocabulary ("slot", "booking", "sessão", "agendamento recorrente", "Submit", "Enviar", "OK" as button labels, "Ocorreu um erro inesperado").  <!-- ubiquitous -->
3. WHERE humor appears (success, empty, loading) the system SHALL keep it to the guide's sentences; errors, deadlines, charges and the 24h rule SHALL stay plain.  <!-- optional-feature -->
4. The system SHALL write all new copy in Brazilian Portuguese addressing the user as "você", in sentence case, with no emojis.  <!-- ubiquitous -->

**Independent Test**: Grep the touched screens for forbidden terms; spot-check
empty and success texts against the guide's voice table.

---

### P2: Performance e build

**User Story**: Como equipe, quero que o redesign não regrida desempenho nem
quebre o build.

**Why P2**: Protege a entrega.

**Acceptance Criteria**:

1. When the feature completes THEN `npm run build`, `npm run lint` and `npm test` SHALL pass green.  <!-- event-driven -->
2. The system SHALL ship Outfit as a `next/font` subset (latin) with no layout shift penalty beyond the font swap default.  <!-- ubiquitous -->

---

## Edge Cases

- IF a turma has zero vacancies THEN every duck renders dashed grey and the accessible label reads "0 vagas livres de 8".  <!-- unwanted-behavior -->
- IF the occurrences feed is empty (no published class) THEN the home shows the empty state, never a broken duck row.  <!-- unwanted-behavior -->
- WHILE the browser blocks webfonts THEN the system SHALL fall back to the system stack defined by the guide (`system-ui, -apple-system, "Segoe UI", sans-serif`).  <!-- state-driven -->
- IF an occurrence is BLOQUEADA (holiday/closure, AD-014) THEN the public home SHALL omit it and the admin grade SHALL show it blocked, both with the brand skin.  <!-- unwanted-behavior -->

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| BRAND-01 | P1: Fundação da marca | Tasks | Pending |
| BRAND-02 | P1: Fundação da marca | Tasks | Pending |
| BRAND-03 | P1: Fundação da marca | Tasks | Pending |
| BRAND-04 | P1: Fundação da marca | Tasks | Pending |
| BRAND-05 | P1: Fundação da marca | Tasks | Pending |
| BRAND-06 | P1: Fundação da marca | Tasks | Pending |
| BRAND-07 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-08 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-09 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-10 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-11 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-12 | P1: Vagas em patinhos | Tasks | Pending |
| BRAND-13 | P1: Home pública | Tasks | Pending |
| BRAND-14 | P1: Home pública | Tasks | Pending |
| BRAND-15 | P1: Home pública | Tasks | Pending |
| BRAND-16 | P1: Home pública | Tasks | Pending |
| BRAND-17 | P1: Home pública | Tasks | Pending |
| BRAND-18 | P1: Home pública | Tasks | Pending |
| BRAND-19 | P1: Aula experimental | Tasks | Pending |
| BRAND-20 | P1: Aula experimental | Tasks | Pending |
| BRAND-21 | P1: Aula experimental | Tasks | Pending |
| BRAND-22 | P1: Aula experimental | Tasks | Pending |
| BRAND-23 | P1: Aula experimental | Tasks | Pending |
| BRAND-24 | P1: Aula experimental | Tasks | Pending |
| BRAND-25 | P1: Aula experimental | Tasks | Pending |
| BRAND-26 | P1: Área administrativa | Tasks | Pending |
| BRAND-27 | P1: Área administrativa | Tasks | Pending |
| BRAND-28 | P1: Área administrativa | Tasks | Pending |
| BRAND-29 | P1: Área administrativa | Tasks | Pending |
| BRAND-30 | P1: Área administrativa | Tasks | Pending |
| BRAND-31 | P1: Área administrativa | Tasks | Pending |
| BRAND-32 | P1: Login | Tasks | Pending |
| BRAND-33 | P1: Login | Tasks | Pending |
| BRAND-34 | P1: Login | Tasks | Pending |
| BRAND-35 | P2: Voz e microcopy | Tasks | Pending |
| BRAND-36 | P2: Voz e microcopy | Tasks | Pending |
| BRAND-37 | P2: Voz e microcopy | Tasks | Pending |
| BRAND-38 | P2: Voz e microcopy | Tasks | Pending |
| BRAND-39 | P2: Performance e build | Tasks | Pending |
| BRAND-40 | P2: Performance e build | Tasks | Pending |

**ID format:** `BRAND-[NUMBER]` (design-system category of this feature).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 40 total, 40 mapped to tasks, 0 unmapped ⚠️

---

## Differences from the source

| Source shows | Product shows | Confirmed |
| ------------ | ------------- | --------- |
| Home nav "Método, Professora, Horários, Contato" (screen "Home pública") | Nav reduced to the logo + "Entrar" + primary experimental CTA; product has no such pages | y - AD-042 |
| Three method cards ("Superioga clássico/intenso") | Out of this feature; the home keeps the upcoming-classes list only | y - AD-042 |
| Price "R$ 00,00" (screen "Aula experimental") | R$ 45,00, the product's real price (AD-040) | y - AD-040 |
| Experimental screen picks from a fixed 3-option list | Picks a concrete occurrence with vacancy from the public agenda (AD-040) | y - AD-040 |
| Student area screen ("Oi, Marina", credits, fixed classes) | Not built - route does not exist; deferred with the student-area feature | y - AD-042 |
| Admin week grid mock with example times and names | Same composition, real data from `/grade` | y - AD-042 |
| Copy in the voice table uses example dates (12 dez, 18 dez) | Dates computed from the product's credit rules | y - AD-042 |

## Sources

- `PRD.md.txt` seção 14 (requisitos de interface) - **superseded in palette/aesthetics by AD-041**; the responsive, mobile-first and clear-feedback requirements stand
- `captures/yogue-se-brand.html` - binding - full brand direction: tokens, typography, ducks, voice, components and the reference screens (home pública, aula experimental, área do aluno, admin)
- `.specs/STATE.md` AD-008/AD-014/AD-038/AD-040 - behavior the redesigned screens must keep (composition, public agenda filters, duplicate experimental, occurrence choice and price)
- User request 2026-11-12 - "melhorar o frontend da plataforma... aplicando da forma como definido" + decisions from context.md

---

## Success Criteria

- [ ] Every existing route renders on the brand tokens with zero `--yoguese-*` variables left in `src/`
- [ ] Every shown turma renders 8 ducks with correct state and an accessible free-count label
- [ ] Home and experimental match the reference composition at 390px and desktop
- [ ] `npm run build`, `npm run lint`, `npm test` green at the closing commit
