# Redesign da Marca — Walk das telas

Passo 9 do Execute: o app rodando, o que cada história promete, e o julgamento
de cada tela contra o guia (`captures/yogue-se-brand.html`). O script é
`walk.mjs` (playwright-core, Edge headless); ele imprime **30/30 asserts** e
grava as capturas `captures/*.running.png` abaixo.

Ambiente do walk: `npm run dev` em `http://localhost:3005`, Postgres de
desenvolvimento (`yoguese-db`, porta 55432) com o seed e a migração 0004
aplicados. O walk cria uma aula experimental real ("Walk da Marca") para provar
a confirmação; ela aparece no admin como qualquer pedido.

## O que o guia manda e o que a tela mostra

| Tela | Captura | Criterios | O que o walk provou | Julgamento contra o guia |
| --- | --- | --- | --- | --- |
| Home (`/`) | `home.running.png`, `home-390.running.png` | C14, C15, C17, C18 | Outfit na página (`Outfit, system-ui...`), fundo papel `rgb(243,242,241)`, título "Yoga do Pato", mascote sobre a bolha pontilhada, logo + "Entrar" + "Agendar aula experimental", lista "Próximas aulas com vaga" com uma fileira de patinhos e o rótulo acessível "N vagas livres de 8" por turma, nenhum "N/8" em texto | Composição do guia inteira: duas bolhas (uma atrás do pato, uma solta), títulos escalonados sangrando a margem, patinhos como leitura de vaga e a contagem em texto. Em 390px não há rolagem horizontal (0px). |
| Aula experimental (`/experimental`) | `experimental.running.png`, `experimental-filled.running.png`, `experimental-390.running.png`, `experimental-confirm.running.png` | C19, C20, C21, C22, C25 | Turma escolhida com `aria-pressed`, patinho da pessoa em pêssego, botão bloqueado até nome + telefone válido + declaração + turma, botão libera, confirmação "Pedido enviado" com o pato, sem rolagem horizontal em 390px | Tela "Aula experimental" do guia: opções como pílulas com a fileira de patinhos, campos do guia, valor `tabular-nums`, botão preto único. A confirmação é o cartão pêssego com o mascote. |
| Login (`/login`) | `login.running.png`, `login-error.running.png` | C32, C33 | Cartão pena centralizado com logo, campos do guia, botão preto "Entrar"; senha errada não entra e mostra a mensagem genérica já definida para o auth, no token de erro | Cartão centralizado, sem enfeite, na voz do guia ("Área da professora."). |
| Admin — grade (`/grade`) | `admin-shell.running.png`, `grade.running.png`, `grade-panel.running.png` | C26, C27, C28, C31 | Nav com as seis telas + "Sair"; a grade mostra cada horário com a miniatura 4x2 dos 8 patinhos e o painel lateral com "3 vagas livres", patos grandes, chips "Fixo · 2" / "Experimental · 3", lista e os formulários de reserva, fixo, aviso e cancelamento | Tela "Admin: calendário e turma" do guia: desktop primeiro e sóbrio, sem mascote, papel/pena/preto, bordas de 2px e ações em pílula. |
| Alunos (`/alunos`) | `alunos.running.png` | C29 | Cartão "Nova aluna" com os campos do guia e a lista "Alunas cadastradas" com chip de status e ações em texto sublinhado | Guia: formulário em cartão à esquerda, lista em linhas com divisórias de 1px. |
| Planos (`/planos`) | `planos.running.png` | C29 | Cartão "Criar plano" e "Planos cadastrados" com edição em linha e chip "Ativo" | Guia: mesma gramática de cartão + lista. |
| Créditos (`/creditos`) | `creditos.running.png` | C30 | Seletor de aluna, "Conceder crédito" em cartão e a lista de créditos (estado vazio da base) | Guia: cartão de ação com o texto de ajuda e botão preto. |
| Feriados (`/feriados`) | `feriados.running.png` | C30 | Cadastro e lista de feriados nos tokens da marca | Guia: mesma gramática. |
| Experimentais (`/experimentais`) | `experimentais.running.png` | C30 | Pedidos recebidos com chip de status e ações (aprovar, recusar, converter) | Guia: lista sóbria, sem mascote. |

## Defeitos que só o walk pegou (corrigidos)

1. **Login sem cartão.** A página usava a classe `caixa`, que não existe no
   CSS — os campos flutuavam no papel, contrariando o critério da tela (cartão
   pena centralizado). Corrigido com a composição local do guia
   (`border-2`, `bg pena`, `--r-lg`).
2. **Turmas indistinguíveis.** Home e `/experimental` mostravam só
   "Segunda, 19:00" — com quatro segundas abertas, as opções empatavam. Entrou
   a data curta (`16/11`) ao lado do dia/hora, e a home voltou a mostrar a
   contagem em texto ("3 vagas"), como no guia.
3. **Favicon 404.** Toda tela pedia `/favicon.ico` e caía em 404. O pato da
   marca agora é o ícone da aba (`src/app/icon.png`, o mesmo arquivo do guia,
   sem redesenho).

## O que o walk não cobre

- O calendário do admin só tem duas turmas no banco de desenvolvimento (19h,
  segunda e terça), então a grade aparece com uma linha de horário. É dado, não
  desenho: a grade monta as sete colunas e as linhas a partir das turmas ativas.
- A área da aluna não existe como rota neste app (fora de escopo, AD-042).
