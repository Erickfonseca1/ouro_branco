// SERVER ONLY. Resolve um turno inteiro (04, seção 3.4), de forma determinística e dentro de uma transação.
import { db, type Jogador, type Partida } from './db'
import * as R from './regras'
import { BIFURCACOES, cumprido, marcosDaVariante, type Contexto } from './objetivos'
import { atribuirPapel } from './sessao'
import { proximoPrazo } from './tempo'

type Abertura = { tipo: R.AbertaId; alvo?: number | R.NpcId; metodo?: R.MetodoId }
export type Ordens = {
  abertas?: Abertura[]
  secreta?: { tipo: R.SecretaId; alvo?: number | R.NpcId; quantidade?: number }
  aviar?: boolean
  vender?: { quantidade: number; canal: 'casa' | 'exportador' }
  propostas?: { alvo: number; valor: number }[]
  respostas?: Record<string, 'aceitar' | 'recusar'>
  reivindicar?: boolean
}

type Linha = Jogador
type Contrato = { id: number; de_id: number; para_id: number; valor: number; turnos: number; status: string; turno_proposta: number }

const NPC_NOME = Object.fromEntries(R.NPCS.map((n) => [n.id, n.nome])) as Record<string, string>

// Validação de ordens feita ao salvar (API). Retorna mensagem de erro ou null.
export function validarOrdens(o: Ordens, partidaId: number, jogadorId: number): string | null {
  const abertas = o.abertas ?? []
  if (abertas.length > R.LIMITE_ABERTAS) return 'Só duas ações abertas por turno.'
  for (const a of abertas) {
    if (!(R.ABERTAS as readonly string[]).includes(a.tipo)) return 'Ação aberta inválida.'
    if (a.tipo === 'visitar' && (!NPC_NOME[a.alvo as string] || !a.metodo || !(a.metodo in R.METODOS))) return 'Escolha quem visitar e como.'
    if (a.tipo === 'denunciar' && !alvoValido(a.alvo, partidaId, jogadorId)) return 'Escolha quem denunciar.'
  }
  if (o.secreta) {
    const s = o.secreta
    if (!(R.SECRETAS as readonly string[]).includes(s.tipo)) return 'Ação secreta inválida.'
    if (s.tipo === 'subornar' && !NPC_NOME[s.alvo as string]) return 'Escolha quem subornar.'
    if (['plantar_boato', 'espionar'].includes(s.tipo) && !alvoValido(s.alvo, partidaId, jogadorId)) return 'Escolha o alvo.'
  }
  if (o.vender && (!Number.isInteger(o.vender.quantidade) || o.vender.quantidade < 0)) return 'Quantidade inválida.'
  for (const p of o.propostas ?? []) {
    if (!alvoValido(p.alvo, partidaId, jogadorId)) return 'Proposta com alvo inválido.'
    if (!Number.isInteger(p.valor) || p.valor < 1 || p.valor > R.PROPOSTA_VALOR_MAX) return `Pagamento entre 1 e ${R.PROPOSTA_VALOR_MAX}₵.`
  }
  return null
}

function alvoValido(alvo: unknown, partidaId: number, jogadorId: number) {
  if (typeof alvo !== 'number' || alvo === jogadorId) return false
  return !!db.prepare('SELECT 1 FROM jogadores WHERE id = ? AND partida_id = ?').get(alvo, partidaId)
}

export function resolverDevidos(partidaId: number) {
  for (let i = 0; i < R.TURNO_FIM + 1; i++) {
    const p = db.prepare('SELECT * FROM partidas WHERE id = ?').get(partidaId) as Partida
    if (p.status !== 'aberto' || new Date(p.prazo).getTime() > Date.now()) return
    resolverTurno(p)
  }
}

