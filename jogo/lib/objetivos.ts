// SERVER ONLY. Os marcos secretos vêm de lib/data/marcos.json e nunca devem ir para o cliente.
// O cliente recebe só rótulos genéricos (labelMarco) e o estado selado (cumprido ou não).
import dados from './data/marcos.json'

type Marco = {
  id: string
  tipo: string
  acoes: number
  custo: number
  coop: boolean
  parceiros: number
  turno_min: number
  bifurcacao: string | null
  desfecho_favoravel: string[] | null
  prestigio_min: number
}

type Variante = { id: string; papel: string; variante: string; marcos: Marco[] }

const todas = dados.variantes as unknown as Variante[]

// Ligação entre o id do papel (PAPEIS em papeis.ts) e a chave de papel em marcos.json.
export const CHAVE_PAPEL: Record<number, string> = {
  1: 'Coronel', 2: 'Casa Aviadora', 3: 'Exportador', 4: 'Armador', 5: 'Governador',
  6: 'Dono do jornal', 7: 'Caudilho', 8: 'Naturalista', 9: 'Engenheiro', 10: 'Lider seringueiro',
  11: 'Bispo', 12: 'Contrabandista', 13: 'Consul', 14: 'Empresario',
}

export const ECONOMIA_PAPEL = dados.papeis as Record<string, { prestigio: number; caixa: number; renda: number }>
export const BIFURCACOES = dados.bifurcacoes as Record<string, { turno: number; desfechos: Record<string, number> }>

// Sorteia uma das três variantes do papel. Devolve o id da variante (opaco ao jogador).
export function variantesDoPapel(papelId: number): Variante[] {
  return todas.filter((v) => v.papel === CHAVE_PAPEL[papelId])
}

export function marcosDaVariante(id: string): Marco[] {
  return todas.find((v) => v.id === id)?.marcos ?? []
}

export function labelMarco(m: Marco): string {
  const partes: string[] = []
  if (m.tipo.includes('contrato') || m.coop) {
    const n = Math.max(1, m.parceiros)
    partes.push(n === 1 ? 'Contrato com outro jogador' : `Contratos com ${n} jogadores`)
  }
  if (m.tipo.includes('prestig') || m.prestigio_min > 0) partes.push(`Prestígio ${Math.max(m.prestigio_min, 1)}★ ou mais`)
  if (m.tipo.includes('caixa') && m.custo > 0) partes.push(`Caixa de ${m.custo}₵`)
  if (m.tipo.includes('bifurcacao')) partes.push('Resultado de uma bifurcação')
  if (m.tipo.includes('relogio')) partes.push('Relógio das sementes avançado')
  if (m.tipo.includes('denuncia') || m.tipo.includes('prova')) partes.push('Prova contra alguém')
  if (m.tipo.includes('estado')) partes.push('Dois seringais')
  if (m.tipo.includes('indicador')) partes.push('Preço de 5₵ ou mais')
  if (m.turno_min > 1) partes.push(`A partir do turno ${m.turno_min}`)
  return partes.length ? partes.join('; ') : 'Ação pública no turno'
}

export type Contexto = {
  turno: number
  caixa: number
  prestigio: number
  seringais: number
  preco: number
  contratosAtivos: { parceiroId: number }[]
  bifurcacoes: Record<string, string>
  provas: number
  acoesSecretasFeitas: number
  relogio: boolean
}

// Avalia um marco com o estado atual. Cada tipo do marcos.json vira uma condição verificável.
// Simplificação do piloto: 'acoes', 'janela' e 'fragil' não entram na avaliação.
export function cumprido(m: Marco, c: Contexto): boolean {
  if (c.turno < m.turno_min) return false
  if (m.tipo.includes('contrato') || m.coop) {
    const parceiros = new Set(c.contratosAtivos.map((k) => k.parceiroId))
    if (parceiros.size < Math.max(1, m.parceiros)) return false
  }
  if (m.prestigio_min > 0 && c.prestigio < m.prestigio_min) return false
  if (m.tipo.includes('prestig') && c.prestigio < Math.max(1, m.prestigio_min)) return false
  if (m.tipo.includes('caixa') && c.caixa < m.custo) return false
  if (m.tipo.includes('bifurcacao')) {
    if (!m.bifurcacao || !m.desfecho_favoravel) return false
    const desfecho = c.bifurcacoes[m.bifurcacao]
    if (!desfecho || !m.desfecho_favoravel.includes(desfecho)) return false
  }
  if (m.tipo.includes('relogio') && !c.relogio) return false
  if ((m.tipo.includes('denuncia') || m.tipo.includes('prova')) && c.provas < 1) return false
  if (m.tipo.includes('estado') && c.seringais < 2) return false
  if (m.tipo.includes('indicador') && c.preco < 5) return false
  if (m.tipo.includes('acao_secreta') && c.acoesSecretasFeitas < 1) return false
  return true
}
