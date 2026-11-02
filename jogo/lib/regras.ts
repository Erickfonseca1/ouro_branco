// Números e tabelas do modo piloto (04-regras-e-jogabilidade.md, seções 4 e 8).
// Nada aqui depende de texto narrativo: a parte secreta (objetivos) vem de lib/data/marcos.json.

export const TURNO_FIM = 12
export const TURNO_REIVINDICAR = 8
export const MARCOS_PARA_REIVINDICAR = 3

// Preço base por lote (₵) por turno.
export const P_BASE = [4, 4.5, 5, 5.5, 6, 6, 6.5, 7, 7, 7, 7, 7]

export function aviamento(turno: number) {
  return turno <= 3 ? 4 : turno <= 7 ? 5 : 6
}

// Valores por papel do piloto (chave: id do papel em papeis.ts). Vêm de simulador/economia.py, PAPEIS e renda_fixa.
// Papéis fora do piloto (9 a 14) usam os valores de marcos.json, com o mesmo piso de caixa.
export const CAIXA_PAPEL: Record<number, number> = { 1: 12, 2: 30, 3: 20, 4: 14, 5: 10, 6: 10, 7: 8, 8: 8 }
export const SERINGAIS_PAPEL: Record<number, number> = { 1: 2, 2: 0, 3: 1, 4: 0, 5: 1, 6: 0, 7: 1, 8: 0 }
export const SERINGAIS_PADRAO = 1 // papéis fora do piloto
export const SERINGAIS_SISTEMA = 4 // seringais do sistema, sempre presentes (economia.py)
export const SISTEMA_VENDE = 0.66 // fração da produção dos seringais do sistema que entra no mercado (economia.py)
export const RENDA_PAPEL: Record<number, number> = { 5: 2, 6: 4, 8: 3 } // Governador, Dono do jornal, Naturalista (04, seção 4.8)

// Crédito de aviamento: a casa aviadora jogadora empresta o que tem; o resto vem da casa automática.
export const JUROS_AVIADORA = 0.2
export const JUROS_AUTOMATICA = 0.25
export const PAPEL_AVIADORA = 2
export const PAPEL_ARMADOR = 4
// Frete vai para o armador até a capacidade dos dois vapores (2 × 6 lotes por turno, economia.py).
export const ARMADOR_CAPACIDADE = 12

// Caixa mínimo ao começar: o suficiente para pagar o aviamento de 2 seringais no turno 1.
// Abaixo disso, um papel nunca produz (não há crédito no motor) e fica fora do jogo.
// Calibrado com a simulação em simulador/economia.py (ver resultados): com caixa 3, Caudilho e Naturalista
// ficavam sem produzir em todas as partidas.
export const CAIXA_INICIAL_MINIMA = 2 * 4

export const PRODUCAO_POR_SERINGAL = 3
export const DEMANDA_POR_SERINGAL = 2
export const CAPACIDADE_EXPORTADOR = 8
export const PRECO_CASA = 0.6
export const PRECO_EXPORTADOR = 0.75
export const LOTE_PARADO = 0.5 // fração que sobra do estoque não vendido

export function luxo(prestigio: number) {
  return prestigio <= 3 ? 1 : prestigio <= 6 ? 2 : 4
}

export const CUSTO_SERINGAL = 6
export const CUSTO_DOAR = 3 // gera +1★
export const PRESTIGIO_MAX = 10

// Personagens em cena (04, seção 8.4).
export const NPCS = [
  { id: 'tabeliao', nome: 'Anselmo Queiroga', papel: 'Tabelião' },
  { id: 'telegrafista', nome: 'Benedita Lins', papel: 'Telegrafista' },
  { id: 'odette', nome: 'Madame Odette', papel: 'Pensão Flor-de-Lis' },
  { id: 'estivador', nome: 'Juvêncio Mares', papel: 'Estivador-chefe' },
  { id: 'delegado', nome: 'Delegado Severino Matoso', papel: 'Delegado' },
  { id: 'padre', nome: 'Frei Bonifácio', papel: 'Padre confessor' },
] as const

