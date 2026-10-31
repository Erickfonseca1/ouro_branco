'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Botão do criador: fecha o turno antes do prazo.
export default function Fechar() {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  async function fechar() {
    if (!confirm('Fechar o turno agora? As ordens que faltam saem com a ordem padrão.')) return
    setEnviando(true)
    await fetch('/api/partida/fechar', { method: 'POST' })
    setEnviando(false)
    router.refresh()
  }
  return (
    <button type="button" className="botao contorno" onClick={fechar} disabled={enviando} style={{ marginTop: 'var(--space-lg)' }}>
      {enviando ? 'Fechando...' : 'Fechar turno agora'}
    </button>
  )
}
