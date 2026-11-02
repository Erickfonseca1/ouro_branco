'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { formatarTelefone, telefoneValido } from '@/lib/telefone'

const LETRAS = /[^ABCDEFGHJKMNPQRSTUVWXYZ2-9]/g // o código usa letras e números sem I, L, O, 0 e 1

export default function Entrar() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erros, setErros] = useState<{ codigo?: string; telefone?: string }>({})
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const refTelefone = useRef<HTMLInputElement>(null)

  // Código vindo do link "Entrar como criador": já preenche e leva o foco ao telefone.
  useEffect(() => {
    const c = (new URLSearchParams(window.location.search).get('codigo') ?? '').toUpperCase().replace(LETRAS, '').slice(0, 5)
    if (c) {
      setCodigo(c)
      refTelefone.current?.focus()
    }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const novos: typeof erros = {}
    if (codigo.length !== 5) novos.codigo = 'O código tem 5 letras e números.'
    if (!telefoneValido(telefone)) novos.telefone = 'Use DDD + número, como (92) 99999-0000.'
    setErros(novos)
    if (novos.codigo) return document.getElementById('codigo')?.focus()
    if (novos.telefone) return refTelefone.current?.focus()

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
      <header className="topo"><Link href="/" className="marca">Ouro Branco</Link><span className="mono">Entrar</span></header>
      <h1 className="titulo">Entrar na partida</h1>
      <p className="ajuda">Use o código que o criador mandou no grupo e o telefone que ele cadastrou para você. Não há senha.</p>

      <form onSubmit={enviar} noValidate>
        <label className="campo">
          <span>Código da partida</span>
          <input
            id="codigo"
            type="text"
            className="codigo"
            value={codigo}
            maxLength={5}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={!!erros.codigo}
            aria-describedby={erros.codigo ? 'codigo-erro' : 'codigo-ajuda'}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(LETRAS, '').slice(0, 5))}
          />
        </label>
        {erros.codigo ? <p id="codigo-erro" className="campo-erro">{erros.codigo}</p> : <p id="codigo-ajuda" className="ajuda">5 letras e números, como K7QXM.</p>}

        <label className="campo">
          <span>Seu telefone</span>
          <input
            ref={refTelefone}
            id="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            enterKeyHint="go"
            placeholder="(92) 99999-0000"
            value={telefone}
            aria-invalid={!!erros.telefone}
            aria-describedby={erros.telefone ? 'telefone-erro' : undefined}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
          />
        </label>
        {erros.telefone && <p id="telefone-erro" className="campo-erro">{erros.telefone}</p>}

        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" className="botao acento" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
