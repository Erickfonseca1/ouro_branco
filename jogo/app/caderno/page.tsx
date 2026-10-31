import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { carregarEstado } from '@/lib/estado'
import { Quadro } from '../_quadro/Quadro'

export const instant = false

const NIVEL: Record<string, string> = { boato: 'Boato', indicio: 'Indício', prova: 'Prova' }

export default async function Caderno() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const v = carregarEstado(j.id)

  return (
    <Quadro v={v} ativo="caderno">
      <h2 className="titulo">Caderno</h2>
      <p className="ajuda">Privado. Só você vê os seus marcos e as suas pistas.</p>

      <ol className="selos" aria-label="Marcos do seu objetivo">
        {v.eu.marcos.map((m, i) => (
          <li key={i} className={m.cumprido ? 'selo cumprido' : m.liberado ? 'selo' : 'selo fechado'}>
            <span className="selo-marca" aria-hidden="true">{m.cumprido ? 'OK' : m.liberado ? '' : '…'}</span>
            <span className="selo-texto">
              <strong>Marco {i + 1}</strong>
              <span>{m.rotulo}</span>
              {!m.liberado && <span className="ajuda">Libera no turno {m.turnoMin}</span>}
            </span>
            <span className="visually-hidden">{m.cumprido ? 'cumprido' : m.liberado ? 'não cumprido' : 'ainda não liberado'}</span>
          </li>
        ))}
      </ol>

      <section className="bloco" aria-labelledby="pi-t">
        <h3 id="pi-t">Pistas</h3>
        {v.pistas.length === 0 ? (
          <p className="ajuda">Nenhuma pista ainda. Visite alguém na Praça.</p>
        ) : (
          <ul className="pistas">
            {v.pistas.map((p, i) => (
              <li key={i} className={`pista nivel-${p.nivel}`}>
                <span className="mono">{NIVEL[p.nivel]}</span> sobre {p.alvoNome}, por {p.fonte}, turno {p.turno}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Quadro>
  )
}
