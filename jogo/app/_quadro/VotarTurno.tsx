'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Votos = { atuais: number; total: number; eu: boolean }

// Botão de votar para adiantar o próximo turno. Com todos os votos, o turno fecha e o seguinte abre.
export default function VotarTurno({ votos }: { votos: Votos }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  async function alternar() {
    setErro('')
    setAviso('')
    setEnviando(true)
    const res = await fetch('/api/partida/votar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votar: !votos.eu }),
    })
    const dados = await res.json()
    setEnviando(false)
    if (!res.ok) return setErro(dados.erro)
    if (dados.fechou) setAviso('Todos votaram. O próximo turno abriu.')
    router.refresh()
  }

  return (
    <div className="votar">
      <button type="button" className={votos.eu ? 'botao contorno' : 'botao'} onClick={alternar} disabled={enviando} aria-pressed={votos.eu}>
        {enviando ? 'Enviando...' : votos.eu ? 'Retirar meu voto' : 'Votar para adiantar o próximo turno'}
      </button>
      <p className="ajuda" role="status">
        {`${votos.atuais} de ${votos.total} votaram. Se todos votarem, o turno fecha agora. Quem não enviou ordens joga com a ordem padrão.`}
      </p>
      {aviso && <p role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  )
}
