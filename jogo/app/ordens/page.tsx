import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { listaParaOrdens } from '@/lib/estado'
import Ordens from './Ordens'

export const instant = false

export default async function PaginaOrdens() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const dados = listaParaOrdens(j.id)
  return <Ordens key={`${dados.turno}-${dados.ordemEnviada}`} dados={dados} />
}
