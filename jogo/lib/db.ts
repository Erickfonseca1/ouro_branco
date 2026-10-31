import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const globalDb = globalThis as unknown as { __ouro?: DatabaseSync }

function abrir(): DatabaseSync {
  const dir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(path.join(dir, 'ouro.db'))
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      tamanho INTEGER NOT NULL,
      criada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS jogadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      criador INTEGER NOT NULL DEFAULT 0,
      papel INTEGER,
      token TEXT UNIQUE,
      bem_vindo INTEGER NOT NULL DEFAULT 0,
      UNIQUE (partida_id, telefone)
    );
    CREATE TABLE IF NOT EXISTS caixa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      texto TEXT NOT NULL,
      lida INTEGER NOT NULL DEFAULT 0,
      criada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return db
}

// Uma conexão só, mesmo com o hot reload do Next.
export const db = globalDb.__ouro ?? (globalDb.__ouro = abrir())

export type Partida = { id: number; codigo: string; tamanho: number }
export type Jogador = {
  id: number
  partida_id: number
  nome: string
  telefone: string
  criador: number
  papel: number | null
  token: string | null
  bem_vindo: number
}
export type Mensagem = { id: number; texto: string; lida: number; criada_em: string }
