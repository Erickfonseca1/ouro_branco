'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Entrar() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Código vindo do link "Entrar como criador".
  useEffect(() => {
    setCodigo(new URLSearchParams(window.location.search).get('codigo') ?? '')
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const res = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, telefone }),
    })
    const dados = await res.json()
    if (!res.ok) {
      setEnviando(false)
      return setErro(dados.erro)
    }
    router.push(dados.destino)
  }

  return (
    <main className="tela">
      <header className="topo"><Link href="/">Ouro Branco</Link><span>Entrar</span></header>
      <h1 className="titulo">Entrar na partida</h1>
      <p className="ajuda">Use o código que o criador passou e o telefone que ele cadastrou para você.</p>

      <form onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="codigo">Código da partida</label>
          <input id="codigo" type="text" className="codigo" value={codigo} maxLength={5} autoCapitalize="characters" autoComplete="off" required onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        </div>
        <div className="campo">
          <label htmlFor="telefone">Seu telefone</label>
          <input id="telefone" type="tel" inputMode="tel" value={telefone} required placeholder="92 99999-0000" onChange={(e) => setTelefone(e.target.value)} />
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" className="botao acento" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
