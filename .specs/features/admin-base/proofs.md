# admin-base proofs

**HEAD**: 809b7f4
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 26 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `walk - visit à /grade deslogada cai no /login` | pass (Walked) |
| C2 | `walk - login com a credencial do seed termina na /grade` | pass (Walked) |
| C3 | `run auth-int / ✓ auth actions > credencial invalida devolve exatamente a mensagem generica, sem sessao (AUTH-0` | pass |
| C4 | `run auth-int / ✓ auth actions > recusa campo vazio e e-mail invalido no servidor, sem tocar cookies (AUTH-04)` | pass |
| C5 | `run auth-unit / ✓ password > hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash` | pass |
| C6 | `walk - clique em Sair desloga e /grade volta a redirecionar` | pass (Walked) |
| C7 | `walk - logada, /login redireciona à /grade` | pass (Walked) |
| C8 | `run auth-int / ✓ seed > admin idempotente com hash verificavel` | pass |
| C9 | `walk - nav do (admin) alcança as 5 telas` | pass (Walked) |
| C10 | `walk - nome da admin aparece no header` | pass (Walked) |
| C11 | `run students / ✓ students services > cria aluna com todos os campos` | pass |
| C12 | `run students / ✓ students services > recusa cadastro sem campo obrigatorio` | pass |
| C13 | `run students / ✓ students services > aceita os 4 status do PRD` | pass |
| C14 | `run students / ✓ students services > recusa e-mail duplicado` | pass |
| C15 | `run students / ✓ students services > edita a aluna e a mudanca aparece na listagem (STUD-05)` | pass |
| C16 | `run composition / ✓ occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar ` | pass |
| C17 | `run composition / ✓ occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar ` | pass |
| C18 | `run students / ✓ students services > perfil agrega fixos creditos e historico` | pass |
| C19 | `run plans / ✓ plans services > cria plano completo` | pass |
| C20 | `run plans / ✓ plans services > recusa valor e frequencia invalidos` | pass |
| C21 | `run plans / ✓ plans services > edita e reflete na listagem` | pass |
| C22 | `run plans / ✓ plans services > inativa via update e o seletor omite o plano (PLAN-04)` | pass |
| C23 | `run students / ✓ students services > perfil mostra o plano mesmo depois de inativado (PLAN-05)` | pass |
| C24 | `walk - plano criado com valor X aparece na /planos com X` | pass (Walked) |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run auth-int` - exit 0

```
 ✓ src/__tests__/seed.int.test.ts > seed > admin idempotente com hash verificavel (AUTH-08) 703ms
 ✓ src/modules/auth/__tests__/credentials.int.test.ts > credentials > e-mail desconhecido e senha errada falham com o mesmo erro generico 367ms
 ✓ src/modules/auth/__tests__/credentials.int.test.ts > credentials > hash sem o formato scrypt nunca autentica 86ms
 ✓ src/modules/auth/__tests__/credentials.int.test.ts > credentials > normalizeEmail devolve trim e lowercase 88ms
 ✓ src/__tests__/seed.int.test.ts > seed > seed de novo atualiza a senha do admin pelo env (upsert) 645ms
 ✓ src/__tests__/seed.int.test.ts > seed > sem ADMIN_EMAIL/ADMIN_PASSWORD o seed recusa com erro claro 10ms

 Test Files  6 passed (6)
      Tests  34 passed (34)
   Start at  11:41:16
   Duration  24.13s (tests 86%, import 13%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run auth-unit` - exit 0

```
 ✓ src/modules/auth/domain/__tests__/session-token.test.ts > session-token > token malformado devolve tampered, sem lancar 0ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash 43ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > duas hashes da mesma senha diferem (salt aleatorio) 79ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify aceita a senha certa 76ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify falha com senha errada 78ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify falha com hash malformado 0ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  11:41:45
   Duration  514ms (tests 78%, import 11%, transform 7%, worker 4%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run students` - exit 0

```
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > setStudentStatus inativa e reativa sem tocar nas matriculas 124ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > listagem traz o nome do plano de cada aluna 121ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil agrega fixos, creditos e historico (STUD-08) 197ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil mostra o plano mesmo depois de inativado (PLAN-05) 89ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil lista so os creditos disponiveis 565ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil de aluna inexistente e recusado 44ms

 Test Files  3 passed (3)
      Tests  28 passed (28)
   Start at  11:41:49
   Duration  19.62s (tests 83%, import 16%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run composition` - exit 0

```
RUN  v5.1.0 C:/Users/leona/projects/plataforma-yoguese

 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > the single composition service feeds the booking and the reading paths 331ms
 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07) 138ms
 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > reserva fixa de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07) 168ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  11:42:12
   Duration  10.09s (tests 72%, import 26%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run plans` - exit 0

```
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > cria plano completo com nome, valor, frequencia, descricao e status (PLAN-01) 54ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > recusa valor e frequencia invalidos com erro por campo (PLAN-02) 41ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > edita plano e reflete a mudanca na listagem (PLAN-03) 48ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > inativa via update e o seletor omite o plano (PLAN-04) 46ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > seletor mantem o plano atual da aluna mesmo inativo (PLAN-04, PLAN-05) 60ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > recusa plano com nome duplicado 43ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Start at  11:42:26
   Duration  10.77s (tests 74%, import 25%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
