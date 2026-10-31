import { NextResponse } from 'next/server'
import { db, type Jogador, type Partida } from '@/lib/db'
import { COOKIE, entrar, telefone } from '@/lib/sessao'

// Entrada sem senha: código da partida + telefone cadastrado por quem criou.
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { codigo?: string; telefone?: string } | null
  const codigo = corpo?.codigo?.trim().toUpperCase() ?? ''
  const tel = telefone(corpo?.telefone ?? '')
  if (!codigo || !tel) return NextResponse.json({ erro: 'Informe o código e o telefone.' }, { status: 400 })

  const partida = db.prepare('SELECT id, codigo, tamanho FROM partidas WHERE codigo = ?').get(codigo) as Partida | undefined
  if (!partida) return NextResponse.json({ erro: 'Não encontramos essa partida.' }, { status: 404 })

  const jogador = db
    .prepare('SELECT * FROM jogadores WHERE partida_id = ? AND telefone = ?')
    .get(partida.id, tel) as Jogador | undefined
  if (!jogador) return NextResponse.json({ erro: 'Esse telefone não está nesta partida.' }, { status: 404 })

  const token = entrar(jogador, partida)
  const res = NextResponse.json({ destino: jogador.bem_vindo ? '/caixa' : '/bem-vindo' })
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 })
  return res
}
