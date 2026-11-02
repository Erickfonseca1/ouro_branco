import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { resolverDevidos, sanearOrdens } from '@/lib/motor'

const LIMITE_CORPO = 8_000

// Salva as ordens do turno em aberto. Podem ser trocadas até o prazo.
export async function POST(req: Request) {
  const jogador = await jogadorAtual()
  if (!jogador) return NextResponse.json({ erro: 'Entre na partida primeiro.' }, { status: 401 })

  const texto = await req.text()
  if (texto.length > LIMITE_CORPO) return NextResponse.json({ erro: 'Ordens grandes demais.' }, { status: 413 })
  let corpo: unknown
  try {
    corpo = JSON.parse(texto)
  } catch {
    return NextResponse.json({ erro: 'Ordens inválidas.' }, { status: 400 })
  }
  const { turno: turnoVisto, ...ordensBrutas } = (corpo ?? {}) as Record<string, unknown>

  resolverDevidos(jogador.partida_id)
  const atual = db.prepare('SELECT turno, status FROM partidas WHERE id = ?').get(jogador.partida_id) as { turno: number; status: string }
  if (atual.status !== 'aberto') return NextResponse.json({ erro: 'A partida já acabou.' }, { status: 409 })
  // O turno que o jogador estava vendo fechou antes de ele enviar: as ordens não valem para o turno novo.
  if (typeof turnoVisto === 'number' && turnoVisto !== atual.turno) {
    return NextResponse.json(
      { erro: `O turno ${turnoVisto} fechou antes de você enviar. Revise as ordens do turno ${atual.turno}.`, turno: atual.turno },
      { status: 409 },
    )
  }

  const ids = new Set((db.prepare('SELECT id FROM jogadores WHERE partida_id = ?').all(jogador.partida_id) as { id: number }[]).map((r) => r.id))
  const r = sanearOrdens(ordensBrutas, ids, jogador.id)
  if ('erro' in r) return NextResponse.json({ erro: r.erro }, { status: 400 })

  db.prepare(
    `INSERT INTO ordens (partida_id, jogador_id, turno, payload) VALUES (?, ?, ?, ?)
     ON CONFLICT(partida_id, jogador_id, turno) DO UPDATE SET payload = excluded.payload`,
  ).run(jogador.partida_id, jogador.id, atual.turno, JSON.stringify(r.ordens))
  return NextResponse.json({ ok: true, turno: atual.turno })
}
