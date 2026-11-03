// Prazos: terça, quinta e domingo às 23h59, em Manaus (UTC-4, sem horário de verão).
const OFFSET_MS = 4 * 3600 * 1000
const DIAS_TURNO = [0, 2, 4] // domingo, terça, quinta

export function proximoPrazo(depois: Date = new Date()): Date {
  const local = new Date(depois.getTime() - OFFSET_MS)
  for (let i = 0; i <= 7; i++) {
    const dia = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i, 23, 59, 0))
    const prazo = new Date(dia.getTime() + OFFSET_MS)
    if (DIAS_TURNO.includes(dia.getUTCDay()) && prazo.getTime() > depois.getTime()) return prazo
  }
  throw new Error('prazo não encontrado')
}

export function formatarPrazo(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Manaus',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function faltam(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'fechando'
  const h = Math.floor(ms / 3600000)
  return h >= 24 ? `faltam ${Math.floor(h / 24)}d ${h % 24}h` : `faltam ${h}h`
}

// Cada turno equivale a cerca de 2 anos: o turno 1 é 1890 e o 12 é 1912.
export function anoDoTurno(turno: number) {
  return 1890 + 2 * (turno - 1)
}
