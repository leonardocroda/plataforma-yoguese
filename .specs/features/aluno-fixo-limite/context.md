# Aluno Fixo: Remoção pela UI e Limite do Plano Context

**Gathered:** 2026-11-14
**Spec:** `.specs/features/aluno-fixo-limite/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Duas correções no ciclo do vínculo fixo: (1) o admin encerra o vínculo fixo
pela UI do detalhe da aluna; (2) a frequência semanal do plano limita quantos
vínculos fixos a aluna pode ter - e "sem plano não pode ser fixa".

---

## Implementation Decisions

### Onde a remoção mora

- No detalhe da aluna (/alunos/[id]), na seção "Horários fixos ativos".
- User: escolheu "No detalhe da aluna (Recomendado)".
- A grade (/grade) continua criando vínculo e não ganha remoção.

### Semântica da remoção

- Encerrar em data, com a data pré-preenchida com hoje (end_date que o
  serviço `endEnrollment` já suporta); para de contar a partir da data e
  mantém histórico.
- User: escolheu "Encerrar em data, default hoje (Recomendado)".

### Aluna sem plano

- Sem plano NÃO pode ser fixa: `createEnrollment` recusa quando a aluna não
  tem plano (mais rígido que a recomendação; decisão da usuária).
- User: escolheu "Sem plano não pode ser fixa".

### Mudança de plano para baixo

- Recusar a edição do plano quando a aluna tem mais vínculos fixos ativos do
  que a frequência do plano novo permite; erro claro nomeando contagem e
  limite. Remover o plano com vínculos ativos também recusa.
- User: escolheu "Recusar a mudança de plano (Recomendado)".

### Agent's Discretion

- Cópia exata das mensagens de erro (o spec fixa o conteúdo obrigatório:
  plano nomeado e contagem atual em PLIM-02/PLIM-05).
- Composição do formulário de encerramento (um campo de data + botão).

### Declined / Undiscussed Gray Areas → Assumptions

Nenhum declined; quatro defaults ficaram logados no spec (plano INATIVO
limita igual, data passada ≥ startDate permitida, sem migração de dados,
contagem vínculo = 1 aula semanal).

---

## Specific References

- "não tem como remover um aluno fixo de uma turma pela ui"
- "não deveria ser possível ele estar fixo em mais que duas turmas" (plano
  2x/semana)
- "isso devia ser parte do plano" - o limite é regra do plano, não da turma.

---

## Deferred Ideas

- Remoção de vínculo direto pelo painel da ocorrência na grade (fica natural
  para a feature `admin-calendario`, que evolui a grade).
- Botão do aluno "Alterar meu horário fixo" (PRD 5.2) - área do aluno.
