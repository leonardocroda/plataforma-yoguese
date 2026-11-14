# Admin Calendario Design

**Spec**: `.specs/features/admin-calendario/spec.md`
**Status**: Approved

**Approved**: 2026-11-14 - user: "Aprovado"

---

## Architecture Overview

A `/grade` continua sendo a única tela, agora dirigida por **searchParams**
(`?view=dia|semana|mes&data=YYYY-MM-DD&ocorrencia=<slotId>|<data>`) seguindo o
padrão GET-form já usado em `/creditos`, `/alunos` e `/experimentais`. O server
component lê os parâmetros, resolve a janela com helpers puros de domínio e
busca **todas as ocorrências da janela em lote** por um leitor novo
(`listOccurrences`), que materializa o que falta (hoje/futuro, AD-008), lê o
passado já materializado sem criar nada, carrega os bloqueios uma vez só e
deriva cada composição pela mesma `calculateComposition` de sempre (RES-27).
A seleção de ocorrência passa de `useState` para a URL, o que mantém a tela
server-rendered e sobrevive à navegação de datas.

O bloqueio por turma/data (P2) entra como **tabela própria**
(`class_date_blocks`, grão slot+data) integrada às três portas onde um
bloqueio hoje existe: `hasBlock` (nascimento BLOQUEADA), `hasBlock` +
`resolveBlockTransition` via reconcílio (transição) e a recusa do cancelamento
(FER-09/AD-031, já paga pelo status). Os efeitos sobre reservas e créditos são
os mesmos do feriado/recesso (AD-026/AD-027/AD-028) — reusados, não
reescrevidos.

```mermaid
flowchart TD
    A[GET /grade?view&data&ocorrencia] --> B[page.tsx server component]
    B --> C[resolveCalendarWindow<br/>domínio puro: dia/semana/mês → from,to]
    C --> D[listOccurrences<br/>leitor em lote]
    D --> D1[carrega bloqueios 1x<br/>holidays + closures + class_date_blocks]
    D --> D2[materializa faltantes hoje/futuro<br/>onConflictDoNothing + releitura]
    D --> D3[lê sessões existentes do passado<br/>sem criar - AD-008]
    D --> D4[bookings, experimentais, enrollments, créditos<br/>uma query por relação]
    D4 --> E[calculateComposition<br/>RES-27 fonte única]
    E --> F{view}
    F -->|dia| G[DayView]
    F -->|semana| H[WeekView = GradeBoard]
    F -->|mes| I[MonthView]
    G & H & I --> J[TurmaPanel da ocorrência selecionada<br/>?ocorrencia=slot|data]
    J --> K[OccurrenceForms<br/>ocultos se data passada]
    K --> L[actions: reservar/aviso/cancelar/vincular<br/>bloquear/desbloquear P2]
    L --> M[reconcileBlockedOccurrences<br/>janela clamada para hoje]
    M --> N[router.refresh → GET novamente]
```

### Abordagens consideradas

