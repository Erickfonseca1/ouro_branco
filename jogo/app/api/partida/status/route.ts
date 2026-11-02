import { NextResponse } from 'next/server'
import { db, type Partida } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { resolverDevidos } from '@/lib/motor'

// Estado mínimo do turno, para a contagem regressiva e para detectar o fechamento (também o antecipado).
// Se o prazo venceu, esta chamada já fecha o turno.
export async function GET() {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  resolverDevidos(jogador.partida_id)
  const p = db.prepare('SELECT turno, prazo, status FROM partidas WHERE id = ?').get(jogador.partida_id) as Pick<Partida, 'turno' | 'prazo' | 'status'>
  return NextResponse.json({ turno: p.turno, prazo: p.prazo, status: p.status, agora: Date.now() }, { headers: { 'Cache-Control': 'no-store' } })
}
