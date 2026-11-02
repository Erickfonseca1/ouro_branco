import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { carregarEstado } from '@/lib/estado'
import { faltam } from '@/lib/tempo'
import { Quadro } from '../_quadro/Quadro'
import Fechar from '../_quadro/Fechar'
import VotarTurno from '../_quadro/VotarTurno'

export const instant = false

export default async function Gazeta() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const v = carregarEstado(j.id)
  const manchetes = v.gazeta.filter((g) => g.tipo === 'manchete')
  const notas = v.gazeta.filter((g) => g.tipo === 'nota')
  const boatos = v.gazeta.filter((g) => g.tipo === 'boato')
  const semEdicao = v.partida.turno === 1 && v.partida.status === 'aberto'

  return (
    <Quadro v={v} ativo="gazeta">
      <section className="tela-secao" aria-labelledby="gz-t">
        <h2 id="gz-t" className="titulo">Gazeta de Manaus</h2>
        {v.partida.status === 'fim' && (
          <p className="faixa-alerta" role="status">
            {v.partida.vencedor ? `A partida acabou. ${v.partida.vencedor} venceu.` : 'A partida terminou sem vencedor: ninguém cumpriu um marco.'}
          </p>
        )}
        {v.partida.reivindicador && (
          <p className="faixa-alerta">{v.partida.reivindicador} reivindica o título. Derrube um marco até o próximo turno.</p>
        )}
        {semEdicao ? (
          <p className="ajuda">A primeira edição sai quando o turno 1 fechar.</p>
        ) : (
          <>
            <h3 className="manchete">{manchetes[0]?.texto ?? 'Sem manchete hoje.'}</h3>
            {manchetes.slice(1).map((m, i) => <p key={i} className="linha-jornal">{m.texto}</p>)}
            {notas.length > 0 && (
              <ul className="notas">{notas.map((n, i) => <li key={i}>{n.texto}</li>)}</ul>
            )}
            {boatos.length > 0 && (
              <div className="bloco">
                <h3>Boatos</h3>
                <ul className="notas">{boatos.map((b, i) => <li key={i}>{b.texto}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </section>

      {v.partida.status === 'aberto' && (
        <section className="bloco" aria-labelledby="pr-t">
          <h3 id="pr-t">Próximos prazos</h3>
          <ul className="prazos">
            <li>Fechamento do turno {v.partida.turno} <span className="mono">{faltam(v.partida.prazo)}</span></li>
            {v.partida.reivindicador && <li>Reivindicação em curso de {v.partida.reivindicador}</li>}
          </ul>
          <VotarTurno votos={v.partida.votos} />
        </section>
      )}

      {v.eu.criador && v.partida.status === 'aberto' && <Fechar />}
    </Quadro>
  )
}
