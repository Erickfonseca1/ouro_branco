// SERVER ONLY. Resolve um turno inteiro (04, seção 3.4), de forma determinística e dentro de uma transação.
import { db, type Jogador, type Partida } from './db'
import * as R from './regras'
import { BIFURCACOES, cumprido, marcosDaVariante, type Contexto } from './objetivos'
import { atribuirPapel } from './sessao'
import { rotuloJogador } from './papeis'
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

// rotulo: "Nome – Personagem", usado em todo texto da Gazeta e da caixa de entrada.
type Linha = Jogador & { rotulo: string; credor: Linha | null }
type Contrato = { id: number; de_id: number; para_id: number; valor: number; turnos: number; status: string; turno_proposta: number }

const NPC_IDS = new Set<string>(R.NPCS.map((n) => n.id))
export const ORDEM_PADRAO: Ordens = { aviar: true, vender: { quantidade: 999, canal: 'casa' } }
const cent = (x: number) => Math.round(x * 100) / 100

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const inteiro = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max

// Valida e normaliza as ordens (rota e resolução usam a mesma função). Nunca lança: só aceita o que o motor entende.
export function sanearOrdens(raw: unknown, ids: Set<number>, eu: number): { ordens: Ordens } | { erro: string } {
  const erro = (mensagem: string) => ({ erro: mensagem })
  if (!ehObjeto(raw)) return erro('Ordens inválidas.')
  const alvoJogador = (x: unknown): x is number => typeof x === 'number' && x !== eu && ids.has(x)
  const out: Ordens = {}

  const abertas = raw.abertas ?? []
  if (!Array.isArray(abertas)) return erro('Ações abertas inválidas.')
  if (abertas.length > R.LIMITE_ABERTAS) return erro('Só duas ações abertas por turno.')
  out.abertas = []
  for (const a of abertas) {
    if (!ehObjeto(a) || typeof a.tipo !== 'string' || !(R.ABERTAS as readonly string[]).includes(a.tipo)) return erro('Ação aberta inválida.')
    const tipo = a.tipo as R.AbertaId
    if (tipo === 'visitar') {
      if (typeof a.alvo !== 'string' || !NPC_IDS.has(a.alvo) || typeof a.metodo !== 'string' || !Object.hasOwn(R.METODOS, a.metodo)) return erro('Escolha quem visitar e como.')
      out.abertas.push({ tipo, alvo: a.alvo as R.NpcId, metodo: a.metodo as R.MetodoId })
    } else if (tipo === 'denunciar') {
      if (!alvoJogador(a.alvo)) return erro('Escolha quem denunciar.')
      out.abertas.push({ tipo, alvo: a.alvo })
    } else {
      out.abertas.push({ tipo })
    }
  }

  if (raw.secreta != null) {
    const s = raw.secreta
    if (!ehObjeto(s) || typeof s.tipo !== 'string' || !(R.SECRETAS as readonly string[]).includes(s.tipo)) return erro('Ação secreta inválida.')
    const tipo = s.tipo as R.SecretaId
    if (tipo === 'subornar') {
      if (typeof s.alvo !== 'string' || !NPC_IDS.has(s.alvo)) return erro('Escolha quem subornar.')
      out.secreta = { tipo, alvo: s.alvo as R.NpcId }
    } else if (tipo === 'plantar_boato' || tipo === 'espionar') {
      if (!alvoJogador(s.alvo)) return erro('Escolha o alvo.')
      out.secreta = { tipo, alvo: s.alvo }
    } else if (tipo === 'contrabandear') {
      const q = s.quantidade ?? 0
      if (!inteiro(q, 0, 999)) return erro('Quantidade de contrabando inválida.')
      out.secreta = { tipo, quantidade: q }
    } else {
      out.secreta = { tipo }
    }
  }

  out.aviar = typeof raw.aviar === 'boolean' ? raw.aviar : true
  if (raw.vender === undefined) {
    out.vender = { ...ORDEM_PADRAO.vender! } // sem ordem de venda: vende tudo à casa comercial
  } else {
    const v = raw.vender
    if (!ehObjeto(v) || !inteiro(v.quantidade, 0, 9999)) return erro('Quantidade para vender inválida.')
    out.vender = { quantidade: v.quantidade, canal: v.canal === 'exportador' ? 'exportador' : 'casa' }
  }

  const propostas = raw.propostas ?? []
  if (!Array.isArray(propostas) || propostas.length > 3) return erro('No máximo 3 propostas por turno.')
  out.propostas = []
  for (const pr of propostas) {
    if (!ehObjeto(pr) || !alvoJogador(pr.alvo)) return erro('Proposta com alvo inválido.')
    if (!inteiro(pr.valor, 1, R.PROPOSTA_VALOR_MAX)) return erro(`Pagamento entre 1 e ${R.PROPOSTA_VALOR_MAX}₵.`)
    if (out.propostas.some((x) => x.alvo === pr.alvo)) return erro('Uma proposta por jogador.')
    out.propostas.push({ alvo: pr.alvo, valor: pr.valor })
  }

  if (ehObjeto(raw.respostas)) {
    out.respostas = {}
    for (const [id, r] of Object.entries(raw.respostas)) {
      if (/^\d+$/.test(id) && (r === 'aceitar' || r === 'recusar')) out.respostas[id] = r
    }
  }
  out.reivindicar = raw.reivindicar === true
  return { ordens: out }
}