function resolverTurno(p: Partida) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const t = p.turno
    const rng = R.sementeRng(p.semente + t * 7919)
    const jogadores = db.prepare('SELECT * FROM jogadores WHERE partida_id = ? ORDER BY id').all(p.id) as Linha[]
    for (const j of jogadores) atribuirPapel(j, p)
    const nomes = new Map(jogadores.map((j) => [j.id, j.nome]))
    const privado = new Map<number, string[]>(jogadores.map((j) => [j.id, []]))
    const aviso = (id: number, texto: string) => privado.get(id)?.push(texto)
    const publico: { tipo: string; texto: string; alvo?: number }[] = []

    const ordens = new Map<number, Ordens>()
    for (const j of jogadores) {
      const row = db.prepare('SELECT payload FROM ordens WHERE partida_id = ? AND jogador_id = ? AND turno = ?').get(p.id, j.id, t) as
        | { payload: string }
        | undefined
      ordens.set(j.id, row ? JSON.parse(row.payload) : { aviar: true, vender: { quantidade: 999, canal: 'casa' } })
    }
    const seringais = db.prepare('SELECT id, dono_id FROM seringais WHERE partida_id = ? ORDER BY slot').all(p.id) as { id: number; dono_id: number | null }[]
    const donosDe = (id: number) => seringais.filter((s) => s.dono_id === id).length

    // 1. Contratos ativos: pagamento de cada turno.
    const contratos = db.prepare('SELECT * FROM contratos WHERE partida_id = ?').all(p.id) as Contrato[]
    for (const c of contratos.filter((c) => c.status === 'ativo')) {
      const de = jogadores.find((j) => j.id === c.de_id)!
      const para = jogadores.find((j) => j.id === c.para_id)!
      if (de.caixa >= c.valor) {
        de.caixa -= c.valor
        para.caixa += c.valor
        const restam = c.turnos - 1
        db.prepare('UPDATE contratos SET turnos = ?, status = ? WHERE id = ?').run(restam, restam > 0 ? 'ativo' : 'encerrado', c.id)
        aviso(de.id, `Contrato com ${para.nome} pago: ${c.valor}₵.`)
        aviso(para.id, `${de.nome} pagou ${c.valor}₵ pelo contrato.`)
      } else {
        db.prepare("UPDATE contratos SET status = 'quebrado' WHERE id = ?").run(c.id)
        de.prestigio = Math.max(0, de.prestigio - 1)
        aviso(de.id, `Você não pagou o contrato com ${para.nome}. Perdeu 1★.`)
        aviso(para.id, `${de.nome} quebrou um contrato com você.`)
        publico.push({ tipo: 'nota', texto: `Um contrato foi quebrado no porto.` })
      }
    }

    // 2. Propostas: respostas dadas agora; as não respondidas expiram; novas propostas entram.
    const propostas = contratos.filter((c) => c.status === 'proposto')
    for (const c of propostas) {
      const resposta = ordens.get(c.para_id)?.respostas?.[String(c.id)]
      if (c.turno_proposta < t && resposta === 'aceitar') {
        db.prepare("UPDATE contratos SET status = 'ativo', turno_inicio = ?, turnos = ? WHERE id = ?").run(t, R.PROPOSTA_TURNOS, c.id)
        const de = nomes.get(c.de_id)!
        const para = nomes.get(c.para_id)!
        aviso(c.de_id, `${para} aceitou seu contrato de ${c.valor}₵ por turno.`)
        aviso(c.para_id, `Você aceitou o contrato de ${de}.`)
        publico.push({ tipo: 'nota', texto: `Dois jogadores fecharam um contrato de borracha.` })
      } else if (c.turno_proposta < t) {
        db.prepare("UPDATE contratos SET status = 'expirado' WHERE id = ?").run(c.id)
        aviso(c.de_id, `Sua proposta a ${nomes.get(c.para_id)} expirou.`)
      }
    }
    for (const j of jogadores) {
      for (const pr of ordens.get(j.id)?.propostas ?? []) {
        db.prepare('INSERT INTO contratos (partida_id, de_id, para_id, valor, turnos, status, turno_proposta) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          p.id, j.id, pr.alvo, pr.valor, R.PROPOSTA_TURNOS, 'proposto', t,
        )
        aviso(pr.alvo, `${j.nome} propôs um contrato de ${pr.valor}₵ por turno. Responda nas ordens.`)
      }
    }

    // 3. Aviamento e produção.
    for (const j of jogadores) {
      if (!ordens.get(j.id)?.aviar) continue
      const custo = R.aviamento(t)
      const n = donosDe(j.id)
      let aviados = 0
      for (let i = 0; i < n && j.caixa >= custo; i++) {
        j.caixa -= custo
        aviados++
      }
      j.estoque += aviados * R.PRODUCAO_POR_SERINGAL
      if (aviados < n) aviso(j.id, `Aviamento parcial: ${aviados} de ${n} seringais produziram.`)
      else if (n > 0) aviso(j.id, `${aviados} seringais aviados, ${aviados * R.PRODUCAO_POR_SERINGAL} lotes produzidos.`)
    }

    // 4. Vendas e preço (dilema do cartel).
    const demanda = R.DEMANDA_POR_SERINGAL * seringais.length
    const vendas = new Map<number, { q: number; canal: 'casa' | 'exportador' }>()
    let capacidadeExp = R.CAPACIDADE_EXPORTADOR
    for (const j of jogadores) {
      const v = ordens.get(j.id)?.vender
      if (!v) continue
      const q = Math.min(v.quantidade, j.estoque)
      if (q <= 0) continue
      if (v.canal === 'exportador') {
        const aceito = Math.min(q, capacidadeExp)
        capacidadeExp -= aceito
        if (aceito > 0) vendas.set(j.id, { q: aceito, canal: 'exportador' })
      } else {
        vendas.set(j.id, { q, canal: 'casa' })
      }
    }
    const volume = [...vendas.values()].reduce((s, v) => s + v.q, 0)
    const germinou = germinouAteAgora(p.id)
    let pBase = R.P_BASE[Math.min(t, 12) - 1]
    if (germinou && t >= 11) pBase *= 0.4
    else if (germinou && t >= 9) pBase *= 0.65
    pBase = Math.max(1.5, pBase)
    const bruto = pBase - 0.25 * (volume - demanda)
    const preco = Math.round(Math.min(pBase + 2, Math.max(1, bruto)) * 4) / 4

    for (const j of jogadores) {
      const v = vendas.get(j.id)
      if (!v) continue
      const taxa = v.canal === 'exportador' ? R.PRECO_EXPORTADOR : R.PRECO_CASA
      const bruto = Math.round(v.q * preco * taxa * 100) / 100
      const custoFrete = Math.round(v.q * R.frete(preco) * 100) / 100
      const recebido = Math.round((bruto - custoFrete) * 100) / 100
      j.caixa += recebido
      j.estoque -= v.q
      aviso(j.id, `Vendeu ${v.q} lotes ${v.canal === 'exportador' ? 'ao exportador' : 'à casa comercial'}: ${bruto}₵, menos ${custoFrete}₵ de frete.`)
    }
    for (const j of jogadores) {
      j.estoque = Math.floor(j.estoque * R.LOTE_PARADO)
    }
    db.prepare('INSERT INTO historico (partida_id, turno, preco, vendido, demanda) VALUES (?, ?, ?, ?, ?)').run(p.id, t, preco, volume, demanda)
    publico.push({ tipo: 'manchete', texto: `Borracha a ${preco.toFixed(2).replace('.', ',')}₵ o lote no fim do turno ${t}.` })

    // 5. Ações abertas (até 2) e secreta (até 1). Secretas por prestígio crescente.
    const denunciadoNoTurno = new Set<number>()
    for (const j of jogadores) {
      for (const a of (ordens.get(j.id)?.abertas ?? []).slice(0, R.LIMITE_ABERTAS)) {
        executarAberta(p, j, a, jogadores, seringais, rng, publico, aviso, denunciadoNoTurno, t)
      }
    }
    const secretas = [...jogadores].sort((a, b) => a.prestigio - b.prestigio || a.id - b.id)
    for (const j of secretas) {
      const s = ordens.get(j.id)?.secreta
      if (s) executarSecreta(p, j, s, jogadores, rng, publico, aviso, t, preco)
    }

    // 6. Luxo (conta de posição).
    for (const j of jogadores) {
      const custo = R.luxo(j.prestigio)
      if (j.caixa >= custo) {
        j.caixa -= custo
      } else {
        j.prestigio = Math.max(0, j.prestigio - 1)
        aviso(j.id, 'Não pagou o luxo. Perdeu 1★.')
      }
    }

    // 7. Bifurcações do turno (sorteadas pela semente da partida).
    for (const [codigo, b] of Object.entries(BIFURCACOES)) {
      if (b.turno !== t) continue
      const pares = Object.entries(b.desfechos)
      const desfecho = R.sortear(rng, pares.map(([, pr]) => pr), pares.map(([k]) => k))
      db.prepare('INSERT INTO bifurcacoes (partida_id, codigo, desfecho, turno) VALUES (?, ?, ?, ?)').run(p.id, codigo, desfecho, t)
      publico.push({ tipo: 'manchete', texto: R.NOTICIAS[desfecho] ?? 'Notícia do interior' })
    }

    // 8. Contexto e marcos. Só depois de tudo o que o turno mexe.
    const bifs = Object.fromEntries(
      (db.prepare('SELECT codigo, desfecho FROM bifurcacoes WHERE partida_id = ?').all(p.id) as { codigo: string; desfecho: string }[]).map((b) => [b.codigo, b.desfecho]),
    )
    const provasDe = (id: number) =>
      (db.prepare("SELECT COUNT(*) AS n FROM pistas WHERE partida_id = ? AND jogador_id = ? AND nivel = 'prova'").get(p.id, id) as { n: number }).n
    const contratosAtivos = db.prepare("SELECT de_id, para_id FROM contratos WHERE partida_id = ? AND status = 'ativo'").all(p.id) as {
      de_id: number
      para_id: number
    }[]
    const contagem = new Map<number, number>()
    for (const j of jogadores) {
      const ctx: Contexto = {
        turno: t,
        caixa: j.caixa,
        prestigio: j.prestigio,
        seringais: donosDe(j.id),
        preco,
        contratosAtivos: contratosAtivos
          .filter((c) => c.de_id === j.id || c.para_id === j.id)
          .map((c) => ({ parceiroId: c.de_id === j.id ? c.para_id : c.de_id })),
        bifurcacoes: bifs,
        provas: provasDe(j.id),
        acoesSecretasFeitas: j.secretas,
        relogio: t >= 6,
      }
      const marcos = marcosDaVariante(j.variante ?? '')
      const n = marcos.filter((m) => cumprido(m, ctx)).length
      contagem.set(j.id, n)
      if (n > j.marcos_max) {
        j.marcos_max = n
        j.marcos_max_turno = t
      }
      if (n >= 2 && !j.sinal) {
        j.sinal = 1
        publico.push({ tipo: 'nota', texto: 'Fontes do Cartório indicam que uma das grandes casas de Manaus está a um passo de algo grande.' })
      }
    }

    // 9. Reivindicação: defesa (se houver uma aberta no turno anterior) ou nova reivindicação.
    let vencedor: number | null = null
    const reiv = p.reivindicador_id
    if (reiv && p.reivindicacao_turno !== null && p.reivindicacao_turno < t) {
      const r = jogadores.find((j) => j.id === reiv)!
      const caiu = denunciadoNoTurno.has(reiv) || (contagem.get(reiv) ?? 0) < R.MARCOS_PARA_REIVINDICAR
      if (caiu) {
        r.prestigio = Math.max(0, r.prestigio - 1)
        r.bloqueado_ate = t + 1
        publico.push({ tipo: 'manchete', texto: `A reivindicação de ${r.nome} caiu. A partida segue.` })
        aviso(r.id, 'Sua reivindicação caiu. Perdeu 1★ e não pode reivindicar no próximo turno.')
      } else {
        vencedor = reiv
      }
      db.prepare('UPDATE partidas SET reivindicador_id = NULL, reivindicacao_turno = NULL WHERE id = ?').run(p.id)
    } else if (!reiv) {
      for (const j of jogadores) {
        if (!ordens.get(j.id)?.reivindicar) continue
        if (t < R.TURNO_REIVINDICAR || j.bloqueado_ate >= t) continue
        if ((contagem.get(j.id) ?? 0) < R.MARCOS_PARA_REIVINDICAR) continue
        db.prepare('UPDATE partidas SET reivindicador_id = ?, reivindicacao_turno = ? WHERE id = ?').run(j.id, t, p.id)
        publico.push({ tipo: 'manchete', texto: `${j.nome} reivindica o título. Os demais têm um turno para derrubar a reivindicação.` })
        break
      }
    }

    // 10. Fim da partida.
    const reivNovo = db.prepare('SELECT reivindicador_id FROM partidas WHERE id = ?').get(p.id) as { reivindicador_id: number | null }
    if (!vencedor && t >= R.TURNO_FIM) {
      if (reivNovo.reivindicador_id) {
        const r = reivNovo.reivindicador_id
        if ((contagem.get(r) ?? 0) >= R.MARCOS_PARA_REIVINDICAR) vencedor = r
      }
      if (!vencedor) {
        vencedor = [...jogadores].sort((a, b) => (contagem.get(b.id) ?? 0) - (contagem.get(a.id) ?? 0) || a.marcos_max_turno - b.marcos_max_turno || a.id - b.id)[0].id
      }
    }
    if (vencedor) {
      db.prepare("UPDATE partidas SET vencedor_id = ?, status = 'fim' WHERE id = ?").run(vencedor, p.id)
      publico.push({ tipo: 'manchete', texto: `${nomes.get(vencedor)} venceu a partida.` })
    }

    // 11. Gravação.
    for (const j of jogadores) {
      db.prepare(
        'UPDATE jogadores SET caixa = ?, prestigio = ?, estoque = ?, marcos_max = ?, marcos_max_turno = ?, bloqueado_ate = ?, sinal = ?, secretas = ? WHERE id = ?',
      ).run(j.caixa, j.prestigio, j.estoque, j.marcos_max, j.marcos_max_turno, j.bloqueado_ate, j.sinal, j.secretas, j.id)
      const linhas = privado.get(j.id) ?? []
      linhas.unshift(`Turno ${t}: ${contagem.get(j.id) ?? 0} de 3 marcos cumpridos. Caixa ${j.caixa.toFixed(2).replace('.', ',')}₵.`)
      for (const texto of linhas) db.prepare('INSERT INTO caixa (jogador_id, texto) VALUES (?, ?)').run(j.id, texto)
    }
    db.prepare('UPDATE partidas SET preco = ?, relogio = ? WHERE id = ?').run(preco, t, p.id)
    for (const g of publico) {
      db.prepare('INSERT INTO gazeta (partida_id, turno, tipo, texto, alvo_id) VALUES (?, ?, ?, ?, ?)').run(p.id, t, g.tipo, g.texto, g.alvo ?? null)
    }

    if (!vencedor) {
      const prox = proximoPrazo(new Date(p.prazo))
      db.prepare('UPDATE partidas SET turno = ?, prazo = ? WHERE id = ?').run(t + 1, prox.toISOString(), p.id)
    }
    db.exec('COMMIT')
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