export type NpcId = (typeof NPCS)[number]['id']

// Métodos de visita (06, "Segredos"). Chances: nada, boato, indício, prova.
export const METODOS = {
  pagar: { nome: 'Pagar', custo: 3, chances: [0.1, 0.4, 0.35, 0.15], relacao: 0 },
  favor: { nome: 'Fazer um favor', custo: 0, chances: [0.25, 0.4, 0.25, 0.1], relacao: 0 },
  pressionar: { nome: 'Pressionar', custo: 0, chances: [0.2, 0.35, 0.3, 0.15], relacao: -1 },
  cultivar: { nome: 'Cultivar', custo: 1, chances: [0.3, 0.4, 0.25, 0.05], relacao: 1 },
} as const

export type MetodoId = keyof typeof METODOS
export const NIVEIS = ['boato', 'indicio', 'prova'] as const

export const ABERTAS = ['investir', 'doar', 'visitar', 'denunciar'] as const
export const SECRETAS = ['subornar', 'plantar_boato', 'comprar_silencio', 'espionar', 'contrabandear'] as const
export type AbertaId = (typeof ABERTAS)[number]
export type SecretaId = (typeof SECRETAS)[number]

// Custo de cada ação secreta (₵).
export const CUSTO_SECRETA: Record<SecretaId, number> = { subornar: 3, plantar_boato: 1, comprar_silencio: 3, espionar: 1, contrabandear: 0 }

export const LIMITE_ABERTAS = 2
export const LIMITE_SECRETA = 1

export const PROPOSTA_TURNOS = 2
export const PROPOSTA_VALOR_MAX = 6

// Posições dos seringais no mapa do Rio (viewBox 690 x 1010, ver prototipo/index.html).
export const SLOTS_SERINGAL: [number, number][] = [
  [330, 590], [240, 690], [90, 880], [170, 830], [80, 470],
  [300, 210], [450, 600], [600, 560], [200, 300], [520, 760],
]

// Dados públicos por papel do jogador (renda inicial, caixa, prestígio) vêm de marcos.json.
export function sementeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sortear<T>(rng: () => number, pesos: number[], itens: T[]): T {
  const total = pesos.reduce((s, p) => s + p, 0)
  let r = rng() * total
  for (let i = 0; i < itens.length; i++) {
    r -= pesos[i]
    if (r < 0) return itens[i]
  }
  return itens[itens.length - 1]
}

// Frete por lote vendido (04, seção 4.3): 10% do preço, com mínimo de 0,3₵.
export function frete(preco: number) {
  return Math.max(0.3, Math.round(preco * 0.1 * 100) / 100)
}

// Manchetes públicas de cada desfecho de bifurcação (texto de jornal, sem códigos internos).
export const NOTICIAS: Record<string, string> = {
  tratado: 'Tratado assinado no Acre',
  armas: 'Armas circulam no Acre',
  independencia: 'Acre declara independência',
  arrendamento: 'Acre é arrendado a uma companhia',
  com_garantia: 'Crédito concedido com garantia',
  sem_garantia: 'Crédito concedido sem garantia',
  germina: 'Sementes germinam em Kew',
  presa: 'Sementes presas em Kew',
  esmagada: 'Revolta dos seringueiros esmagada',
  acordo: 'Acordo nos seringais',
  revolta: 'Revolta nos seringais',
  continuidade: 'O governo segue como está',
  oposicao: 'Oposição ganha força na Assembleia',
  intervencao: 'Intervenção federal no Amazonas',
  resiste: 'Uma grande casa resiste à crise',
  falencia: 'Falência de uma grande casa',
  resgate: 'Resgate de uma casa em crise',
  cartel: 'Cartel da borracha se forma',
  sim: 'A Assembleia aprovou uma proposta',
  nao: 'A Assembleia rejeitou uma proposta',
}
