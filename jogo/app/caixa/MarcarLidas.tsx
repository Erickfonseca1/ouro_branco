'use client'

import { useEffect } from 'react'

// Ao abrir a caixa, marca tudo como lido. O badge da próxima visita já sai zerado.
export default function MarcarLidas() {
  useEffect(() => {
    fetch('/api/caixa/lidas', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