function germinouAteAgora(partidaId: number) {
  const r = db.prepare("SELECT 1 FROM bifurcacoes WHERE partida_id = ? AND codigo = 'B3' AND desfecho = 'germina'").get(partidaId)
  return !!r
}

function executarAberta(
  p: Partida,
  j: Linha,
  a: Abertura,
  jogadores: Linha[],
  seringais: { id: number; dono_id: number | null }[],
  rng: () => number,
  publico: { tipo: string; texto: string; alvo?: number }[],
  aviso: (id: number, texto: string) => void,
  denunciados: Set<number>,
  t: number,
) {
  if (a.tipo === 'investir') {
    if (j.caixa < R.CUSTO_SERINGAL) return aviso(j.id, 'Sem caixa para investir.')
    j.caixa -= R.CUSTO_SERINGAL
    const slot = seringais.length
    const id = Number(db.prepare('INSERT INTO seringais (partida_id, dono_id, slot) VALUES (?, ?, ?)').run(p.id, j.id, slot).lastInsertRowid)
    seringais.push({ id, dono_id: j.id })
    aviso(j.id, 'Comprou um seringal. Ele produz a partir do próximo turno.')
  }
  if (a.tipo === 'doar') {
    if (j.caixa < R.CUSTO_DOAR || j.prestigio >= R.PRESTIGIO_MAX) return aviso(j.id, 'Doação não feita: sem caixa ou prestígio no limite.')
    j.caixa -= R.CUSTO_DOAR
    j.prestigio += 1
    aviso(j.id, 'Doação feita: +1★.')
  }
  if (a.tipo === 'visitar' && typeof a.alvo === 'string' && a.metodo) {
    const m = R.METODOS[a.metodo]
    if (j.caixa < m.custo) return aviso(j.id, 'Sem caixa para essa visita.')
    j.caixa -= m.custo
    const npc = R.NPCS.find((n) => n.id === a.alvo)!
    const [pNada, pBoato, pIndicio] = m.chances
    const r = rng()
    const resultado = r < pNada ? 0 : r < pNada + pBoato ? 1 : r < pNada + pBoato + pIndicio ? 2 : 3
    const rel = db.prepare('SELECT valor FROM relacoes WHERE jogador_id = ? AND npc = ?').get(j.id, npc.id) as { valor: number } | undefined
    const novo = Math.max(0, Math.min(5, (rel?.valor ?? 0) + m.relacao))
    db.prepare('INSERT INTO relacoes (jogador_id, npc, valor) VALUES (?, ?, ?) ON CONFLICT(jogador_id, npc) DO UPDATE SET valor = excluded.valor').run(j.id, npc.id, novo)
    const outros = jogadores.filter((x) => x.id !== j.id)
    publico.push({ tipo: 'registro', texto: `${j.nome} visitou ${npc.nome}.`, alvo: j.id })
    if (resultado === 0) return aviso(j.id, `${npc.nome}: nada de útil.`)
    const alvo = outros[Math.floor(rng() * outros.length)]
    const nivel = R.NIVEIS[resultado - 1]
    db.prepare('INSERT INTO pistas (partida_id, jogador_id, alvo_id, nivel, fonte, turno) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, j.id, alvo.id, nivel, npc.nome, t,
    )
    aviso(j.id, `${npc.nome} deixou uma pista (${nivel}) sobre ${alvo.nome}.`)
  }
  if (a.tipo === 'denunciar' && typeof a.alvo === 'number') {
    const prova = db.prepare("SELECT 1 FROM pistas WHERE partida_id = ? AND jogador_id = ? AND alvo_id = ? AND nivel = 'prova'").get(p.id, j.id, a.alvo)
    if (!prova) return aviso(j.id, 'Denúncia sem prova não vai a lugar nenhum.')
    const alvo = jogadores.find((x) => x.id === a.alvo)!
    alvo.prestigio = Math.max(0, alvo.prestigio - 2)
    denunciados.add(alvo.id)
    publico.push({ tipo: 'manchete', texto: `Denúncia com prova no Cartório contra ${alvo.nome}.`, alvo: alvo.id })
    aviso(j.id, `Denúncia enviada contra ${alvo.nome}.`)
  }
}