| Abordagem | Por que não |
| --- | --- |
| **Server + URL + leitor em lote (escolhida)** | Regras de janela, status e vagas ficam em camadas que os testes alcançam; uma query por relação em vez de N+1; padrão de query params já existe no admin. |
| Extensão mínima (N+1 mantido, janela parametrizada) | Menor diff, mas a vista mensal faz ~30 dias × slots × 4 queries por render e mantém a leitura de créditos por aluno em loop. |
| Calendário client (SPA-like) | Janela, status e contagens iriam para o navegador, fora do alcance da suíte (viola "rules run in a layer tests reach") e refaria o pipeline server que já existe. |

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `GradeBoard`, `TurmaPanel`, `OccurrenceForms`, `RosterGroup` | `src/app/(admin)/grade/booking-forms.tsx` | A semana reusa o grid como está (parametrizada por janela); painel e formulários viram a superfície da ocorrência nas três vistas |
| `occurrenceParticipants` (hoje interna da página, page.tsx:70-140) | `src/app/(admin)/grade/page.tsx` | Extraída para serviço puro reusável pelas três vistas e testável direto (CRD-09, AD-022) |
| `getOccurrenceComposition` + `calculateComposition` | `src/modules/bookings/services/composition.ts`, `src/modules/bookings/domain/composition.ts` | Derivação por ocorrência do leitor em lote — nenhuma regra de contagem nova (CAL-05) |
| `materializeSession` (get-or-create, AD-008) | `src/modules/bookings/services/sessions.ts` | Padrão do materialize em lote; variante que aceita bloqueios pré-carregados |
| `hasBlock` | `src/modules/bookings/services/sessions.ts:219-238` | Estendida para ler também `class_date_blocks` do slot |
| `resolveBlockTransition`, `isDateCoveredByBlocks` | `src/modules/bookings/domain/blocks.ts` | Transição BLOQUEADA⇄AGENDADA por ocorrência, coberta = feriado/recesso OU bloqueio do slot |
| `reconcileBlockedOccurrences` | `src/modules/bookings/services/blocks.ts` | O mesmo reconcílio recebe cobertura ampliada; cancelamento de reservas + devolução do crédito RESERVADO já são dele (AD-026) |
| Guardas e cancelamento | `src/modules/credits/services/cancellations.ts` | `cancelOccurrenceByStudio` reusado como está + guarda de data passada (AD-045); FER-09/AD-031 já recusa bloqueada |
| `todayInStudio`, `weekdayOf`, `addDays`, `occurrenceDates`, `isDatePast` | `src/modules/classes/domain/occurrences.ts` | Base das janelas e da guarda; novos helpers `weekStartOf`/`monthBoundsOf` entram aqui |
| Padrão searchParams + GET form | `src/app/(admin)/creditos/page.tsx:20-62` | Navegação da grade (Next 15: `searchParams: Promise<...>`) |
| Kit da marca | `src/modules/ui/` + tokens `globals.css` | `Button`, `Chip`, `Field`, `Toast`, `VacancyDucks` nas vistas novas (CAL-09) |
| Guard admin | `src/app/(admin)/layout.tsx` (`requireAdminSession`) | Já cobre a página e as actions (AUTH-01) |
| Harness de testes | `src/test/postgres.ts`, `src/test/fixtures.ts` | Testes de integração do leitor e dos bloqueios |

### Integration Points

| System | Integration Method |
| --- | --- |
| Drizzle/Postgres | Migração nova criando `class_date_blocks`; nenhuma coluna nova nas tabelas existentes |
| Bloqueios existentes | `class_date_blocks` entra como terceira fonte na cobertura; feriado/recesso não muda |
| `/turmas` (admin-turmas) | Sem acoplamento; edição de dia/horário lá continua gerando CANCELADAS que esta grade exibe com selo |
| `/feriados` (core-feriados-recessos) | Continua dona de feriado/recesso; o calendário só lê o bloqueio global |

---

## Components

### `resolveCalendarWindow` (domínio puro)

- **Purpose**: traduz `view` + `data` na janela de ocorrências, com validação.
- **Location**: `src/modules/bookings/domain/calendar.ts`
- **Interfaces**:
  - `CalendarView = "dia" | "semana" | "mes"`
  - `resolveCalendarWindow(input: { view: string | undefined; date: string | undefined; today: string }): { ok: true; value: { view: CalendarView; date: string; from: string; to: string } } | { ok: false }` — parâmetro ausente/inválido (`data` mal formada, view desconhecida) devolve `ok: false` e a página cai no default (semana de hoje); janela: dia = a data; semana = segunda a domingo que contém a data (`weekStartOf`/`weekEndOf`); mês = primeiro a último dia do mês (`monthBoundsOf`)
  - `weekStartOf(date: string): string` / `weekEndOf(date: string): string` — segunda/domingo da semana do calendário da data
  - `monthBoundsOf(date: string): { from: string; to: string }`
- **Dependencies**: `weekdayOf`, `addDays` de `occurrences.ts`
- **Reuses**: convenção de datas string `YYYY-MM-DD` (o fuso só entra em `today`, já resolvido pelo chamador)

### `listOccurrences` (leitor em lote)

