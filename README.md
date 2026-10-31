# Ouro Branco

Jogo de intriga assíncrono para cerca de 8 amigos. A partida se passa em Manaus, durante o Ciclo da Borracha (1890–1912). Cada jogador tem um personagem, um objetivo secreto em três marcos e três turnos por semana (terça, quinta e domingo, às 21h). O sistema age como mestre: não há IA em partida, e todo aviso chega pela caixa de entrada do próprio app.

> **Atenção, jogadores:** os arquivos `02-personagens-e-relacoes.md`, `simulador/marcos.json` e `jogo/lib/data/marcos.json` contêm os objetivos secretos. Quem for jogar não deve abri-los.

## Estrutura do repositório

| Caminho | O que é |
|---|---|
| `01-historia-base.md` | Ambientação e linha do tempo |
| `02-personagens-e-relacoes.md` | Papéis, variantes de objetivo e personagens **(spoilers)** |
| `03-mapa-de-interacao.md` | Ações e como cada uma interage com as outras |
| `04-regras-e-jogabilidade.md` | Regras completas e o modo piloto (seção 8) |
| `05-identidade-visual.md` | Paleta, tipografia, ícones e regras de interface |
| `06-guia-do-jogador.md` | O que cabe numa página para quem joga |
| `07-prompts-de-imagem.md` | Prompts usados para gerar os retratos e o mapa |
| `prototipo/` | Protótipo estático de alta fidelidade das telas (HTML, CSS, imagens) |
| `simulador/` | Scripts em Python para calibrar economia e marcos |
| `jogo/` | Aplicação web (Next.js + TypeScript + SQLite) |

## Estado atual

- **Protótipo visual:** pronto, com a identidade v2 em modo claro e escuro.
- **Aplicação:**
  - landing, criação de partida com participantes e criador, entrada por código e telefone (sem senha);
  - sorteio de personagem no primeiro acesso e onboarding de cinco passos;
  - motor de turno do modo piloto: economia, ações, contratos, marcos, reivindicação e fim no turno 12;
  - telas Gazeta, Rio, Bolsa, Praça, Caderno e Ordens, mais a caixa de entrada.
- **Próximos passos:** migrar o banco para Postgres (Supabase) e publicar na nuvem.

## Rodando localmente com Docker

Pré-requisito: Docker com Compose.

```bash
cd jogo
docker compose up -d        # sobe o app em http://127.0.0.1:3000
docker compose down         # desliga
```

Os dados ficam em `jogo/data/` (SQLite), fora da imagem.

Para liberar o acesso pela internet, sem conta nem domínio, use o túnel rápido da Cloudflare:

```bash
docker compose --profile tunel up -d
docker compose logs tunel   # procure a URL https://...trycloudflare.com
```

A URL muda a cada execução.

## Desenvolvimento sem Docker

Pré-requisito: Node.js 24 (usa o `node:sqlite` embutido).

```bash
cd jogo
npm install
npm run dev                 # http://localhost:3000
```

Para validar o build de produção: `npm run build`.

## Simulador

Os scripts em `simulador/` calibram a economia (`economia.py`) e a distribuição dos marcos (`marcos.py`). Os resultados estão em `resultados.md` e `resultados-marcos.md`. Os números das regras são provisórios e devem ser ajustados com partidas de teste.

## Créditos

Referência visual: [7a0.com.br](https://7a0.com.br/). Retratos e mapa gerados com IA e revisados à mão.
