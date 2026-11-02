// SERVER ONLY. Votação para adiantar o fechamento do turno: se todos os jogadores votarem, o turno fecha na hora.
import { db, type Partida } from './db'
import { fecharAgora, resolverDevidos } from './motor'

export type Votos = { atuais: number; total: number; eu: boolean }

// Os votos pertencem a um turno: quando ele fecha, a contagem do turno seguinte começa zerada.
export function contarVotos(partidaId: number, turno: number, jogadorId: number): Votos {
  const total = (db.prepare('SELECT COUNT(*) AS n FROM jogadores WHERE partida_id = ?').get(partidaId) as { n: number }).n
  const atuais = (db.prepare('SELECT COUNT(*) AS n FROM votos_turno WHERE partida_id = ? AND turno = ?').get(partidaId, turno) as { n: number }).n
  const eu = !!db.prepare('SELECT 1 FROM votos_turno WHERE partida_id = ? AND turno = ? AND jogador_id = ?').get(partidaId, turno, jogadorId)
  return { atuais, total, eu }
}

export function votar(partidaId: number, jogadorId: number, quer: boolean): { erro: string } | { fechou: boolean; votos: Votos } {
  resolverDevidos(partidaId) // se o prazo já venceu, o turno fecha antes e o voto vale para o turno novo
  const p = db.prepare('SELECT * FROM partidas WHERE id = ?').get(partidaId) as Partida
  if (p.status !== 'aberto') return { erro: 'A partida já acabou.' }

  if (quer) {
    db.prepare('INSERT OR IGNORE INTO votos_turno (partida_id, turno, jogador_id) VALUES (?, ?, ?)').run(partidaId, p.turno, jogadorId)
  } else {
    db.prepare('DELETE FROM votos_turno WHERE partida_id = ? AND turno = ? AND jogador_id = ?').run(partidaId, p.turno, jogadorId)
  }

  let votos = contarVotos(partidaId, p.turno, jogadorId)
  if (quer && votos.atuais >= votos.total) {
    fecharAgora(partidaId) // calendário preservado: o próximo prazo é o primeiro depois do prazo original
    const depois = db.prepare('SELECT turno FROM partidas WHERE id = ?').get(partidaId) as { turno: number }
    votos = contarVotos(partidaId, depois.turno, jogadorId)
    return { fechou: true, votos }
  }
  return { fechou: false, votos }
}
