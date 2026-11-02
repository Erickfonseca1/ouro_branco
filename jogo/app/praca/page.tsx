import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { jogadorAtual } from '@/lib/sessao'
import { carregarEstado } from '@/lib/estado'
import { Quadro } from '../_quadro/Quadro'
import { QuemEQuem } from '../_quadro/QuemEQuem'

export const instant = false

export default async function Praca() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const v = carregarEstado(j.id)

  return (
    <Quadro v={v} ativo="praca">
      <h2 className="titulo">A Praça</h2>
      <p className="ajuda">Quem visitou quem no último turno. Visitas são públicas; o que cada um descobre, não.</p>
      {v.registros.length === 0 ? (
        <p className="vazio">Nenhuma visita registrada ainda.</p>
      ) : (
        <ul className="caixa-lista">
          {v.registros.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      <QuemEQuem jogadores={v.jogadores} />

      <section className="bloco" aria-labelledby="np-t">
        <h3 id="np-t">Personagens em cena</h3>
        <ul className="personagens">
          {v.relacoes.map((n) => (
            <li key={n.id}>
              <div>
                <p className="nome-npc">{n.nome}</p>
                <p className="ajuda">{n.papel}</p>
              </div>
              <span className="pontos" role="img" aria-label={`Relação ${n.valor} de 5`}>
                {[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= n.valor ? 'on' : ''} />)}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/ordens" className="botao contorno" style={{ marginTop: 'var(--space-md)' }}>Visitar alguém</Link>
      </section>
    </Quadro>
  )
}
