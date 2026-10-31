import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { jogadorAtual } from '@/lib/sessao'
import { carregarEstado } from '@/lib/estado'
import { P_BASE } from '@/lib/regras'
import { Quadro } from '../_quadro/Quadro'

export const instant = false

const preco = (n: number) => `${n.toFixed(2).replace('.', ',')}₵`

export default async function Bolsa() {
  await connection()
  const j = await jogadorAtual()
  if (!j) redirect('/entrar')
  if (!j.bem_vindo) redirect('/bem-vindo')
  const v = carregarEstado(j.id)
  const atual = v.partida.preco ?? P_BASE[0]
  const ultimo = v.partida.historico[v.partida.historico.length - 1]
  const seta = ultimo && v.partida.historico.length > 1
    ? atual > v.partida.historico[v.partida.historico.length - 2].preco ? '▲' : atual < v.partida.historico[v.partida.historico.length - 2].preco ? '▼' : '='
    : '='

  return (
    <Quadro v={v} ativo="bolsa">
      <h2 className="titulo">A Bolsa</h2>
      <p className="ajuda">Preço do lote no último turno fechado. Todos vendem ao mesmo tempo: se a mesa vender demais, o preço cai para todos.</p>
      <div className="preco-grande" aria-label={`Preço ${preco(atual)}, ${seta}`}>
        <span>{preco(atual)}</span> <span className="seta">{seta}</span>
      </div>
      <dl className="stats">
        <div><dt>Demanda</dt><dd className="mono">{v.partida.demanda} lotes</dd></div>
        <div><dt>Vendido no último turno</dt><dd className="mono">{ultimo?.vendido ?? 0} lotes</dd></div>
        <div><dt>Seu caixa</dt><dd className="mono">{preco(v.eu.caixa)}</dd></div>
        <div><dt>Seu estoque</dt><dd className="mono">{v.eu.estoque} lotes</dd></div>
      </dl>

      <section className="bloco" aria-labelledby="hist-t">
        <h3 id="hist-t">Histórico</h3>
        {v.partida.historico.length === 0 ? (
          <p className="ajuda">Nenhum turno fechado ainda.</p>
        ) : (
          <table className="tabela">
            <thead><tr><th>Turno</th><th>Preço</th><th>Vendido</th></tr></thead>
            <tbody>
              {v.partida.historico.map((h) => (
                <tr key={h.turno}><td className="mono">{h.turno}</td><td className="mono">{preco(h.preco)}</td><td className="mono">{h.vendido}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bloco" aria-labelledby="ct-t">
        <h3 id="ct-t">Contratos</h3>
        {v.contratos.length === 0 ? (
          <p className="ajuda">Nenhum contrato ativo ou proposto.</p>
        ) : (
          <ul className="notas">
            {v.contratos.map((c) => (
              <li key={c.id}>
                {c.recebo ? `${c.deNome}` : `Você com ${c.paraNome}`}: {preco(c.valor)} por turno, {c.status === 'proposto' ? 'proposto' : `${c.turnos} turno(s) restante(s)`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Quadro>
  )
}