// Lê as ordens gravadas; se estiverem corrompidas, vale a ordem padrão e o jogador é avisado.
function lerOrdens(payload: string | undefined, ids: Set<number>, id: number, aviso: (id: number, texto: string) => void): Ordens {
  if (!payload) return ORDEM_PADRAO
  try {
    const r = sanearOrdens(JSON.parse(payload), ids, id)
    if ('ordens' in r) return r.ordens
    aviso(id, `Suas ordens foram descartadas (${r.erro}). Valeu a ordem padrão.`)
  } catch {
    aviso(id, 'Suas ordens foram descartadas. Valeu a ordem padrão.')
  }
  return ORDEM_PADRAO
}

export function resolverDevidos(partidaId: number) {
  for (let i = 0; i < R.TURNO_FIM + 1; i++) {
    const p = db.prepare('SELECT * FROM partidas WHERE id = ?').get(partidaId) as Partida
    if (p.status !== 'aberto' || new Date(p.prazo).getTime() > Date.now()) return
    try {
      resolverTurno(p)
    } catch (erro) {
      // Um erro no turno não pode derrubar as telas de todos: registra e deixa a partida como estava.
      console.error(`Falha ao resolver o turno ${p.turno} da partida ${p.codigo}`, erro)
      return
    }
  }
}

// Fecha o turno em aberto agora, sem mexer no calendário: o próximo prazo é o primeiro depois do prazo original.
export function fecharAgora(partidaId: number) {
  const p = db.prepare('SELECT * FROM partidas WHERE id = ?').get(partidaId) as Partida
  if (p.status === 'aberto') resolverTurno(p)
}

