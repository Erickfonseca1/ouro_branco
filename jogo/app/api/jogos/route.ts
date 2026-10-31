import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { novoCodigo, telefone } from '@/lib/sessao'
import { proximoPrazo } from '@/lib/tempo'
import { randomInt } from 'node:crypto'

type Participante = { nome?: string; telefone?: string; criador?: boolean }

// Cria a partida com a lista de participantes. Não há login: quem entra depois usa o código e o telefone.
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { participantes?: Participante[] } | null
  const erro = (mensagem: string) => NextResponse.json({ erro: mensagem }, { status: 400 })

  const lista = corpo?.participantes ?? []
  if (lista.length < 4 || lista.length > 14) return erro('A partida tem de 4 a 14 jogadores.')

  const linhas: { nome: string; telefone: string; criador: number }[] = []
  for (const p of lista) {
    const nome = p.nome?.trim() ?? ''
    const tel = telefone(p.telefone ?? '')
    if (!nome) return erro('Preencha o nome de todos os jogadores.')
    if (!tel) return erro(`Telefone inválido para ${nome}. Use DDD + número.`)
    linhas.push({ nome, telefone: tel, criador: p.criador ? 1 : 0 })
  }
  if (linhas.filter((l) => l.criador).length !== 1) return erro('Marque quem cria a partida.')
  if (new Set(linhas.map((l) => l.telefone)).size !== linhas.length) return erro('Há telefones repetidos.')

  const codigo = novoCodigo()
  db.exec('BEGIN')
  try {
    const partidaId = Number(
      db
        .prepare('INSERT INTO partidas (codigo, tamanho, semente, prazo) VALUES (?, ?, ?, ?)')
        .run(codigo, linhas.length, randomInt(2 ** 31), proximoPrazo().toISOString()).lastInsertRowid,
    )
    const inserir = db.prepare('INSERT INTO jogadores (partida_id, nome, telefone, criador) VALUES (?, ?, ?, ?)')
    const donos: number[] = []
    for (const l of linhas) donos.push(Number(inserir.run(partidaId, l.nome, l.telefone, l.criador).lastInsertRowid))
    // Um seringal inicial por jogador, mais dois do sistema (04, seção 6).
    const seringal = db.prepare('INSERT INTO seringais (partida_id, dono_id, slot) VALUES (?, ?, ?)')
    donos.forEach((id, slot) => seringal.run(partidaId, id, slot))
    seringal.run(partidaId, null, donos.length)
    seringal.run(partidaId, null, donos.length + 1)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return NextResponse.json({ codigo })
}
