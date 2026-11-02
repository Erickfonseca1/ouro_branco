import { NextResponse } from 'next/server'
import { jogadorAtual } from '@/lib/sessao'
import { votar } from '@/lib/votos'

// Voto (ou retirada do voto) para adiantar o fechamento do turno. Com todos os votos, o turno fecha.
export async function POST(req: Request) {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  const corpo = (await req.json().catch(() => null)) as { votar?: unknown } | null
  const quer = corpo?.votar !== false // sem corpo, vale como voto
  try {
    const r = votar(jogador.partida_id, jogador.id, quer)
    if ('erro' in r) return NextResponse.json({ erro: r.erro }, { status: 409 })
    return NextResponse.json(r)
  } catch (erro) {
    console.error('Falha ao votar pelo fechamento do turno', erro)
    return NextResponse.json({ erro: 'Não foi possível registrar o voto.' }, { status: 500 })
  }
}
