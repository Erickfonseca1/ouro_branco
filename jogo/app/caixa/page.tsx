import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { db, type Mensagem } from '@/lib/db'
import { jogadorAtual } from '@/lib/sessao'
import { papel } from '@/lib/papeis'
import MarcarLidas from './MarcarLidas'
import Ajuda from '../_quadro/Ajuda'
import Link from 'next/link'

function quando(utc: string) {
  return new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', {
    timeZone: 'America/Manaus',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const instant = false

export default async function Caixa() {
  await connection()
  const jogador = await jogadorAtual()
  if (!jogador) redirect('/entrar')
  if (!jogador.bem_vindo) redirect('/bem-vindo')

  const mensagens = db
    .prepare('SELECT id, texto, lida, criada_em FROM caixa WHERE jogador_id = ? ORDER BY id DESC')
    .all(jogador.id) as Mensagem[]
  const personagem = papel(jogador.papel)

  return (
    <main className="tela">
      <header className="topo">
        <Link href="/gazeta" className="marca">Ouro Branco</Link>
        <span className="topo-acoes"><span className="mono">{personagem?.papel}</span><Ajuda pagina="caixa" /></span>
      </header>
      <h1 className="titulo">Caixa de entrada</h1>

      {mensagens.length === 0 ? (
        <p className="vazio">Nada por aqui ainda.</p>
      ) : (
        <ul className="caixa-lista">
          {mensagens.map((m) => (
            <li key={m.id}>
              <span className="quando">
                {quando(m.criada_em)}
                {!m.lida && <span className="nova">nova</span>}
              </span>
              <p>{m.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <MarcarLidas />
    </main>
  )
}
