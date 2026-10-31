import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { resolverDevidos, validarOrdens, type Ordens } from '@/lib/motor'

// Salva as ordens do turno em aberto. Podem ser trocadas até o prazo.
export async function POST(req: Request) {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  resolverDevidos(jogador.partida_id)
  const atual = db.prepare('SELECT turno, status FROM partidas WHERE id = ?').get(jogador.partida_id) as { turno: number; status: string }
  if (atual.status !== 'aberto') return NextResponse.json({ erro: 'A partida já acabou.' }, { status: 409 })

  const ordens = ((await req.json().catch(() => null)) ?? {}) as Ordens
  const erro = validarOrdens(ordens, jogador.partida_id, jogador.id)
  if (erro) return NextResponse.json({ erro }, { status: 400 })

  db.prepare(
    `INSERT INTO ordens (partida_id, jogador_id, turno, payload) VALUES (?, ?, ?, ?)
     ON CONFLICT(partida_id, jogador_id, turno) DO UPDATE SET payload = excluded.payload`,
  ).run(jogador.partida_id, jogador.id, atual.turno, JSON.stringify(ordens))
  return NextResponse.json({ ok: true })
}
