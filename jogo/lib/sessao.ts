import { cookies } from 'next/headers'
import { randomBytes, randomInt } from 'node:crypto'
import { db, type Jogador, type Partida } from './db'
import { PAPEIS } from './papeis'

export const COOKIE = 'ouro_sessao'
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem I, L, O, 0, 1

// Telefone só com dígitos. Aceita 10 ou 11 (DDD + número).
export function telefone(bruto: string) {
  const digitos = bruto.replace(/\D/g, '')
  return digitos.length >= 10 && digitos.length <= 11 ? digitos : null
}

export function novoCodigo() {
  for (;;) {
    let codigo = ''
    for (let i = 0; i < 5; i++) codigo += ALFABETO[randomInt(ALFABETO.length)]
    if (!db.prepare('SELECT 1 FROM partidas WHERE codigo = ?').get(codigo)) return codigo
  }
}

// Sorteia um papel ainda livre entre os N primeiros. Chamar dentro de transação.
export function sortearPapel(partidaId: number, tamanho: number): number {
  const usados = new Set(
    (db.prepare('SELECT papel FROM jogadores WHERE partida_id = ? AND papel IS NOT NULL').all(partidaId) as { papel: number }[]).map((r) => r.papel),
  )
  const livres = PAPEIS.slice(0, tamanho).map((p) => p.id).filter((id) => !usados.has(id))
  return livres[randomInt(livres.length)]
}

// Primeiro acesso: sorteia papel e cria o token da sessão. Idempotente.
export function entrar(jogador: Jogador, partida: Partida): string {
  db.exec('BEGIN IMMEDIATE')
  try {
    const atual = db.prepare('SELECT papel, token FROM jogadores WHERE id = ?').get(jogador.id) as { papel: number | null; token: string | null }
    const papel = atual.papel ?? sortearPapel(partida.id, partida.tamanho)
    const token = atual.token ?? randomBytes(24).toString('hex')
    db.prepare('UPDATE jogadores SET papel = ?, token = ? WHERE id = ?').run(papel, token, jogador.id)
    if (atual.papel === null) {
      db.prepare('INSERT INTO caixa (jogador_id, texto) VALUES (?, ?)').run(
        jogador.id,
        'Você entrou na partida. Seu personagem foi sorteado, leia o guia antes do primeiro turno.',
      )
    }
    db.exec('COMMIT')
    return token
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

export async function jogadorAtual(): Promise<(Jogador & { codigo: string; tamanho: number }) | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return (
    (db
      .prepare(
        `SELECT j.*, p.codigo, p.tamanho FROM jogadores j JOIN partidas p ON p.id = j.partida_id WHERE j.token = ?`,
      )
      .get(token) as (Jogador & { codigo: string; tamanho: number })) ?? null
  )
}
