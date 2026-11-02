import { NextResponse } from 'next/server'
import { db, type Jogador, type Partida } from '@/lib/db'
import { COOKIE, entrar, telefone } from '@/lib/sessao'
import { bloqueado, registrarFalha } from '@/lib/limite'

// Entrada sem senha: código da partida + telefone cadastrado por quem criou.
export async function POST(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local'
  if (bloqueado(`ip:${ip}`)) return NextResponse.json({ erro: 'Muitas tentativas. Espere alguns minutos.' }, { status: 429 })
  const corpo = (await req.json().catch(() => null)) as { codigo?: string; telefone?: string } | null
  const codigo = corpo?.codigo?.trim().toUpperCase() ?? ''
  const tel = telefone(corpo?.telefone ?? '')
  if (!codigo || !tel) return NextResponse.json({ erro: 'Informe o código e o telefone.' }, { status: 400 })
  // Também bloqueia por código, para quem tenta adivinhar telefones de uma partida a partir de vários IPs.
  if (bloqueado(`codigo:${codigo}`)) return NextResponse.json({ erro: 'Muitas tentativas. Espere alguns minutos.' }, { status: 429 })
  const falhou = () => {
    registrarFalha(`ip:${ip}`)
    registrarFalha(`codigo:${codigo}`)
  }

  const partida = db.prepare('SELECT id, codigo, tamanho FROM partidas WHERE codigo = ?').get(codigo) as Partida | undefined
  if (!partida) {
    falhou()
    return NextResponse.json({ erro: 'Não encontramos essa partida.' }, { status: 404 })
  }

  const jogador = db
    .prepare('SELECT * FROM jogadores WHERE partida_id = ? AND telefone = ?')
    .get(partida.id, tel) as Jogador | undefined
  if (!jogador) {
    falhou()
    return NextResponse.json({ erro: 'Esse telefone não está nesta partida.' }, { status: 404 })
  }

  const token = entrar(jogador, partida)
  // destino: depois do onboarding, o jogo abre na Gazeta
  const res = NextResponse.json({ destino: jogador.bem_vindo ? '/gazeta' : '/bem-vindo' })
  const https = req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:'
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: https, path: '/', maxAge: 60 * 60 * 24 * 90 })
  return res
}
