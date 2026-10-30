# Ouro Branco — tempo dos objetivos secretos (simulação)

> Gerado por `simulador/marcos.py` a partir de `simulador/marcos.json` (**o JSON tem spoilers; este relatório não**: só usa papel+letra e números). Parâmetros no topo de `marcos.py`. Todos os números são de um modelo abstrato: servem para comparar variantes entre si e apontar desvios, não para prever a mesa real.

Parâmetros principais: 1.5 ações/turno no objetivo, p_coop 0.6, perda passiva 0.03×fragil, ataque após o sinal 0.3 ação/oponente, na defesa 0.6, eficácia do ataque 0.6×fragil, reivindicação a partir do turno 8.

## Principais conclusões

1. **Sem oposição:** 42 das 42 variantes ficam em 7–9 turnos; 0 são rápidas demais e 0 são lentas (média geral 8.1). Nenhuma variante pede ajuste numérico (a seção de recomendações fica vazia).
2. **Com 8 jogadores (reivindicação a partir do turno 8):** vitória por reivindicação em 99% das partidas, mediana no turno 9, 99% entre os turnos 9 e 12 e 0% antes do 9. A partida acaba quando o MAIS RÁPIDO de 8 completa: o primeiro jogador com 3 marcos aparece em média no turno 6.1, e por isso a maior parte das vitórias se concentra no primeiro turno possível.
3. **A regra é a alavanca do calendário:** com a regra antiga (reivindicar a partir do turno 6), a mesma ficha venceria 62% das partidas antes do turno 9 (mediana T8). Oposição mais forte empurra a vitória para depois, mas aumenta as partidas sem vencedor.
4. **Poucas partidas sem vencedor:** 1% no cenário base; o risco só cresce com p_coop baixo e ataque alto (até 29%).
5. **Equilíbrio entre papéis:** na ficha atual Governador vence 17% e Coronel 8% (esperado 12,5%). As variantes com maior e menor taxa de vitória estão na seção (b); as do agente das sementes tendem a ficar acima da média porque o marco da Germinação quase não cai.
6. **Limites do modelo:** dinheiro por papel é aproximado a partir de `economia.py` (cenário 'Mesa oportunista'); alvos ausentes da mesa, atalhos opcionais das cartas de arco e PNJs não foram simulados; a oposição ataca às cegas, com chance proporcional à fragilidade, sem deduzir o objetivo exato.

## (a) Cada variante sozinha, sem oposição (2000 simulações cada)

Turno (fim da resolução) em que os 3 marcos ficam de pé ao mesmo tempo. Quem não completa até o turno 12 conta como 13 na média. Classificação pela média: **rápida demais** (<7), **ok** (7–9), **lenta** (>9).

| Variante | Média | Mediana | P10–P90 | Completa até T12 | Classe |
|---|---|---|---|---|---|
| Coronel-A | 8.8 | 8 | 8–11 | 98% | ok |
| Coronel-B | 7.4 | 7 | 5–10 | 98% | ok |
| Coronel-C | 8.8 | 9 | 7–11 | 95% | ok |
| Casa Aviadora-A | 7.2 | 7 | 5–10 | 97% | ok |
| Casa Aviadora-B | 7.3 | 7 | 5–10 | 99% | ok |
| Casa Aviadora-C | 7.1 | 7 | 5–10 | 98% | ok |
| Exportador-A | 7.3 | 6 | 6–9 | 99% | ok |
| Exportador-B | 8.1 | 8 | 8–8 | 100% | ok |
| Exportador-C | 8.2 | 8 | 6–12 | 93% | ok |
| Armador-A | 7.3 | 7 | 6–10 | 99% | ok |
| Armador-B | 8.2 | 8 | 8–9 | 100% | ok |
| Armador-C | 8.9 | 8 | 8–10 | 98% | ok |
| Governador-A | 8.2 | 8 | 6–11 | 97% | ok |
| Governador-B | 8.0 | 7 | 7–10 | 97% | ok |
| Governador-C | 7.0 | 6 | 6–9 | 98% | ok |
| Dono do jornal-A | 8.2 | 7 | 6–12 | 94% | ok |
| Dono do jornal-B | 8.9 | 9 | 8–10 | 98% | ok |
| Dono do jornal-C | 8.1 | 8 | 6–11 | 98% | ok |
| Caudilho-A | 8.8 | 9 | 7–10 | 98% | ok |
| Caudilho-B | 8.5 | 7 | 7–12 | 90% | ok |
| Caudilho-C | 8.7 | 8 | 7–13 | 89% | ok |
| Naturalista-A | 7.2 | 6 | 6–9 | 99% | ok |
| Naturalista-B | 8.6 | 9 | 6–12 | 91% | ok |
| Naturalista-C | 8.1 | 8 | 6–11 | 94% | ok |
| Engenheiro-A | 8.9 | 9 | 7–11 | 96% | ok |
| Engenheiro-B | 8.5 | 8 | 8–10 | 99% | ok |
| Engenheiro-C | 7.9 | 7 | 7–10 | 98% | ok |
| Lider seringueiro-A | 9.0 | 9 | 8–11 | 98% | ok |
| Lider seringueiro-B | 8.1 | 8 | 8–8 | 100% | ok |
| Lider seringueiro-C | 7.5 | 7 | 5–11 | 97% | ok |
| Bispo-A | 7.2 | 7 | 5–10 | 98% | ok |
| Bispo-B | 8.7 | 8 | 8–10 | 98% | ok |
| Bispo-C | 8.9 | 9 | 7–11 | 96% | ok |
| Contrabandista-A | 8.2 | 8 | 8–8 | 98% | ok |
| Contrabandista-B | 7.5 | 7 | 6–10 | 97% | ok |
| Contrabandista-C | 7.2 | 7 | 5–10 | 97% | ok |
| Consul-A | 8.9 | 9 | 7–11 | 97% | ok |
| Consul-B | 8.9 | 9 | 7–11 | 96% | ok |
| Consul-C | 8.1 | 8 | 8–8 | 99% | ok |
| Empresario-A | 7.2 | 7 | 6–9 | 99% | ok |
| Empresario-B | 8.1 | 8 | 8–8 | 99% | ok |
| Empresario-C | 8.2 | 8 | 8–9 | 100% | ok |

