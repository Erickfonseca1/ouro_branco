import { NextResponse } from 'next/server'
import { jogadorAtual } from '@/lib/sessao'
import { fecharAgora, resolverDevidos } from '@/lib/motor'

// Só o criador da partida pode fechar o turno antes do prazo. O calendário (ter, qui, dom) não muda.
export async function POST() {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })
  if (!jogador.criador) return NextResponse.json({ erro: 'Só quem criou a partida fecha o turno.' }, { status: 403 })
  try {
    resolverDevidos(jogador.partida_id) // se já havia turno vencido, ele fecha primeiro
    fecharAgora(jogador.partida_id)
  } catch (erro) {
    console.error('Falha ao fechar o turno', erro)
    return NextResponse.json({ erro: 'Não foi possível fechar o turno.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