- **Purpose**: devolve todas as ocorrências da janela com composição, participantes e estado, em um número fixo de queries.
- **Location**: `src/modules/bookings/services/occurrences.ts`
- **Interfaces**:
  - `listOccurrences(db, input: { from: string; to: string; now?: Date }): Promise<{ ok: true; value: OccurrenceRow[] }>` — `OccurrenceRow` carrega `classSlotId, date, sessionId | null, sessionStatus, capacity, modalidade/turma, fixedStudents, participants (vínculo por aluno), notices, composition (fixedCount/makeupCount/experimentalCount/vacancies), classBlocked (P2)`
  - Passos: (1) carrega slots ativos e, uma vez, todos os bloqueios globais + da janela; (2) enumera pares `(slot, data)` com `weekdayOf(date) === slot.weekday` dentro da janela; (3) data passada: lê somente sessões existentes — inexistente é **omitida** (CAL-06, AD-008), nunca criada; (4) hoje/futuro: materializa os faltantes com insert múltiplo `onConflictDoNothing` no índice único `(class_slot_id, session_date)` + releitura (mesma semântica de corrida de `materializeSession`), nascendo BLOQUEADA quando coberta; (5) bookings, experimentais aprovadas, enrollments e créditos CANCELAMENTO_ESTUDIO da janela em uma query cada; (6) composição derivada por ocorrência com `getOccurrenceComposition` (nenhuma regra nova).
- **Dependencies**: `materializeSession` (variante com bloqueios pré-carregados), `hasBlock` estendida, `getOccurrenceComposition`, `calculateComposition`
- **Reuses**: índice único de `class_sessions`, padrão de transação de `reconcileBlockedOccurrences`

### `occurrenceParticipants` (extraída da página)

- **Purpose**: lista de participantes com vínculo e avisos de uma ocorrência (CAL-10/11), hoje interna da página e sem teste direto.
- **Location**: `src/modules/bookings/services/participants.ts`
- **Interfaces**:
  - `occurrenceParticipants(input: { date; enrollments; bookings; experimentals; }): { fixed; makeup; experimental; notices }` — mesma regra de hoje (fixo pela cobertura do enrollment; avisado não entra como participante, CRD-09/AD-022)
- **Dependencies**: `coversDate` (movida junto de `page.tsx`)
- **Reuses**: lógica literal de `page.tsx:70-140`, agora alcançável por teste unitário

### `/grade/page.tsx` (página dirigida por URL)

- **Purpose**: renderizar a vista ativa e o painel da ocorrência selecionada.
- **Location**: `src/app/(admin)/grade/page.tsx`
- **Interfaces** (para as vistas):
  - `searchParams: Promise<{ view?: string; data?: string; ocorrencia?: string }>`; inválido → default semana/hoje (mesma renderização de sempre)
  - `ocorrencia` = `<slotId>|<data>`; seleciona o painel; ausente em semana/mês mantém o comportamento atual de clicar no grid
- **Dependencies**: `resolveCalendarWindow`, `listOccurrences`, `occurrenceParticipants`, kit de UI
- **Reuses**: pipeline atual; `dynamic = "force-dynamic"` e import dinâmico do `db`

### Vistas: `DayView`, `WeekView` (GradeBoard), `MonthView`

- **Purpose**: as três visualizações do CAL-01..04.
- **Location**: `src/app/(admin)/grade/calendar-views.tsx` (WeekView permanece em `booking-forms.tsx`)
- **Interfaces**:
  - `DayView` — coluna única com as ocorrências do dia, mesma célula/composição do grid semanal; clicar seleciona
  - `WeekView` — o grid de 7 colunas atual, parametrizado pela semana da URL (deixa de ser sempre `hoje..hoje+6`)
  - `MonthView` — grid de semanas do mês; células dos dias do mês listam as ocorrências do dia em forma compacta (horário, turma, selo BLOQUEADA/CANCELADA, patinhos de vaga); dias fora do mês aparecem só para o desenho do calendário, sem ocorrência (CAL-02); clicar em uma ocorrência seleciona via URL
- **Dependencies**: `CalendarNav`, kit de UI, `VacancyDucks`
- **Reuses**: células e selos do `GradeBoard` (`booking-forms.tsx:136-262`)

### `CalendarNav`

- **Purpose**: abas Diária/Semanal/Mensal (default semanal), setas ±1 dia/semana/mês, seletor de data e ação "Hoje" (CAL-03/04, CAL-22).
- **Location**: `src/app/(admin)/grade/calendar-nav.tsx` — server component, sem JS próprio
- **Interfaces**:
  - `CalendarNav({ view, date, today })` — abas e setas são `<Link>` com `?view&data`; o seletor é `<form method="get">` com `<input type="date">` + view corrente em campo oculto (padrão de `/creditos`); setas e seletor nunca limitam a 7 dias
