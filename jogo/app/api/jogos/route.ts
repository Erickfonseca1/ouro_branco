import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { novoCodigo, telefone } from '@/lib/sessao'
import { proximoPrazo } from '@/lib/tempo'
import * as R from '@/lib/regras'
import { randomInt } from 'node:crypto'

type Participante = { nome?: string; telefone?: string; criador?: boolean }

// Cria a partida com a lista de participantes. Não há login: quem entra depois usa o código e o telefone.
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { participantes?: Participante[] } | null
  const erro = (mensagem: string) => NextResponse.json({ erro: mensagem }, { status: 400 })

  const lista = corpo?.participantes
  if (!Array.isArray(lista) || lista.length < 4 || lista.length > 14) return erro('A partida tem de 4 a 14 jogadores.')

  const linhas: { nome: string; telefone: string; criador: number }[] = []
  for (const p of lista) {
    if (typeof p !== 'object' || p === null) return erro('Lista de jogadores inválida.')
    const nome = typeof p.nome === 'string' ? p.nome.trim() : ''
    const tel = telefone(typeof p.telefone === 'string' ? p.telefone : '')
    if (!nome) return erro('Preencha o nome de todos os jogadores.')
    if (nome.length > 40) return erro('Nome com mais de 40 letras.')
    if (!tel) return erro(`Telefone inválido para ${nome}. Use DDD + número.`)
    linhas.push({ nome, telefone: tel, criador: p.criador === true ? 1 : 0 })
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
    for (const l of linhas) inserir.run(partidaId, l.nome, l.telefone, l.criador)
    // Seringais do sistema. Os dos jogadores são criados quando cada um recebe o papel (lib/sessao.ts).
    const sistema = db.prepare('INSERT INTO seringais (partida_id, dono_id, slot) VALUES (?, NULL, ?)')
    for (let i = 0; i < R.SERINGAIS_SISTEMA; i++) sistema.run(partidaId, i)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return NextResponse.json({ codigo })
}
