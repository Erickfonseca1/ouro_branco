import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { resolverDevidos } from '@/lib/motor'

// Só o criador da partida pode fechar o turno antes do prazo.
export async function POST() {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  if (!jogador.criador) return NextResponse.json({ erro: 'Só quem criou a partida fecha o turno.' }, { status: 403 })
  db.prepare("UPDATE partidas SET prazo = ? WHERE id = ? AND status = 'aberto'").run(new Date(Date.now() - 60_000).toISOString(), jogador.partida_id)
  resolverDevidos(jogador.partida_id)
  return NextResponse.json({ ok: true })
}
