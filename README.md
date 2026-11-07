# Yogue-se - plataforma de Yoga

Monolito modular em Next.js + TypeScript sobre Postgres (Drizzle ORM).
O documento que rege o produto e `PRD.md.txt` (fonte de verdade); o estado da
construcao vive em `.specs/` (specs aprovadas, tarefas, verifications, decisoes).

## Requisitos

- Node.js 20+ e npm
- Docker rodando (Postgres local **e** Testcontainers nos testes de integracao)

## Rodando local

```powershell
docker compose up -d      # Postgres local (container yoguese-db, porta 55432)
npm run db:migrate        # aplica as migrations de ./drizzle
npm run db:seed           # 2 modalidades do PRD + 4 alunos de teste (idempotente)
npm run dev               # app em http://localhost:3000 (ou 3001, se a 3000 estiver ocupada)
```

A conexao vem do `.env.local` (copie de `.env.example`; o git ignora esse arquivo):

```
DATABASE_URL=postgres://test:test@localhost:55432/test
```

Paginas uteis: `/grade` (grade do admin: criar turma, reservar, vincular fixo) e
`/api/agenda?from=AAAA-MM-DD&to=AAAA-MM-DD` (agenda publica, sem dados de aluno).

> A porta 55432 e do Postgres local. O container `yoguese-walk`, usado no walk de
> browser, usa a mesma porta - pare um dos dois antes de subir o outro.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao (nao rode com o dev server de pé: disputam o `.next`) |
| `npm run lint` | ESLint |
| `npm test` | Suite completa (Vitest: unit + integracao) |
| `npm run db:migrate` | Aplica as migrations no banco do `.env.local` |
| `npm run db:seed` | Seed idempotente: modalidades do PRD e alunos de teste |
| `npm run db:generate` | Gera migrations a partir do schema Drizzle |

## Testes

- **Unit** (`*.test.ts`): regras de dominio, sem banco.
- **Integracao** (`*.int.test.ts`): Postgres real via Testcontainers - o banco
  local nao e usado e pode ficar de pe durante a suite.

```powershell
npx vitest run                              # tudo
npx vitest run --reporter=verbose int.test # so integracao
```

## Estrutura

```
src/
  app/            rotas (grupos: (site), (admin), (aluno)) - sem regra de negocio
  modules/        dominio, servicos, actions e testes por modulo
    classes/      turmas, modalidades, feriados e recessos
    bookings/     ocorrencias, reservas e composicao da ocorrencia
    students/     alunos e fixos (enrollments)
  db/             schema Drizzle, migrator, seed e cliente
drizzle/          migrations versionadas
.specs/           spec, tarefas, proofs, verification e decisoes por feature
PRD.md.txt        requisitos do produto (binding)
```

## Processo

O trabalho segue o fluxo `tlc-spec-driven`: **Specify -> Design -> Tasks -> Execute
-> Verify**. Cada feature vive em `.specs/features/<feature>/` com `spec.md`
(criterios), `tasks.md` (tarefas, checks e provas), `proofs.md` (evidencia das
provas) e `verification.md` (achados do Verifier). As decisoes do projeto e o
snapshot de handoff ficam em `.specs/STATE.md`.

Estado atual: feature `core-turmas-reservas` concluida (verificacao verde, 78
testes). Proxima: creditos e cancelamentos (PRD secao 16).
