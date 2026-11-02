import { cookies } from 'next/headers'
import { randomBytes, randomInt } from 'node:crypto'
import { db, type Jogador, type Partida } from './db'
import { PAPEIS } from './papeis'
import { ECONOMIA_PAPEL, CHAVE_PAPEL, variantesDoPapel } from './objetivos'

export const COOKIE = 'ouro_sessao'
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem I, L, O, 0, 1

// Telefone só com dígitos. Aceita DDD + número (10 ou 11 dígitos), com ou sem +55.
export function telefone(bruto: string) {
  let digitos = bruto.replace(/\D/g, '')
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2)
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
function sortearPapel(partidaId: number, tamanho: number): number {
  const usados = new Set(
    (db.prepare('SELECT papel FROM jogadores WHERE partida_id = ? AND papel IS NOT NULL').all(partidaId) as { papel: number }[]).map((r) => r.papel),
  )
  const livres = PAPEIS.slice(0, tamanho).map((p) => p.id).filter((id) => !usados.has(id))
  return livres[randomInt(livres.length)]
}

// Sorteia papel, variante e estado inicial de quem ainda não tem papel. Chamar dentro de transação.
export function atribuirPapel(jogador: Jogador, partida: Pick<Partida, 'id' | 'tamanho'>) {
  if (jogador.papel !== null) return
  const papel = sortearPapel(partida.id, partida.tamanho)
  const variantes = variantesDoPapel(papel)
  const variante = variantes[randomInt(variantes.length)].id
  const economia = ECONOMIA_PAPEL[CHAVE_PAPEL[papel]] ?? { caixa: 4, prestigio: 2, renda: 0 }
  db.prepare('UPDATE jogadores SET papel = ?, variante = ?, caixa = ?, prestigio = ? WHERE id = ?').run(
    papel,
    variante,
    economia.caixa,
    economia.prestigio,
    jogador.id,
  )
  db.prepare('INSERT INTO caixa (jogador_id, texto) VALUES (?, ?)').run(
    jogador.id,
    'Você entrou na partida. Seu personagem foi sorteado; leia o guia antes do primeiro turno.',
  )
  jogador.papel = papel
}

// Primeiro acesso: sorteia o personagem e cria o token da sessão. Idempotente.
export function entrar(jogador: Jogador, partida: Partida): string {
  db.exec('BEGIN IMMEDIATE')
  try {
    atribuirPapel(jogador, partida)
    const token = jogador.token ?? randomBytes(24).toString('hex')
    db.prepare('UPDATE jogadores SET token = ? WHERE id = ?').run(token, jogador.id)
    db.exec('COMMIT')
    return token
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

export async function jogadorAtual(): Promise<(Jogador & { codigo: string; tamanho: number; turno: number; status: string }) | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return (
    (db
      .prepare(
        `SELECT j.*, p.codigo, p.tamanho, p.turno, p.status FROM jogadores j JOIN partidas p ON p.id = j.partida_id WHERE j.token = ?`,
      )
      .get(token) as (Jogador & { codigo: string; tamanho: number; turno: number; status: string })) ?? null
  )
}
