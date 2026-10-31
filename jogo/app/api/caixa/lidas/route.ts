import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'

// Marca as mensagens da caixa de entrada do jogador como lidas.
export async function POST() {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  db.prepare('UPDATE caixa SET lida = 1 WHERE jogador_id = ?').run(jogador.id)
  return NextResponse.json({ ok: true })
}