function executarSecreta(
  p: Partida,
  j: Linha,
  s: NonNullable<Ordens['secreta']>,
  jogadores: Linha[],
  rng: () => number,
  publico: { tipo: string; texto: string; alvo?: number }[],
  aviso: (id: number, texto: string) => void,
  t: number,
  preco: number,
) {
  const custo = { subornar: 3, plantar_boato: 1, comprar_silencio: 3, espionar: 1, contrabandear: 0 }[s.tipo]
  if (j.caixa < custo) return aviso(j.id, 'Sem caixa para a ação secreta.')
  j.caixa -= custo
  j.secretas += 1
  if (s.tipo === 'subornar' && typeof s.alvo === 'string') {
    const npc = R.NPCS.find((n) => n.id === s.alvo)!
    if (rng() < 0.7) {
      const rel = db.prepare('SELECT valor FROM relacoes WHERE jogador_id = ? AND npc = ?').get(j.id, npc.id) as { valor: number } | undefined
      db.prepare('INSERT INTO relacoes (jogador_id, npc, valor) VALUES (?, ?, ?) ON CONFLICT(jogador_id, npc) DO UPDATE SET valor = excluded.valor').run(
        j.id, npc.id, Math.min(5, (rel?.valor ?? 0) + 1),
      )
      aviso(j.id, `${npc.nome} aceitou. Relação +1.`)
    } else {
      aviso(j.id, `${npc.nome} recusou o pagamento.`)
    }
    if (rng() < 0.5) publico.push({ tipo: 'nota', texto: `Um pagamento suspeito foi visto perto de ${npc.papel.toLowerCase()}.` })
  }
  if (s.tipo === 'plantar_boato' && typeof s.alvo === 'number') {
    const alvo = jogadores.find((x) => x.id === s.alvo)!
    publico.push({ tipo: 'boato', texto: `Corre um boato sobre ${alvo.nome}.`, alvo: alvo.id })
    if (rng() < 0.5) alvo.prestigio = Math.max(0, alvo.prestigio - 1)
    aviso(j.id, `Boato plantado sobre ${alvo.nome}.`)
  }
  if (s.tipo === 'comprar_silencio') {
    const ultimo = db
      .prepare("SELECT id FROM gazeta WHERE partida_id = ? AND tipo = 'boato' AND alvo_id = ? ORDER BY id DESC LIMIT 1")
      .get(p.id, j.id) as { id: number } | undefined
    if (ultimo) db.prepare('DELETE FROM gazeta WHERE id = ?').run(ultimo.id)
    aviso(j.id, ultimo ? 'Você calou o último boato sobre você.' : 'Não havia boato sobre você.')
  }
  if (s.tipo === 'espionar' && typeof s.alvo === 'number') {
    const visita = db
      .prepare("SELECT texto FROM gazeta WHERE partida_id = ? AND tipo = 'registro' AND alvo_id = ? AND turno <= ? ORDER BY id DESC LIMIT 1")
      .get(p.id, s.alvo, t) as { texto: string } | undefined
    const alvo = jogadores.find((x) => x.id === s.alvo)!
    if (!visita) return aviso(j.id, `Telégrafo: nada sobre ${alvo.nome}.`)
    db.prepare("INSERT INTO pistas (partida_id, jogador_id, alvo_id, nivel, fonte, turno) VALUES (?, ?, ?, 'indicio', 'Telégrafo', ?)").run(
      p.id, j.id, alvo.id, t,
    )
    aviso(j.id, `Telégrafo: ${visita.texto}`)
  }
  if (s.tipo === 'contrabandear') {
    const q = Math.min(s.quantidade ?? 0, j.estoque)
    if (q > 0) {
      const ganho = Math.round(q * R.PRECO_EXPORTADOR * preco * 100) / 100
      j.caixa += ganho
      j.estoque -= q
      aviso(j.id, `Contrabando: ${q} lotes vendidos por ${ganho}₵.`)
      if (rng() < 0.5) publico.push({ tipo: 'nota', texto: 'Contrabando no porto. Ninguém sabe de quem é a carga.' })
    }
  }
}