Resumo: 0 rápidas demais, 42 ok, 0 lentas. Média geral 8.1; só as 24 do piloto: 8.0.

## (b) Partida piloto com 8 jogadores (2000 partidas, oposição média, p_coop 0.6)

Uma variante sorteada por papel (com a regra do Agente de Kew único).

- **Vitória por reivindicação:** 99% das partidas · **por contagem no turno 12:** 1% · ninguém com marco: 0%
- **Sem vencedor por reivindicação até o turno 12:** 1%
- Turno da vitória por reivindicação: média 9.1, mediana 9
- Vitórias por reivindicação nos turnos 9–12: 99% das partidas; antes do turno 9: 0%
- Primeiro jogador com 3 marcos de pé: turno médio 6.1 (100% das partidas têm alguém com 3)
- Reivindicações por partida: 4.08 · reivindicações derrubadas por partida: 1.42

**Distribuição do turno da primeira vitória (fração de todas as partidas):**

| T7 | T8 | T9 | T10 | T11 | T12 | Sem reivindicação vitoriosa |
|---|---|---|---|---|---|---|
| 0% | 0% | 89% | 6% | 2% | 1% | 1% |

**Vitória por papel (esperado com equilíbrio: 12,5% cada):**

| Papel | Vitória total | Por reivindicação | Por contagem |
|---|---|---|---|
| Coronel | 8% | 8% | 0% |
| Casa Aviadora | 13% | 13% | 0% |
| Exportador | 14% | 14% | 0% |
| Armador | 14% | 14% | 0% |
| Governador | 17% | 17% | 0% |
| Dono do jornal | 10% | 9% | 0% |
| Caudilho | 10% | 10% | 0% |
| Naturalista | 13% | 13% | 0% |

**Taxa de vitória por variante do piloto** (quando está na mesa):

| Variante | Vitórias | Partidas |
|---|---|---|
| Exportador-A | 32% | 469 |
| Naturalista-A | 27% | 649 |
| Governador-C | 24% | 675 |
| Armador-A | 20% | 660 |
| Dono do jornal-C | 17% | 658 |
| Governador-B | 17% | 665 |
| Caudilho-B | 15% | 645 |
| Casa Aviadora-C | 14% | 657 |
| Armador-B | 14% | 663 |
| Casa Aviadora-B | 13% | 655 |
| Governador-A | 12% | 660 |
| Exportador-B | 12% | 755 |
| Coronel-B | 12% | 656 |
| Casa Aviadora-A | 11% | 688 |
| Naturalista-C | 10% | 681 |
| Armador-C | 9% | 677 |
| Caudilho-C | 9% | 650 |
| Coronel-C | 8% | 695 |
| Dono do jornal-B | 8% | 676 |
| Caudilho-A | 8% | 705 |
| Exportador-C | 5% | 776 |
| Coronel-A | 5% | 649 |
| Dono do jornal-A | 4% | 666 |
| Naturalista-B | 3% | 670 |

## (c) Sensibilidade (1000 partidas piloto por célula)

Intensidade de ataque: baixa = 0,15 ação/oponente após o sinal e 0,3 na defesa; média = 0,3 e 0,6; alta = 0,5 e 1,0.

