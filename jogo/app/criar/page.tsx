'use client'

import Link from 'next/link'
import { useState } from 'react'
import { digitosTelefone, formatarTelefone, telefoneValido } from '@/lib/telefone'

type Linha = { nome: string; telefone: string }

const MIN = 4
const MAX = 14

export default function Criar() {
  const [linhas, setLinhas] = useState<Linha[]>(Array.from({ length: MIN }, () => ({ nome: '', telefone: '' })))
  const [criador, setCriador] = useState(0)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [codigo, setCodigo] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  function atualizar(i: number, campo: keyof Linha, valor: string) {
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: campo === 'telefone' ? formatarTelefone(valor) : valor } : l)))
    setErros((e) => {
      const { [`${campo}-${i}`]: _, ...resto } = e
      return resto
    })
  }

  function remover(i: number) {
    setLinhas((atual) => atual.filter((_, j) => j !== i))
    setCriador((c) => (c === i ? 0 : c > i ? c - 1 : c))
    setErros({})
  }

  function validar() {
    const e: Record<string, string> = {}
    const vistos = new Map<string, number>()
    linhas.forEach((l, i) => {
      if (!l.nome.trim()) e[`nome-${i}`] = 'Escreva o nome.'
      if (!telefoneValido(l.telefone)) e[`telefone-${i}`] = 'Use DDD + número, como (92) 99999-0000.'
      else {
        const d = digitosTelefone(l.telefone)
        if (vistos.has(d)) e[`telefone-${i}`] = `Mesmo telefone do jogador ${vistos.get(d)! + 1}.`
        else vistos.set(d, i)
      }
    })
    return e
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro('')
    const e = validar()
    setErros(e)
    const primeiro = Object.keys(e)[0]
    if (primeiro) return document.getElementById(primeiro)?.focus()
    setEnviando(true)
    const res = await fetch('/api/jogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantes: linhas.map((l, i) => ({ nome: l.nome.trim(), telefone: l.telefone, criador: i === criador })) }),
    })
    const dados = await res.json()
    setEnviando(false)
    if (!res.ok) return setErro(dados.erro)
    setCodigo(dados.codigo)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  if (codigo) {
    return (
      <main className="tela">
        <header className="topo"><Link href="/" className="marca">Ouro Branco</Link><span className="mono">Partida criada</span></header>
        <h1 className="titulo">Partida criada</h1>
        <p className="ajuda">Mande este código no grupo. Cada um entra com o código e o próprio telefone.</p>
        <div className="codigo-grande" aria-label={`Código ${codigo.split('').join(' ')}`}>{codigo}</div>
        <button type="button" className="botao contorno" onClick={copiar}>{copiado ? 'Código copiado' : 'Copiar código'}</button>
        <Link href={`/entrar?codigo=${codigo}`} className="botao acento">Entrar como {linhas[criador].nome || 'criador'}</Link>
      </main>
    )
  }

  return (
    <main className="tela">
      <header className="topo"><Link href="/" className="marca">Ouro Branco</Link><span className="mono">{linhas.length} de {MAX}</span></header>
      <h1 className="titulo">Quem joga</h1>
      <p className="ajuda">Nome e telefone de cada jogador, de {MIN} a {MAX}. Cada um vai entrar com o próprio telefone. Marque quem cria a partida: só essa pessoa pode fechar o turno antes do prazo.</p>

      <form onSubmit={enviar} noValidate>
        <ol className="participantes">
          {linhas.map((l, i) => (
            <li key={i} className={`participante${criador === i ? ' eh-criador' : ''}`}>
              <div className="participante-topo">
                <span className="rotulo-campo">Jogador {i + 1}</span>
                {criador === i && <span className="selo-criador">Criador</span>}
                {linhas.length > MIN && (
                  <button type="button" className="remover" onClick={() => remover(i)} aria-label={`Remover ${l.nome || `jogador ${i + 1}`}`}>Remover</button>
                )}
              </div>
              <label className="campo">
                <span>Nome</span>
                <input
                  id={`nome-${i}`}
                  type="text"
                  value={l.nome}
                  maxLength={40}
                  autoComplete="off"
                  aria-invalid={!!erros[`nome-${i}`]}
                  aria-describedby={erros[`nome-${i}`] ? `nome-${i}-erro` : undefined}
                  onChange={(e) => atualizar(i, 'nome', e.target.value)}
                />
              </label>
              {erros[`nome-${i}`] && <p id={`nome-${i}-erro`} className="campo-erro">{erros[`nome-${i}`]}</p>}
              <label className="campo">
                <span>Telefone</span>
                <input
                  id={`telefone-${i}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(92) 99999-0000"
                  value={l.telefone}
                  aria-invalid={!!erros[`telefone-${i}`]}
                  aria-describedby={erros[`telefone-${i}`] ? `telefone-${i}-erro` : undefined}
                  onChange={(e) => atualizar(i, 'telefone', e.target.value)}
                />
              </label>
              {erros[`telefone-${i}`] && <p id={`telefone-${i}-erro`} className="campo-erro">{erros[`telefone-${i}`]}</p>}
              <label className="interruptor">
                <input type="radio" name="criador" checked={criador === i} onChange={() => setCriador(i)} />
                <span>Quem cria a partida</span>
              </label>
            </li>
          ))}
        </ol>

        {linhas.length < MAX && (
          <button type="button" className="botao contorno" onClick={() => setLinhas((a) => [...a, { nome: '', telefone: '' }])}>
            Adicionar jogador
          </button>
        )}

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="barra-salvar">
          <span className="estado-salvo">{linhas.length} jogadores</span>
          <button type="submit" className="botao acento" disabled={enviando}>{enviando ? 'Criando…' : 'Criar partida'}</button>
        </div>
      </form>
    </main>
  )
}
