import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { carregarEstado } from '@/lib/estado'
import { SLOTS_SERINGAL } from '@/lib/regras'
import { Quadro } from '../_quadro/Quadro'

export const instant = false

export default async function Rio() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const v = carregarEstado(j.id)

  return (
    <Quadro v={v} ativo="rio">
      <h2 className="titulo">O rio</h2>
      <div className="mapa">
        <svg viewBox="0 0 690 1010" role="img" aria-label="Mapa do rio com os seringais de cada jogador">
          <image href="/mapa/rio.jpg" width="690" height="1010" />
          <text className="t-cid" x="470" y="470" fontSize="30">MANAUS</text>
          {v.seringais.map((s) => {
            const [x, y] = SLOTS_SERINGAL[s.slot] ?? [0, 0]
            return s.dono ? (
              <g key={s.slot} transform={`translate(${x} ${y}) scale(1.7)`}>
                <rect x="-12" y="-12" width="24" height="24" rx="4" fill="var(--color-on-map)" stroke={`var(${s.cor})`} strokeWidth="3" />
                <text y="3.5" textAnchor="middle" fill="var(--color-river-black)" fontFamily="var(--font-outlier)" fontSize="9">{s.iniciais}</text>
              </g>
            ) : (
              <g key={s.slot} transform={`translate(${x} ${y}) scale(1.7)`}>
                <rect x="-12" y="-12" width="24" height="24" rx="4" fill="none" stroke="var(--color-on-map)" strokeWidth="1.5" strokeDasharray="3 3" />
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="legenda">
        <li>Seringal com dono</li>
        <li>Pontilhado: do sistema</li>
      </ul>

      <section className="bloco">
        <h3>Seu seringal</h3>
        <p>
          {v.eu.seringais} {v.eu.seringais === 1 ? 'seringal' : 'seringais'}. Produção de 3 lotes por seringal, se o aviamento
          for pago antes do turno fechar. Estoque: {v.eu.estoque} lotes.
        </p>
      </section>
    </Quadro>
  )
}
