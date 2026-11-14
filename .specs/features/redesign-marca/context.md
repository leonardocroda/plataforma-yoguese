# Redesign da Marca - Context

**Gathered:** 2026-11-12
**Spec:** `.specs/features/redesign-marca/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Trocar a pele de todas as telas existentes da plataforma (home pública, /experimental,
/login e área administrativa) para a direção de arte do guia `captures/yogue-se-brand.html`,
sem alterar nenhuma regra de negócio, rota ou dado. Fundação (tokens, fonte, textura,
componente de vagas em patinhos) primeiro; telas em seguida, uma por vez.

---

## Implementation Decisions

### Escopo de telas (decidido pelo usuário)

- Todas as telas que existem hoje: home pública, `/experimental`, `/login` e o admin
  (grade, alunos, experimentais, planos, créditos, feriados).
- Área do aluno fica fora: não existe rota ainda no produto. As referências do guia para
  a área do aluno valem como design system quando ela chegar.

### Quebra da execução (decidido pelo usuário)

- Fundação + telas como duas frentes: trabalho 1 = fundação (tokens, fonte, textura,
  patinhos, voz aplicada aos componentes-base); trabalho 2 = uma tela por vez.
- Lotação de tasks acima do lote único (>8) autoriza batches sequenciais por fase.

### Voz e copy (decidido pelo usuário)

- Aplicar a voz do guia nas telas existentes: vocabulário fixo (turma, vaga, reposição,
  crédito de reposição, aula experimental, "Avisar que não vou"), humor leve só em
  sucesso/estado vazio/carregamento, erros claros e acionáveis, pt-BR com "você".

### Acessibilidade dos patinhos (decidido pelo usuário)

- Patinhos são visuais; cada grupo de vagas carrega rótulo textual acessível
  (ex.: "3 vagas livres de 8") para leitores de tela, sem aparecer na tela.

### Referência vinculante

- `captures/yogue-se-brand.html` é a fonte da verdade da direção de arte (usuario:
  "montei um html com toda a direção de arte e branding do site, vamos planejar para
  alterar as paginas que ja existem aplicando da forma como definido").
- Assets extraídos do próprio guia para `public/assets/`: `pato.png`, `logo.png`,
  `logotag.png`, `poster.png`. O guia manda usar esses arquivos, nunca redesenhar.

---

## Specific References

- Tokens exatos do guia (`:root`): papel #F3F2F1, papel-2 #EAE9E7, pena #FFFBF9,
  preto #000, grafite #373737, cinza #6B6A68, linha #D9D7D4, pêssego #FFC798,
  pêssego-claro #F3E2D4, pêssego-forte #F29A55, erro #B3261E, erro-claro #F6DAD6;
  raios 999px/28px/16px/10px; fonte Outfit (400/500/600/800); foco
  `0 0 0 3px papel, 0 0 0 5px preto`.
- Vagas em patinhos: 8 por turma, estados fixo (preto sólido), reposição (pena,
  contorno preto), experimental (pontilhado pêssego), sua vaga (pêssego sólido),
  livre (tracejado cinza). Versão miniatura 4x2 para o calendário do admin.
- Proibições do guia: navbar escura, botão retangular azul, tabela zebrada, cartões
  cinza idênticos com sombra, alertas de caixa cheia, gradientes, emojis, "3/8" em
  texto, barra de progresso de lotação, pato em formulário denso ou no admin,
  piada em erro/prazo/cobrança.

## Deferred Ideas

- Área do aluno (quando a feature existir): aplica o mesmo design system, referência
  "Área da aluna ou do aluno" do guia.
- Pato Yoga Club e demais features do AD-009 seguem fora deste trabalho.
