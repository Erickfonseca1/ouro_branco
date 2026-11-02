'use client'

import Link from 'next/link'
import { useState } from 'react'
import { TUTORIAL_TURNOS } from '@/lib/ajuda'
import { marcarVista } from './Dica'

// Tutorial dos primeiros turnos: o que fazer agora, com atalho para cada tela.
export default function TutorialTurno({ turno, visto }: { turno: number; visto: boolean }) {
  const [oculto, setOculto] = useState(visto)
  const tutorial = TUTORIAL_TURNOS[turno]
  if (!tutorial || oculto) return null
  return (
    <section className="tutorial" aria-labelledby="tut-t">
      <h3 id="tut-t">{tutorial.titulo}</h3>
      <ol>
        {tutorial.passos.map((p, i) => (
          <li key={i}>{p.href ? <Link href={p.href}>{p.texto}</Link> : p.texto}</li>
        ))}
      </ol>
      <button
        type="button"
        className="botao pequeno contorno"
        onClick={() => {
          marcarVista(`tutorial-${turno}`)
          setOculto(true)
        }}
      >
        Esconder o tutorial deste turno
      </button>
    </section>
  )
}
