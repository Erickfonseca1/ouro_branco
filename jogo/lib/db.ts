import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const globalDb = globalThis as unknown as { __ouro?: DatabaseSync }

// Esquema em SQL simples, portável para Postgres/Supabase depois.
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
      semente INTEGER NOT NULL,
      turno INTEGER NOT NULL DEFAULT 1,
      prazo TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      reivindicador_id INTEGER,
      reivindicacao_turno INTEGER,
      vencedor_id INTEGER,
      preco REAL,
      relogio INTEGER NOT NULL DEFAULT 0,
      criada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS jogadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      criador INTEGER NOT NULL DEFAULT 0,
      papel INTEGER,
      variante TEXT,
      token TEXT UNIQUE,
      bem_vindo INTEGER NOT NULL DEFAULT 0,
      caixa REAL NOT NULL DEFAULT 0,
      prestigio INTEGER NOT NULL DEFAULT 0,
      estoque INTEGER NOT NULL DEFAULT 0,
      marcos_max INTEGER NOT NULL DEFAULT 0,
      marcos_max_turno INTEGER NOT NULL DEFAULT 0,
      bloqueado_ate INTEGER NOT NULL DEFAULT 0,
      sinal INTEGER NOT NULL DEFAULT 0,
      secretas INTEGER NOT NULL DEFAULT 0,
      UNIQUE (partida_id, telefone)
    );
    CREATE TABLE IF NOT EXISTS seringais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      dono_id INTEGER REFERENCES jogadores(id),
      slot INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS relacoes (
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      npc TEXT NOT NULL,
      valor INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (jogador_id, npc)
    );
    CREATE TABLE IF NOT EXISTS pistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      alvo_id INTEGER NOT NULL REFERENCES jogadores(id),
      nivel TEXT NOT NULL,
      fonte TEXT NOT NULL,
      turno INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contratos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      de_id INTEGER NOT NULL REFERENCES jogadores(id),
      para_id INTEGER NOT NULL REFERENCES jogadores(id),
      valor INTEGER NOT NULL,
      turnos INTEGER NOT NULL,
      status TEXT NOT NULL,
      turno_proposta INTEGER NOT NULL,
      turno_inicio INTEGER
    );
    CREATE TABLE IF NOT EXISTS ordens (
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
      turno INTEGER NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (partida_id, jogador_id, turno)
    );
    CREATE TABLE IF NOT EXISTS gazeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      turno INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      alvo_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS bifurcacoes (
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      codigo TEXT NOT NULL,
      desfecho TEXT NOT NULL,
      turno INTEGER NOT NULL,
      PRIMARY KEY (partida_id, codigo)
    );
    CREATE TABLE IF NOT EXISTS historico (
      partida_id INTEGER NOT NULL REFERENCES partidas(id),
      turno INTEGER NOT NULL,
      preco REAL NOT NULL,
      vendido INTEGER NOT NULL,
      demanda INTEGER NOT NULL,
      PRIMARY KEY (partida_id, turno)
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

export type Partida = {
  id: number
  codigo: string
  tamanho: number
  semente: number
  turno: number
  prazo: string
  status: string
  reivindicador_id: number | null
  reivindicacao_turno: number | null
  vencedor_id: number | null
  preco: number | null
  relogio: number
}

export type Jogador = {
  id: number
  partida_id: number
  nome: string
  telefone: string
  criador: number
  papel: number | null
  variante: string | null
  token: string | null
  bem_vindo: number
  caixa: number
  prestigio: number
  estoque: number
  marcos_max: number
  marcos_max_turno: number
  bloqueado_ate: number
  sinal: number
  secretas: number
}

export type Mensagem = { id: number; texto: string; lida: number; criada_em: string }
