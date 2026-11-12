# admin-base proofs

**HEAD**: b15df66
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 32 pass, 0 fail

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
| C25 | `run auth-int / ✓ credentials > credenciais de role ALUNO nao autenticam no admin (AUTH-09)` | pass |
| C26 | `run students / ✓ students services > reativar aluna sem plano e recusado e com plano funciona (STUD-09)` | pass |
| C28 | `run students / ✓ students services > e-mail igual diferindo so em maiusculas e duplicado (STUD-10)` | pass |
| C29 | `run students / ✓ students services > plano inexistente e recusado com erro do campo, sem estourar FK (STUD-11)` | pass |
| C30 | `walk - select de status oferece Experimental, Aguardando matrícula, Ativo e Inativo` | pass (Walked) |
| C27 | `run plans / ✓ plans services > edita limpa a descricao e manter omitido preserva (PLAN-03)` | pass |
| Build | `npm run build` | pass |
| Build | `npm run lint` | pass |

## Output

`Run auth-int` - exit 0

```
 ✓ src/__tests__/seed.int.test.ts > seed > seed de novo atualiza a senha do admin pelo env (upsert) 776ms
 ✓ src/modules/auth/__tests__/actions.int.test.ts > auth actions > credencial invalida devolve exatamente a mensagem generica, sem sessao (AUTH-03) 385ms
 ✓ src/__tests__/seed.int.test.ts > seed > sem ADMIN_EMAIL/ADMIN_PASSWORD o seed recusa com erro claro 16ms
 ✓ src/modules/auth/__tests__/actions.int.test.ts > auth actions > recusa campo vazio e e-mail invalido no servidor, sem tocar cookies (AUTH-04) 127ms
 ✓ src/modules/auth/__tests__/actions.int.test.ts > auth actions > Sair limpa o cookie e volta ao /login (AUTH-06) 103ms
 ✓ src/modules/auth/__tests__/actions.int.test.ts > auth actions > e-mail chega normalizado ao servico (trim e lowercase) 339ms

 Test Files  6 passed (6)
      Tests  35 passed (35)
   Start at  12:21:20
   Duration  24.91s (tests 88%, import 11%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run auth-unit` - exit 0

```
 ✓ src/modules/auth/domain/__tests__/session-token.test.ts > session-token > token malformado devolve tampered, sem lancar 1ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > hash nunca devolve a senha em claro e segue o formato scrypt:salt:hash 84ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > duas hashes da mesma senha diferem (salt aleatorio) 150ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify aceita a senha certa 152ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify falha com senha errada 148ms
 ✓ src/modules/auth/domain/__tests__/password.test.ts > password > verify falha com hash malformado 1ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  12:21:49
   Duration  1.02s (tests 78%, import 13%, transform 5%, worker 4%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run students` - exit 0

```
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > reativar aluna sem plano e recusado e com plano funciona (STUD-09) 63ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > listagem traz o nome do plano de cada aluna 44ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil agrega fixos, creditos e historico (STUD-08) 341ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil mostra o plano mesmo depois de inativado (PLAN-05) 85ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil lista so os creditos disponiveis 82ms
 ✓ src/modules/students/services/__tests__/students.int.test.ts > students services > perfil de aluna inexistente e recusado 37ms

 Test Files  3 passed (3)
      Tests  31 passed (31)
   Start at  12:21:53
   Duration  19.59s (tests 79%, import 19%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run composition` - exit 0

```
RUN  v5.1.0 C:/Users/leona/projects/plataforma-yoguese

 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > the single composition service feeds the booking and the reading paths 362ms
 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > matricula de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07) 175ms
 ✓ src/modules/bookings/services/__tests__/composition.int.test.ts > occurrence composition > reserva fixa de aluna inativa nao conta e reativacao volta a contar (STUD-06, STUD-07) 208ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  12:22:16
   Duration  11.48s (tests 73%, import 26%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run plans` - exit 0

```
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > recusa valor e frequencia invalidos com erro por campo (PLAN-02) 73ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > edita plano e reflete a mudanca na listagem (PLAN-03) 91ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > edita limpa a descricao e manter omitido preserva (PLAN-03) 90ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > inativa via update e o seletor omite o plano (PLAN-04) 96ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > seletor mantem o plano atual da aluna mesmo inativo (PLAN-04, PLAN-05) 81ms
 ✓ src/modules/plans/services/__tests__/plans.int.test.ts > plans services > recusa plano com nome duplicado 83ms

 Test Files  2 passed (2)
      Tests  14 passed (14)
   Start at  12:22:31
   Duration  10.29s (tests 78%, import 21%, transform 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
