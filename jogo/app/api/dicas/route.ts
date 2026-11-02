import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { CHAVES_VALIDAS } from '@/lib/ajuda'

// Marca uma dica ou um tutorial de turno como visto por este jogador, em qualquer aparelho.
export async function POST(req: Request) {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  const corpo = (await req.json().catch(() => null)) as { chave?: unknown } | null
  const chave = corpo?.chave
  if (typeof chave !== 'string' || !CHAVES_VALIDAS.has(chave)) return NextResponse.json({ erro: 'Dica desconhecida.' }, { status: 400 })
  db.prepare('INSERT OR IGNORE INTO dicas (jogador_id, chave) VALUES (?, ?)').run(jogador.id, chave)
  return NextResponse.json({ ok: true })
}
