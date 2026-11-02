// Limite simples de tentativas em memória (uma instância só). Conta só as falhas.
const JANELA_MS = 10 * 60 * 1000
const MAX_FALHAS = 10
const falhas = new Map<string, number[]>()

function recentes(chave: string) {
  const agora = Date.now()
  const lista = (falhas.get(chave) ?? []).filter((t) => agora - t < JANELA_MS)
  if (lista.length) falhas.set(chave, lista)
  else falhas.delete(chave)
  return lista
}

export function bloqueado(chave: string) {
  return recentes(chave).length >= MAX_FALHAS
}

export function registrarFalha(chave: string) {
  const lista = recentes(chave)
  lista.push(Date.now())
  falhas.set(chave, lista)
  if (falhas.size > 5000) falhas.clear() // evita crescer sem fim
}
