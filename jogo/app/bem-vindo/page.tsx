import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { papel } from '@/lib/papeis'
import Bemvindo from './Bemvindo'

export const instant = false

export default async function PaginaBemVindo() {
  await connection()
  const jogador = await jogadorAtual()
  if (!jogador) redirect('/entrar')
  if (jogador.bem_vindo) redirect('/gazeta')
  const personagem = papel(jogador.papel)
  if (!personagem) redirect('/entrar')
  return <Bemvindo personagem={personagem} />
}
