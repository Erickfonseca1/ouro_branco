'use client'

import { useState } from 'react'
import { DICAS, type ChaveDica } from '@/lib/ajuda'

// Dicas dispensadas nesta aba, para não reaparecerem ao trocar de opção antes de recarregar.
const dispensadas = new Set<string>()

export function marcarVista(chave: string) {
  dispensadas.add(chave)
  fetch('/api/dicas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave }) }).catch(() => {})
}

// Dica da primeira vez que o jogador usa uma ação. Some quando ele toca em "Entendi".
export default function Dica({ chave, vistas }: { chave: ChaveDica; vistas: string[] }) {
  const [oculta, setOculta] = useState(() => vistas.includes(chave) || dispensadas.has(chave))
  if (oculta) return null
  const { titulo, texto } = DICAS[chave]
  return (
    <aside className="dica" aria-label={`Dica: ${titulo}`}>
      <p><strong>{titulo}.</strong> {texto}</p>
      <button
        type="button"
        className="botao pequeno contorno"
        onClick={() => {
          marcarVista(chave)
          setOculta(true)
        }}
      >
        Entendi
      </button>
    </aside>
  )
}
