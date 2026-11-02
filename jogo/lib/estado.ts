// SERVER ONLY. Monta o que cada jogador pode ver. Nada de marcos de outros jogadores aqui.
import { db, type Jogador, type Partida } from './db'
import { papel, rotuloJogador } from './papeis'
import * as R from './regras'
import { labelMarco, marcosDaVariante, cumprido, type Contexto } from './objetivos'
import { resolverDevidos, type Ordens } from './motor'
import { contarVotos } from './votos'

export const CORES = ['--p-ab', '--p-bg', '--p-es', '--p-am', '--p-ta', '--p-ew', '--p-ma', '--p-x'] as const

export type Visao = Awaited<ReturnType<typeof carregarEstado>>

export function iniciais(nome: string) {
  const partes = nome.replace(/["“”]/g, '').split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')).toUpperCase()
}

export function carregarEstado(jogadorId: number) {
  const eu0 = db.prepare('SELECT * FROM jogadores WHERE id = ?').get(jogadorId) as Jogador
  resolverDevidos(eu0.partida_id)

  const p = db.prepare('SELECT * FROM partidas WHERE id = ?').get(eu0.partida_id) as Partida
  const eu = db.prepare('SELECT * FROM jogadores WHERE id = ?').get(jogadorId) as Jogador
  const jogadores = db.prepare('SELECT * FROM jogadores WHERE partida_id = ? ORDER BY id').all(p.id) as Jogador[]
  const cor = new Map(jogadores.map((j, i) => [j.id, CORES[i % CORES.length]]))
  const seringais = db.prepare('SELECT id, dono_id, slot FROM seringais WHERE partida_id = ? ORDER BY slot').all(p.id) as {
    id: number
    dono_id: number | null
    slot: number
  }[]
  const meus = seringais.filter((s) => s.dono_id === eu.id).length

  // Contexto de marcos só do próprio jogador, para o Caderno.
  const bifs = Object.fromEntries(
    (db.prepare('SELECT codigo, desfecho FROM bifurcacoes WHERE partida_id = ?').all(p.id) as { codigo: string; desfecho: string }[]).map((b) => [b.codigo, b.desfecho]),
  )
  const ativos = db.prepare("SELECT de_id, para_id FROM contratos WHERE partida_id = ? AND status = 'ativo'").all(p.id) as { de_id: number; para_id: number }[]
  const provas = (db.prepare("SELECT COUNT(*) AS n FROM pistas WHERE partida_id = ? AND jogador_id = ? AND nivel = 'prova'").get(p.id, eu.id) as { n: number }).n
  const ctx: Contexto = {
    turno: p.turno,
    caixa: eu.caixa,
    prestigio: eu.prestigio,
    seringais: meus,
    preco: p.preco ?? 0,
    contratosAtivos: ativos.filter((c) => c.de_id === eu.id || c.para_id === eu.id).map((c) => ({ parceiroId: c.de_id === eu.id ? c.para_id : c.de_id })),
    bifurcacoes: bifs,
    provas,
    acoesSecretasFeitas: eu.secretas,
    relogio: p.turno >= 6,
  }
  const marcos = marcosDaVariante(eu.variante ?? '').map((m) => ({
    rotulo: labelMarco(m),
    cumprido: cumprido(m, ctx),
    liberado: p.turno >= m.turno_min,
    turnoMin: m.turno_min,
  }))

  // Com a partida encerrada o turno não avança: a última edição é a do próprio turno final.
  const ultimoTurno = p.status === 'aberto' ? Math.max(1, p.turno - 1) : p.turno
  const gazetaTurno = db.prepare('SELECT tipo, texto, alvo_id FROM gazeta WHERE partida_id = ? AND turno = ? ORDER BY id').all(p.id, ultimoTurno) as {
    tipo: string
    texto: string
    alvo_id: number | null
  }[]
  // Boatos e registros são públicos; o boato sobre um jogador é mostrado a todos.
  const gazeta = gazetaTurno.filter((g) => g.tipo !== 'registro')
  const registros = gazetaTurno.filter((g) => g.tipo === 'registro').map((g) => g.texto)

  const historico = db.prepare('SELECT turno, preco, vendido, demanda FROM historico WHERE partida_id = ? ORDER BY turno').all(p.id) as {
    turno: number
    preco: number
    vendido: number
    demanda: number
  }[]

  const contratos = db
    .prepare(
      `SELECT c.id, c.de_id, c.para_id, c.valor, c.turnos, c.status, c.turno_proposta FROM contratos c
       WHERE c.partida_id = ? AND (c.de_id = ? OR c.para_id = ?) AND c.status IN ('proposto','ativo') ORDER BY c.id`,
    )
    .all(p.id, eu.id, eu.id) as { id: number; de_id: number; para_id: number; valor: number; turnos: number; status: string; turno_proposta: number }[]
  const nomePor = new Map(jogadores.map((j) => [j.id, j.nome]))
  // "Nome – Personagem" em tudo que o jogador lê, para lembrar quem joga com quem.
  const rotuloPor = new Map(jogadores.map((j) => [j.id, rotuloJogador(j.nome, j.papel)]))

  const relacoes = db.prepare('SELECT npc, valor FROM relacoes WHERE jogador_id = ?').all(eu.id) as { npc: string; valor: number }[]
  const pistas = db
    .prepare('SELECT alvo_id, nivel, fonte, turno FROM pistas WHERE partida_id = ? AND jogador_id = ? ORDER BY id DESC LIMIT 30')
    .all(p.id, eu.id) as { alvo_id: number; nivel: string; fonte: string; turno: number }[]

  const ordemAtual = db.prepare('SELECT payload FROM ordens WHERE partida_id = ? AND jogador_id = ? AND turno = ?').get(p.id, eu.id, p.turno) as
    | { payload: string }
    | undefined
  const naoLidas = (db.prepare('SELECT COUNT(*) AS n FROM caixa WHERE jogador_id = ? AND lida = 0').get(eu.id) as { n: number }).n
  const dicasVistas = (db.prepare('SELECT chave FROM dicas WHERE jogador_id = ?').all(eu.id) as { chave: string }[]).map((d) => d.chave)

  const reivindicador = p.reivindicador_id ? rotuloPor.get(p.reivindicador_id) ?? null : null
  const vencedor = p.vencedor_id ? rotuloPor.get(p.vencedor_id) ?? null : null
  const podeReivindicar = !p.reivindicador_id && p.turno >= R.TURNO_REIVINDICAR && eu.bloqueado_ate < p.turno && marcos.every((m) => m.cumprido)

  return {
    partida: {
      id: p.id,
      codigo: p.codigo,
      turno: p.turno,
      prazo: p.prazo,
      agora: Date.now(),
      status: p.status,
      preco: p.preco,
      demanda: R.DEMANDA_POR_SERINGAL * seringais.length,
      vencedor,
      reivindicador,
      reivindicacaoTurno: p.reivindicacao_turno,
      historico,
      votos: contarVotos(p.id, p.turno, eu.id),
      criador: jogadores.find((j) => j.criador)?.nome ?? '',
    },
    eu: {
      id: eu.id,
      nome: eu.nome,
      rotulo: rotuloPor.get(eu.id)!,
      papel: papel(eu.papel),
      cor: cor.get(eu.id)!,
      caixa: eu.caixa,
      prestigio: eu.prestigio,
      estoque: eu.estoque,
      seringais: meus,
      criador: !!eu.criador,
      marcos,
      marcosCumpridos: marcos.filter((m) => m.cumprido).length,
      podeReivindicar,
      bloqueado: eu.bloqueado_ate >= p.turno,
      naoLidas,
    },
    jogadores: jogadores.map((j) => ({
      id: j.id,
      nome: j.nome,
      rotulo: rotuloPor.get(j.id)!,
      personagem: papel(j.papel),
      iniciais: iniciais(j.nome),
      cor: cor.get(j.id)!,
      eu: j.id === eu.id,
    })),
    seringais: seringais.map((s) => ({ slot: s.slot, dono: s.dono_id, cor: s.dono_id ? cor.get(s.dono_id) ?? null : null, iniciais: s.dono_id ? iniciais(nomePor.get(s.dono_id) ?? '') : '' })),
    gazeta,
    registros,
    contratos: contratos.map((c) => ({
      ...c,
      deNome: rotuloPor.get(c.de_id),
      paraNome: rotuloPor.get(c.para_id),
      recebo: c.para_id === eu.id,
    })),
    relacoes: R.NPCS.map((n) => ({ ...n, valor: relacoes.find((r) => r.npc === n.id)?.valor ?? 0 })),
    pistas: pistas.map((k) => ({ ...k, alvoNome: rotuloPor.get(k.alvo_id) })),
    ordens: ordemAtual ? (JSON.parse(ordemAtual.payload) as Ordens) : null,
    ordemEnviada: !!ordemAtual,
    dicasVistas,
  }
}

export function listaParaOrdens(jogadorId: number) {
  const v = carregarEstado(jogadorId)
  return {
    turno: v.partida.turno,
    prazo: v.partida.prazo,
    agora: v.partida.agora,
    status: v.partida.status,
    jogadores: v.jogadores.filter((j) => !j.eu).map((j) => ({ id: j.id, nome: j.rotulo })),
    eu: v.eu.rotulo,
    caixa: v.eu.caixa,
    prestigio: v.eu.prestigio,
    aviamento: R.aviamento(v.partida.turno),
    luxo: R.luxo(v.eu.prestigio),
    preco: v.partida.preco ?? R.P_BASE[Math.min(v.partida.turno, 12) - 1],
    npcs: R.NPCS.map((n) => ({ id: n.id, nome: n.nome, papel: n.papel })),
    metodos: Object.entries(R.METODOS).map(([id, m]) => ({ id, nome: m.nome, custo: m.custo })),
    contratosRecebidos: v.contratos.filter((c) => c.status === 'proposto' && c.recebo),
    podeReivindicar: v.eu.podeReivindicar,
    estoque: v.eu.estoque,
    votos: v.partida.votos,
    dicasVistas: v.dicasVistas,
    seringais: v.eu.seringais,
    ordens: v.ordens,
    ordemEnviada: v.ordemEnviada,
    encerrado: v.partida.status !== 'aberto',
  }
}
