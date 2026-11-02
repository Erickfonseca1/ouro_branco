'use client'

import { useId, useRef } from 'react'
import { AJUDA_PAGINAS, type Pagina } from '@/lib/ajuda'

// Botão "?" com o guia rápido da tela. Usa <dialog>: Esc fecha e o foco volta ao botão.
export default function Ajuda({ pagina }: { pagina: Pagina }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const { titulo, itens } = AJUDA_PAGINAS[pagina]
  return (
    <>
      <button type="button" className="ajuda-botao" aria-label={`Ajuda: ${titulo}`} onClick={() => ref.current?.showModal()}>
        ?
      </button>
      <dialog ref={ref} className="ajuda-folha" aria-labelledby={id} onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <h2 id={id}>{titulo}</h2>
        <ul>
          {itens.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
        <form method="dialog">
          <button type="submit" className="botao">Entendi</button>
        </form>
      </dialog>
    </>
  )
}