- **Dependencies**: `resolveCalendarWindow` para o passo da seta
- **Reuses**: GET-form de `/creditos/page.tsx:45-62`

### `TurmaPanel` / `OccurrenceForms` (adaptações)

- **Purpose**: painel da ocorrência em qualquer data, incluindo leitura do passado e o resultado do cancelamento (CAL-16).
- **Location**: `src/app/(admin)/grade/booking-forms.tsx`
- **Adaptações**:
  - Seleção passa a vir da URL (prop do servidor) em vez de `useState` local para sobreviver à navegação
  - Data passada: painel read-only — participantes e histórico visíveis, `OccurrenceForms` não renderizados (AD-029/AD-045)
  - Formulário de cancelamento exibe o resultado da action: ocorrência cancelada, nº de reservas canceladas, créditos devolvidos e gerados (a action já devolve esses contadores — sem mudança de serviço)
  - P2: botão "Bloquear nesta data" / "Remover bloqueio" para ocorrência de hoje/futuro não cancelada, chamando as actions de bloqueio
- **Dependencies**: `useActionState`, `Toast`, kit
- **Reuses**: formulários e feedback existentes

### Bloqueio por turma/data (P2)

- **Purpose**: bloquear uma turma em uma data específica, sem cancelar a turma nem a data inteira (CAL-18..21, AD-032).
- **Location**: tabela em `src/db/schema/blocks.ts`; domínio em `src/modules/bookings/domain/blocks.ts`; serviços em `src/modules/classes/services/blocks.ts`; actions em `src/modules/classes/actions.ts`
- **Interfaces**:
  - `blockClassSlotDate(db, { classSlotId; date; reason? }, now)` — valida slot existente e ATIVA; recusa slot já bloqueado na data; data passada aceita como registro histórico sem efeito (AD-029); dispara reconcílio da janela `[max(data, hoje), max(data, hoje)]` clamada para hoje
  - `unblockClassSlotDate(db, { classSlotId; date }, now)` — remove fisicamente (AD-033) e reconcílio na mesma janela
  - `listClassDateBlocks(db, { from; to })` — para o leitor e para o painel
- **Semântica herdada**: bloquear cancela as reservas ATIVAS, devolve o crédito RESERVADO da reposição com vencimento original e **não** gera crédito de estúdio (AD-026); desbloquear volta as cobertas de hoje em diante a AGENDADA e não restaura reservas (AD-027); sobreposição com feriado/recesso é permitida e a data segue bloqueada enquanto qualquer bloqueio cobre (AD-028); cancelamento pelo estúdio em bloqueada é recusado (FER-09/AD-031, já pago)
- **Dependencies**: `reconcileBlockedOccurrences`, `resolveBlockTransition`, `hasBlock`
- **Reuses**: todo o mecanismo de feriado/recesso

---

## Data Models

### `class_date_blocks` (nova)

```sql
CREATE TABLE class_date_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_slot_id uuid NOT NULL REFERENCES class_slots(id),
  session_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_slot_id, session_date)
);
```

**Relationships**: um bloqueio pertence a um `class_slot` e cobre a data inteira
dele (o slot é dia+horário). Não unifica com `holidays`/`studio_closures` —
grão diferente (slot+data vs data global) e semântica de remoção própria
(AD-033 aplica o mesmo padrão físico). O cancelamento pelo estúdio não cria
linhas aqui: CANCELADO é estado de `class_sessions`, bloqueado é a tabela nova.