| p_coop | Ataque | Vitória por reivindicação | Turno médio | Vitória T9–12 | Antes de T9 | Sem reivindicação vitoriosa | Papel mais forte | Papel mais fraco |
|---|---|---|---|---|---|---|---|---|
| 0.4 | baixa | 100% | 9.1 | 100% | 0% | 0% | Governador 16% | Casa Aviadora 8% |
| 0.4 | média | 95% | 9.4 | 95% | 0% | 5% | Exportador 18% | Casa Aviadora 7% |
| 0.4 | alta | 71% | 9.8 | 71% | 0% | 29% | Dono do jornal 20% | Casa Aviadora 6% |
| 0.6 | baixa | 100% | 9.0 | 100% | 0% | 0% | Governador 19% | Dono do jornal 8% |
| 0.6 | média | 99% | 9.1 | 99% | 0% | 1% | Governador 17% | Coronel 10% |
| 0.6 | alta | 94% | 9.5 | 94% | 0% | 6% | Exportador 18% | Casa Aviadora 7% |
| 0.8 | baixa | 100% | 9.0 | 100% | 0% | 0% | Casa Aviadora 26% | Dono do jornal 5% |
| 0.8 | média | 100% | 9.0 | 100% | 0% | 0% | Governador 19% | Dono do jornal 8% |
| 0.8 | alta | 97% | 9.3 | 97% | 0% | 3% | Governador 16% | Caudilho 10% |

Solo (sem oposição), média geral das 42 variantes por p_coop:

| p_coop | Média geral | Rápidas demais | Ok | Lentas |
|---|---|---|---|---|
| 0.4 | 9.0 | 0 | 20 | 22 |
| 0.6 | 8.1 | 0 | 42 | 0 |
| 0.8 | 7.7 | 12 | 30 | 0 |

## Recomendações de ajuste numérico

Para cada variante fora da faixa 7–9 (solo), o simulador aplicou, um de cada vez (até 4), o ajuste numérico que mais aproxima a média de 8. 'Marco N' é o N-ésimo marco da ficha. São sugestões abstratas: o designer decide se o ajuste cabe na ficha.

| Variante | Média hoje | Ajustes sugeridos (em ordem) | Média com ajustes | Classe nova |
|---|---|---|---|---|

## (d) E se os ajustes forem aplicados? Alavancas da regra

Não há ajustes sugeridos: a 'ficha ajustada' é igual à atual (as duas linhas diferem só pelo acaso da simulação).

Partida piloto (oposição média, p_coop 0,6), comparando a ficha atual, a ficha ajustada e mudanças na regra de reivindicação:

| Cenário | Vitória por reivindicação | Turno médio | Antes de T9 | T9–12 | Sem reivindicação vitoriosa | Papel mais forte | Papel mais fraco |
|---|---|---|---|---|---|---|---|
| Ficha atual | 99% | 9.1 | 0% | 99% | 1% | Governador 17% | Coronel 9% |
| Ficha ajustada | 99% | 9.1 | 0% | 99% | 1% | Governador 17% | Coronel 9% |
| Ficha atual + regra antiga (reivindicar a partir do T6) | 99% | 8.2 | 62% | 37% | 1% | Exportador 17% | Coronel 9% |
| Ficha atual + reivindicar a partir do T7 | 99% | 8.6 | 62% | 37% | 1% | Exportador 16% | Coronel 10% |
| Ficha atual + ataques mais eficazes (0,8×fragil) | 98% | 9.2 | 0% | 98% | 2% | Governador 15% | Coronel 8% |
| Ficha atual + oposição alta | 91% | 9.4 | 0% | 91% | 9% | Armador 17% | Casa Aviadora 8% |

Vitória por papel: ficha atual com a regra antiga (T6) × ficha atual (T8) × ficha ajustada:

| Papel | Regra antiga (T6) | Atual (T8) | Ajustada |
|---|---|---|---|
| Coronel | 9% | 9% | 9% |
| Casa Aviadora | 11% | 11% | 11% |
| Exportador | 17% | 14% | 14% |
| Armador | 16% | 15% | 15% |
| Governador | 17% | 17% | 17% |
| Dono do jornal | 10% | 11% | 11% |
| Caudilho | 9% | 11% | 11% |
| Naturalista | 12% | 12% | 12% |

Variantes do piloto com maior e menor taxa de vitória na ficha ajustada (esperado ≈12,5%):

Mais fortes: Exportador-A 29%, Naturalista-A 25%, Armador-A 24%, Governador-C 23% · Mais fracas: Coronel-A 5%, Exportador-C 5%, Naturalista-B 4%, Dono do jornal-A 3%

