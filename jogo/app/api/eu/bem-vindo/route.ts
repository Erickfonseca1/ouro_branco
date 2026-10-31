import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'

// Marca o onboarding como feito.
export async function POST() {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  db.prepare('UPDATE jogadores SET bem_vindo = 1 WHERE id = ?').run(jogador.id)
  return NextResponse.json({ ok: true })
}
