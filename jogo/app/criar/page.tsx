'use client'

import Link from 'next/link'
import { useState } from 'react'

type Linha = { nome: string; telefone: string }

const MIN = 4
const MAX = 14

export default function Criar() {
  const [linhas, setLinhas] = useState<Linha[]>(Array.from({ length: MIN }, () => ({ nome: '', telefone: '' })))
  const [criador, setCriador] = useState(0)
  const [erro, setErro] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)

  function atualizar(i: number, campo: keyof Linha, valor: string) {
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))
  }

  function remover(i: number) {
    setLinhas((atual) => atual.filter((_, j) => j !== i))
    setCriador((c) => (c === i ? 0 : c > i ? c - 1 : c))
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const res = await fetch('/api/jogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantes: linhas.map((l, i) => ({ ...l, criador: i === criador })),
      }),
    })
    const dados = await res.json()
    setEnviando(false)
    if (!res.ok) return setErro(dados.erro)
    setCodigo(dados.codigo)
  }

  if (codigo) {
    return (
      <main className="tela">
        <header className="topo"><Link href="/">Ouro Branco</Link><span>Partida criada</span></header>
        <h1 className="titulo">Partida criada</h1>
        <p className="ajuda">Passe este código para os jogadores. Cada um entra com o código e o próprio telefone.</p>
        <div className="codigo-grande" aria-label={`Código ${codigo.split('').join(' ')}`}>{codigo}</div>
        <Link href={`/entrar?codigo=${codigo}`} className="botao acento">Entrar como {linhas[criador].nome || 'criador'}</Link>
      </main>
    )
  }

  return (
    <main className="tela">
      <header className="topo"><Link href="/">Ouro Branco</Link><span>{linhas.length} de {MAX}</span></header>
      <h1 className="titulo">Quem joga</h1>
      <p className="ajuda">Nome e telefone de cada um. Marque quem cria a partida. Mínimo de {MIN} jogadores.</p>

      <form onSubmit={enviar}>
        {linhas.map((l, i) => (
          <div className="linha-participante" key={i}>
            <div className="campo" style={{ margin: 0 }}>
              <label htmlFor={`nome-${i}`}>Nome</label>
              <input id={`nome-${i}`} type="text" value={l.nome} maxLength={40} required onChange={(e) => atualizar(i, 'nome', e.target.value)} />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label htmlFor={`tel-${i}`}>Telefone</label>
              <input id={`tel-${i}`} type="tel" inputMode="tel" value={l.telefone} required placeholder="92 99999-0000" onChange={(e) => atualizar(i, 'telefone', e.target.value)} />
            </div>
            {linhas.length > MIN ? (
              <button type="button" className="remover" onClick={() => remover(i)} aria-label={`Remover ${l.nome || `jogador ${i + 1}`}`}>Remover</button>
            ) : <span />}
            <label className="criador-marca">
              <input type="radio" name="criador" checked={criador === i} onChange={() => setCriador(i)} /> criador da partida
            </label>
          </div>
        ))}

        {linhas.length < MAX && (
          <button type="button" className="botao contorno" style={{ marginTop: 'var(--space-md)' }} onClick={() => setLinhas((a) => [...a, { nome: '', telefone: '' }])}>
            Adicionar jogador
          </button>
        )}

        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" className="botao acento" style={{ marginTop: 'var(--space-lg)' }} disabled={enviando}>
          {enviando ? 'Criando...' : 'Criar partida'}
        </button>
      </form>
    </main>
  )
}