function resolverTurno(p: Partida) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const t = p.turno
    const rng = R.sementeRng(p.semente + t * 7919)
    const jogadores = db.prepare('SELECT * FROM jogadores WHERE partida_id = ? ORDER BY id').all(p.id) as Linha[]
    for (const j of jogadores) {
      atribuirPapel(j, p)
      j.rotulo = rotuloJogador(j.nome, j.papel)
      j.credor = null
    }
    for (const j of jogadores) {
      if (j.credor_id) j.credor = jogadores.find((x) => x.id === j.credor_id) ?? null
    }
    const nomes = new Map(jogadores.map((j) => [j.id, j.rotulo]))
    const privado = new Map<number, string[]>(jogadores.map((j) => [j.id, []]))
    const aviso = (id: number, texto: string) => privado.get(id)?.push(texto)
    const publico: { tipo: string; texto: string; alvo?: number }[] = []

    const ids = new Set(jogadores.map((j) => j.id))
    const ordens = new Map<number, Ordens>()
    for (const j of jogadores) {
      const row = db.prepare('SELECT payload FROM ordens WHERE partida_id = ? AND jogador_id = ? AND turno = ?').get(p.id, j.id, t) as
        | { payload: string }
        | undefined
      ordens.set(j.id, lerOrdens(row?.payload, ids, j.id, aviso))
    }
    const seringais = db.prepare('SELECT id, dono_id FROM seringais WHERE partida_id = ? ORDER BY slot').all(p.id) as { id: number; dono_id: number | null }[]
    const donosDe = (id: number) => seringais.filter((s) => s.dono_id === id).length

    // 1. Contratos ativos: pagamento de cada turno.
    const contratos = db.prepare('SELECT * FROM contratos WHERE partida_id = ?').all(p.id) as Contrato[]
    for (const c of contratos.filter((c) => c.status === 'ativo')) {
      const de = jogadores.find((j) => j.id === c.de_id)!
      const para = jogadores.find((j) => j.id === c.para_id)!
      if (de.caixa >= c.valor) {
        de.caixa = cent(de.caixa - c.valor)
        para.caixa = cent(para.caixa + c.valor)
        const restam = c.turnos - 1
        db.prepare('UPDATE contratos SET turnos = ?, status = ? WHERE id = ?').run(restam, restam > 0 ? 'ativo' : 'encerrado', c.id)
        aviso(de.id, `Contrato com ${para.rotulo} pago: ${c.valor}₵.`)
        aviso(para.id, `${de.rotulo} pagou ${c.valor}₵ pelo contrato.`)
      } else {
        db.prepare("UPDATE contratos SET status = 'quebrado' WHERE id = ?").run(c.id)
        de.prestigio = Math.max(0, de.prestigio - 1)
        aviso(de.id, `Você não pagou o contrato com ${para.rotulo}. Perdeu 1★.`)
        aviso(para.id, `${de.rotulo} quebrou um contrato com você.`)
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
        aviso(c.de_id, resposta === 'recusar' ? `${nomes.get(c.para_id)} recusou sua proposta.` : `Sua proposta a ${nomes.get(c.para_id)} expirou.`)
      }
    }
    for (const j of jogadores) {
      for (const pr of ordens.get(j.id)?.propostas ?? []) {
        db.prepare('INSERT INTO contratos (partida_id, de_id, para_id, valor, turnos, status, turno_proposta) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          p.id, j.id, pr.alvo, pr.valor, R.PROPOSTA_TURNOS, 'proposto', t,
        )
        aviso(pr.alvo, `${j.rotulo} propôs um contrato de ${pr.valor}₵ por turno. Responda nas ordens.`)
      }
    }

    // 0. Renda fixa dos papéis sem seringal (04, seção 4.8).
    for (const j of jogadores) {
      const renda = R.RENDA_PAPEL[j.papel ?? 0]
      if (renda) j.caixa = cent(j.caixa + renda)
    }

    // 3. Aviamento e produção. Falta de caixa vira empréstimo: a casa aviadora jogadora empresta o que tem;
    // o resto vem da casa automática, com juros mais altos.
    const aviadora = jogadores.find((j) => j.papel === R.PAPEL_AVIADORA) ?? null
    for (const j of jogadores) {
      if (!ordens.get(j.id)?.aviar) continue
      const n = donosDe(j.id)
      if (!n) continue
      const custo = cent(n * R.aviamento(t))
      const falta = cent(Math.max(0, custo - j.caixa))
      if (falta > 0) {
        const doAviadora = aviadora && aviadora.id !== j.id ? cent(Math.min(falta, Math.max(0, aviadora.caixa))) : 0
        const doAuto = cent(falta - doAviadora)
        if (doAviadora > 0) {
          aviadora!.caixa = cent(aviadora!.caixa - doAviadora)
          aviso(aviadora!.id, `Emprestou ${doAviadora}₵ para o aviamento de ${j.rotulo}.`)
        }
        j.divida = cent(j.divida + falta)
        // Uma taxa só por devedor: a mais alta entre os empréstimos. Havendo parte automática, o credor é a casa automática.
        const taxa = doAuto > 0 ? R.JUROS_AUTOMATICA : R.JUROS_AVIADORA
        j.taxa_divida = Math.max(j.taxa_divida, taxa)
        j.credor = doAuto > 0 ? null : aviadora
        j.caixa = cent(j.caixa + falta)
        aviso(j.id, `Pegou ${falta}₵ emprestados para o aviamento (dívida total: ${j.divida}₵).`)
      }
      j.caixa = cent(j.caixa - custo)
      j.estoque += n * R.PRODUCAO_POR_SERINGAL
      aviso(j.id, `${n} ${n === 1 ? 'seringal aviado' : 'seringais aviados'}, ${n * R.PRODUCAO_POR_SERINGAL} lotes produzidos.`)
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
    // Os seringais do sistema também vendem: sua oferta pesa no preço, mas não paga ninguém (economia.py).
    const ofertaSistema = Math.round(R.SERINGAIS_SISTEMA * R.PRODUCAO_POR_SERINGAL * R.SISTEMA_VENDE)
    const ofertaTotal = volume + ofertaSistema
    const bruto = pBase - 0.25 * (ofertaTotal - demanda)
    const preco = Math.round(Math.min(pBase + 2, Math.max(1, bruto)) * 4) / 4

    // O frete é pago ao armador até a capacidade dos vapores; o resto do frete some (ninguém o recebe).
    const armador = jogadores.find((j) => j.papel === R.PAPEL_ARMADOR) ?? null
    let capacidadeArmador = armador ? R.ARMADOR_CAPACIDADE : 0
    for (const j of jogadores) {
      const v = vendas.get(j.id)
      if (!v) continue
      const taxa = v.canal === 'exportador' ? R.PRECO_EXPORTADOR : R.PRECO_CASA
      const bruto = Math.round(v.q * preco * taxa * 100) / 100
      const custoFrete = Math.round(v.q * R.frete(preco) * 100) / 100
      const noArmador = Math.min(v.q, capacidadeArmador)
      capacidadeArmador -= noArmador
      if (armador && noArmador > 0 && armador.id !== j.id) {
        armador.caixa = cent(armador.caixa + Math.round(noArmador * R.frete(preco) * 100) / 100)
      }
      const recebido = Math.round((bruto - custoFrete) * 100) / 100
      j.caixa = cent(j.caixa + recebido)
      j.estoque -= v.q
      aviso(j.id, `Vendeu ${v.q} lotes ${v.canal === 'exportador' ? 'ao exportador' : 'à casa comercial'}: ${bruto}₵, menos ${custoFrete}₵ de frete.`)
    }
    for (const j of jogadores) {
      j.estoque = Math.floor(j.estoque * R.LOTE_PARADO)
    }
    db.prepare('INSERT INTO historico (partida_id, turno, preco, vendido, demanda) VALUES (?, ?, ?, ?, ?)').run(p.id, t, preco, ofertaTotal, demanda)
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

    // 5b. Juros e amortização das dívidas de aviamento. Juros não pagos viram dívida.
    for (const j of jogadores) {
      if (j.divida <= 0) continue
      const juros = cent(j.divida * j.taxa_divida)
      const pagoJuros = cent(Math.min(juros, Math.max(0, j.caixa)))
      j.caixa = cent(j.caixa - pagoJuros)
      j.divida = cent(j.divida + (juros - pagoJuros))
      if (j.credor && pagoJuros > 0) j.credor.caixa = cent(j.credor.caixa + pagoJuros)
      const pagar = cent(Math.min(j.divida, Math.max(0, j.caixa - 2)))
      j.caixa = cent(j.caixa - pagar)
      j.divida = cent(j.divida - pagar)
      if (j.credor && pagar > 0) j.credor.caixa = cent(j.credor.caixa + pagar)
      if (j.divida < 0.01) {
        j.divida = 0
        j.taxa_divida = 0
        j.credor = null
      }
      aviso(j.id, j.divida > 0 ? `Dívida: ${j.divida}₵ a ${Math.round(j.taxa_divida * 100)}% por turno.` : 'Dívida quitada.')
    }

    // 6. Luxo (conta de posição).
    for (const j of jogadores) {
      const custo = R.luxo(j.prestigio)
      if (j.caixa >= custo) {
        j.caixa = cent(j.caixa - custo)
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
      // marcos_max guarda o número atual de marcos; marcos_max_turno, desde que turno o jogador o tem (desempate).
      if (n !== j.marcos_max) {
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
        publico.push({ tipo: 'manchete', texto: `A reivindicação de ${r.rotulo} caiu. A partida segue.` })
        aviso(r.id, 'Sua reivindicação caiu. Perdeu 1★ e não pode reivindicar no próximo turno.')
      } else {
        vencedor = reiv
      }
      db.prepare('UPDATE partidas SET reivindicador_id = NULL, reivindicacao_turno = NULL WHERE id = ?').run(p.id)
    } else if (!reiv) {
      const candidatos: Linha[] = []
      for (const j of jogadores) {
        if (!ordens.get(j.id)?.reivindicar) continue
        if (t < R.TURNO_REIVINDICAR || j.bloqueado_ate >= t) {
          aviso(j.id, 'Você ainda não pode reivindicar neste turno.')
          continue
        }
        if ((contagem.get(j.id) ?? 0) < R.MARCOS_PARA_REIVINDICAR) {
          aviso(j.id, 'Reivindicação não aberta: os 3 marcos não estavam cumpridos no fim do turno.')
          continue
        }
        candidatos.push(j)
      }
      // Vale quem completou os 3 marcos primeiro; se foi no mesmo turno, decide o sorteio da semente da partida.
      const dado = new Map(candidatos.map((j) => [j.id, rng()]))
      candidatos.sort((a, b) => a.marcos_max_turno - b.marcos_max_turno || dado.get(a.id)! - dado.get(b.id)!)
      const [primeiro, ...demais] = candidatos
      if (primeiro) {
        db.prepare('UPDATE partidas SET reivindicador_id = ?, reivindicacao_turno = ? WHERE id = ?').run(primeiro.id, t, p.id)
        publico.push({ tipo: 'manchete', texto: `${primeiro.rotulo} reivindica o título. Os demais têm um turno para derrubar a reivindicação.` })
        for (const j of demais) aviso(j.id, 'Outro jogador completou os 3 marcos antes de você e reivindicou primeiro.')
      }
    }

    // 10. Fim da partida (vitória por reivindicação ou turno 12). Sem nenhum marco, termina sem vencedor.
    let encerrada = false
    const reivNovo = db.prepare('SELECT reivindicador_id FROM partidas WHERE id = ?').get(p.id) as { reivindicador_id: number | null }
    if (!vencedor && t >= R.TURNO_FIM) {
      encerrada = true
      if (reivNovo.reivindicador_id && (contagem.get(reivNovo.reivindicador_id) ?? 0) >= R.MARCOS_PARA_REIVINDICAR) {
        vencedor = reivNovo.reivindicador_id
      } else {
        const ranking = [...jogadores].sort(
          (a, b) => (contagem.get(b.id) ?? 0) - (contagem.get(a.id) ?? 0) || a.marcos_max_turno - b.marcos_max_turno || a.id - b.id,
        )
        if ((contagem.get(ranking[0].id) ?? 0) > 0) vencedor = ranking[0].id
      }
    }
    if (vencedor) encerrada = true
    if (encerrada) {
      db.prepare("UPDATE partidas SET vencedor_id = ?, status = 'fim' WHERE id = ?").run(vencedor, p.id)
      const fim = vencedor ? `${nomes.get(vencedor)} venceu a partida.` : 'A partida terminou sem vencedor: ninguém cumpriu um marco.'
      publico.push({ tipo: 'manchete', texto: fim })
      for (const j of jogadores) aviso(j.id, `A partida acabou: ${fim}`)
    }

    // 11. Gravação.
    for (const j of jogadores) {
      db.prepare(
        'UPDATE jogadores SET caixa = ?, prestigio = ?, estoque = ?, marcos_max = ?, marcos_max_turno = ?, bloqueado_ate = ?, sinal = ?, secretas = ?, divida = ?, taxa_divida = ?, credor_id = ? WHERE id = ?',
      ).run(j.caixa, j.prestigio, j.estoque, j.marcos_max, j.marcos_max_turno, j.bloqueado_ate, j.sinal, j.secretas, j.divida, j.taxa_divida, j.credor?.id ?? null, j.id)
      const linhas = privado.get(j.id) ?? []
      linhas.unshift(`Turno ${t}: ${contagem.get(j.id) ?? 0} de 3 marcos cumpridos. Caixa ${j.caixa.toFixed(2).replace('.', ',')}₵.`)
      for (const texto of linhas) db.prepare('INSERT INTO caixa (jogador_id, texto) VALUES (?, ?)').run(j.id, texto)
    }
    db.prepare('UPDATE partidas SET preco = ?, relogio = ? WHERE id = ?').run(preco, t, p.id)
    for (const g of publico) {
      db.prepare('INSERT INTO gazeta (partida_id, turno, tipo, texto, alvo_id) VALUES (?, ?, ?, ?, ?)').run(p.id, t, g.tipo, g.texto, g.alvo ?? null)
    }

    if (!encerrada) {
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
    j.caixa = cent(j.caixa - R.CUSTO_SERINGAL)
    const slot = seringais.length
    const id = Number(db.prepare('INSERT INTO seringais (partida_id, dono_id, slot) VALUES (?, ?, ?)').run(p.id, j.id, slot).lastInsertRowid)
    seringais.push({ id, dono_id: j.id })
    aviso(j.id, 'Comprou um seringal. Ele produz a partir do próximo turno.')
  }
  if (a.tipo === 'doar') {
    if (j.caixa < R.CUSTO_DOAR || j.prestigio >= R.PRESTIGIO_MAX) return aviso(j.id, 'Doação não feita: sem caixa ou prestígio no limite.')
    j.caixa = cent(j.caixa - R.CUSTO_DOAR)
    j.prestigio += 1
    aviso(j.id, 'Doação feita: +1★.')
  }
  if (a.tipo === 'visitar' && typeof a.alvo === 'string' && a.metodo) {
    const m = R.METODOS[a.metodo]
    if (j.caixa < m.custo) return aviso(j.id, 'Sem caixa para essa visita.')
    j.caixa = cent(j.caixa - m.custo)
    const npc = R.NPCS.find((n) => n.id === a.alvo)!
    const [pNada, pBoato, pIndicio] = m.chances
    const r = rng()
    const resultado = r < pNada ? 0 : r < pNada + pBoato ? 1 : r < pNada + pBoato + pIndicio ? 2 : 3
    const rel = db.prepare('SELECT valor FROM relacoes WHERE jogador_id = ? AND npc = ?').get(j.id, npc.id) as { valor: number } | undefined
    const novo = Math.max(0, Math.min(5, (rel?.valor ?? 0) + m.relacao))
    db.prepare('INSERT INTO relacoes (jogador_id, npc, valor) VALUES (?, ?, ?) ON CONFLICT(jogador_id, npc) DO UPDATE SET valor = excluded.valor').run(j.id, npc.id, novo)
    const outros = jogadores.filter((x) => x.id !== j.id)
    publico.push({ tipo: 'registro', texto: `${j.rotulo} visitou ${npc.nome}.`, alvo: j.id })
    if (resultado === 0) return aviso(j.id, `${npc.nome}: nada de útil.`)
    const alvo = outros[Math.floor(rng() * outros.length)]
    const nivel = R.NIVEIS[resultado - 1]
    db.prepare('INSERT INTO pistas (partida_id, jogador_id, alvo_id, nivel, fonte, turno) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, j.id, alvo.id, nivel, npc.nome, t,
    )
    aviso(j.id, `${npc.nome} deixou uma pista (${nivel}) sobre ${alvo.rotulo}.`)
  }
  if (a.tipo === 'denunciar' && typeof a.alvo === 'number') {
    const prova = db
      .prepare("SELECT id FROM pistas WHERE partida_id = ? AND jogador_id = ? AND alvo_id = ? AND nivel = 'prova' ORDER BY id LIMIT 1")
      .get(p.id, j.id, a.alvo) as { id: number } | undefined
    if (!prova) return aviso(j.id, 'Denúncia sem prova não vai a lugar nenhum.')
    db.prepare('DELETE FROM pistas WHERE id = ?').run(prova.id) // cada prova sustenta uma denúncia só
    const alvo = jogadores.find((x) => x.id === a.alvo)!
    alvo.prestigio = Math.max(0, alvo.prestigio - 2)
    denunciados.add(alvo.id)
    publico.push({ tipo: 'manchete', texto: `Denúncia com prova no Cartório contra ${alvo.rotulo}.`, alvo: alvo.id })
    aviso(j.id, `Denúncia enviada contra ${alvo.rotulo}.`)
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
  const custo = R.CUSTO_SECRETA[s.tipo]
  if (j.caixa < custo) return aviso(j.id, 'Sem caixa para a ação secreta.')
  j.caixa = cent(j.caixa - custo)
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
    publico.push({ tipo: 'boato', texto: `Corre um boato sobre ${alvo.rotulo}.`, alvo: alvo.id })
    if (rng() < 0.5) alvo.prestigio = Math.max(0, alvo.prestigio - 1)
    aviso(j.id, `Boato plantado sobre ${alvo.rotulo}.`)
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
    if (!visita) return aviso(j.id, `Telégrafo: nada sobre ${alvo.rotulo}.`)
    db.prepare("INSERT INTO pistas (partida_id, jogador_id, alvo_id, nivel, fonte, turno) VALUES (?, ?, ?, 'indicio', 'Telégrafo', ?)").run(
      p.id, j.id, alvo.id, t,
    )
    aviso(j.id, `Telégrafo: ${visita.texto}`)
  }
  if (s.tipo === 'contrabandear') {
    const q = Math.min(s.quantidade ?? 0, j.estoque)
    if (q > 0) {
      const ganho = Math.round(q * R.PRECO_EXPORTADOR * preco * 100) / 100
      j.caixa = cent(j.caixa + ganho)
      j.estoque -= q
      aviso(j.id, `Contrabando: ${q} lotes vendidos por ${ganho}₵.`)
      if (rng() < 0.5) publico.push({ tipo: 'nota', texto: 'Contrabando no porto. Ninguém sabe de quem é a carga.' })
    }
  }
}

