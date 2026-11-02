// Telefone no cliente: máscara "(92) 99999-0000" e validação igual à do servidor (DDD + número, com ou sem +55).
export function digitosTelefone(valor: string) {
  let d = valor.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d
}

export function formatarTelefone(valor: string) {
  const d = digitosTelefone(valor).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function telefoneValido(valor: string) {
  const n = digitosTelefone(valor).length
  return n === 10 || n === 11
}