**Enum novo: nenhum.** O estado da ocorrência continua sendo o
`status_sessao` existente (`AGENDADA | BLOQUEADA | CANCELADA`).

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| `view`/`data` inválidos na URL | `resolveCalendarWindow` devolve `ok: false`; página renderiza semana de hoje | Calendário abre no default, sem erro |
| Cancelamento em ocorrência passada | Guarda nova em `cancelOccurrenceByStudio` (AD-045): recusa com "ocorrencia no passado nao pode ser cancelada pelo estudio", nada muda (CAL-15) | Mensagem de erro no formulário |
| Cancelamento em BLOQUEADA | Guarda existente (FER-09/AD-031) | Mensagem "bloqueada por feriado/recesso" — a do P2 reusa o mesmo caminho |
| Cancelamento repetido | Idempotência existente (CRD-31/33): nenhuma reserva alterada, nenhum crédito novo (CAL-13) | Feedback de sucesso com contadores zerados de crédito |
| Ocorrência passada nunca materializada | Leitor omite da vista (CAL-06, AD-008) | Dia/semana/mês simplesmente não a mostram |
| Bloqueio duplicado no mesmo slot+data | Recusa do serviço + índice único como última defesa | Mensagem de bloqueio já existente |
| Sessão admin expira | Guard do layout + `adminContext` nas actions (AUTH-01, existente) | Redirect ao login |
| Corrida de materialização | `onConflictDoNothing` + releitura do vencedor (padrão de `materializeSession`) | Nenhum — idempotente |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| N+1 atual: `getComposition` por (slot, data) e `listStudentCredits` por aluno | `src/app/(admin)/grade/page.tsx:170-179, 195-204` | Vista mensal multiplicaria centenas de queries por render | O leitor em lote faz uma query por relação e carrega os créditos DISPONIVEL de todos os alunos em uma query agrupada |
| `hasBlock` carrega TODAS as linhas de bloqueio a cada materialização | `src/modules/bookings/services/sessions.ts:219-238` | Materializar a janela toda dispararia a leitura de bloqueios por ocorrência | Variante de `materializeSession`/`hasBlock` que aceita bloqueios pré-carregados; o leitor carrega uma vez |
| `VacancyDucks` assume capacidade 8 fixa e o aria-label do grid diz "de 8" | `src/modules/ui/components/vacancy-ducks.tsx:12`, `booking-forms.tsx:211` | Vagas mentirosas para slot com capacidade editada (agora possível desde admin-turmas) | `VacancyDucks` ganha prop `capacity` (default 8) e o grid passa `slot.capacity` |
| Seleção em `useState` se perde ao navegar datas | `booking-forms.tsx:148` | Usuário escolhe ocorrência, navega o mês e perde a seleção | Seleção via `?ocorrencia=` (URL), render server |
| `!composition.ok` descartado silenciosamente | `page.tsx:202` | No passado isso é o caminho comum; hoje ninguém distingue "omitir" de erro real | O leitor distingue: passado inexistente = omitir (CAL-06); qualquer outro erro = deixar explícito no row |
| Guarda AD-045 mal colocada pode quebrar a edição de dia/horário (`cancelFutureSessions`) | `sessions.ts:176-216` | Edição de grade deixaria de cancelar | Guarda dentro de `cancelOccurrenceByStudio` após carregar a sessão (recusa `sessionDate < todayInStudio(now)`); `cancelFutureSessions` só seleciona `sessionDate >= fromDate` — teste prova os dois caminhos (L-015) |
| Teste do fim do dia / fuso | `src/test/fixtures.ts` | Testes comparando com data da máquina ficam vermelhos (L-029) | Reusar `todayInStudio` e instantes fixos de `now`, como a suíte já faz |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Estado do calendário | searchParams `?view&data&ocorrencia` (server-rendered) | Padrão já usado no admin; regras de janela/contagem ficam em camada testada; sobrevive a refresh e compartilhamento de link |
| Bloqueio P2 | Tabela própria `class_date_blocks` (slot+data), não extensão de `holidays`/`studio_closures` | Grão diferente (uma turma, não a data inteira), chave única própria, `isDateCoveredByBlocks` global fica intocado; AD-033 já fixou remoção física para bloqueios |
| Leitura de ocorrências | Novo `listOccurrences` em lote em vez de N+1 de `getComposition` | Vista mensal precisa de queries limitadas; AD-008 preservado (materializa na leitura, sem job) |
| Guarda AD-045 | Dentro de `cancelOccurrenceByStudio`, após `SELECT FOR UPDATE` | Um único ponto que cobre UI, action e qualquer chamador; `cancelOccurrenceByScheduleEdit` (uso interno da edição de grade) não passa por ela |
| Participantes | Extração de `occurrenceParticipants` para serviço testável | Hoje é código de página sem teste direto; as três vistas reusam a mesma regra (CRD-09) |
| Sem AD novo no STATE.md | Nenhuma decisão aqui é projeto-nível | Tabela, leitor e parâmetros são desta feature; os padrões (AD-008, AD-026..033, AD-041/42) já governam |

---
