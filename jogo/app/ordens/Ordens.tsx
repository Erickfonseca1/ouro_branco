'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Ordens as OrdensTipo } from '@/lib/motor'
import { faltam, formatarPrazo } from '@/lib/tempo'
import type { MetodoId, NpcId } from '@/lib/regras'

type Dados = ReturnType<typeof import('@/lib/estado').listaParaOrdens>

type Slot = { tipo: string; npc: string; metodo: string; alvo: string }
const VAZIO: Slot = { tipo: '', npc: '', metodo: '', alvo: '' }

export default function Ordens({ dados }: { dados: Dados }) {
  const router = useRouter()
  const salvas = dados.ordens
  const [abertas, setAbertas] = useState<Slot[]>(() => {
    const base = (salvas?.abertas ?? []).map((a) => ({
      tipo: a.tipo,
      npc: a.tipo === 'visitar' ? String(a.alvo ?? '') : '',
      metodo: a.metodo ?? '',
      alvo: a.tipo === 'denunciar' ? String(a.alvo ?? '') : '',
    }))
    return [base[0] ?? { ...VAZIO }, base[1] ?? { ...VAZIO }]
  })
  const [secreta, setSecreta] = useState<Slot & { qtd: string }>({
    tipo: salvas?.secreta?.tipo ?? '',
    npc: salvas?.secreta?.tipo === 'subornar' ? String(salvas.secreta.alvo ?? '') : '',
    metodo: '',
    alvo: ['plantar_boato', 'espionar'].includes(salvas?.secreta?.tipo ?? '') ? String(salvas?.secreta?.alvo ?? '') : '',
    qtd: String(salvas?.secreta?.quantidade ?? ''),
  })
  const [aviar, setAviar] = useState(salvas?.aviar ?? true)
  const [vender, setVender] = useState(String(salvas?.vender?.quantidade ?? ''))
  const [canal, setCanal] = useState<'casa' | 'exportador'>(salvas?.vender?.canal ?? 'casa')
  const [proposta, setProposta] = useState({
    alvo: String(salvas?.propostas?.[0]?.alvo ?? ''),
    valor: String(salvas?.propostas?.[0]?.valor ?? ''),
  })
  const [respostas, setRespostas] = useState<Record<string, string>>(salvas?.respostas ?? {})
  const [reivindicar, setReivindicar] = useState(!!salvas?.reivindicar)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  function atualizarAberta(i: number, campo: keyof Slot, valor: string) {
    setAbertas((a) => a.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)))
  }

  function montar(): OrdensTipo {
    const ab: OrdensTipo['abertas'] = []
    for (const s of abertas) {
      if (!s.tipo) continue
      if (s.tipo === 'visitar') ab.push({ tipo: 'visitar', alvo: s.npc as NpcId, metodo: s.metodo as MetodoId })
      else if (s.tipo === 'denunciar') ab.push({ tipo: 'denunciar', alvo: Number(s.alvo) })
      else ab.push({ tipo: s.tipo as 'investir' | 'doar' })
    }
    const o: OrdensTipo = { abertas: ab, aviar }
    if (secreta.tipo) {
      if (secreta.tipo === 'subornar') o.secreta = { tipo: 'subornar', alvo: secreta.npc as NpcId }
      else if (['plantar_boato', 'espionar'].includes(secreta.tipo)) o.secreta = { tipo: secreta.tipo as 'espionar', alvo: Number(secreta.alvo) }
      else if (secreta.tipo === 'contrabandear') o.secreta = { tipo: 'contrabandear', quantidade: Number(secreta.qtd) || 0 }
      else o.secreta = { tipo: secreta.tipo as 'comprar_silencio' }
    }
    if (vender !== '') o.vender = { quantidade: Number(vender), canal }
    if (proposta.alvo && proposta.valor) o.propostas = [{ alvo: Number(proposta.alvo), valor: Number(proposta.valor) }]
    if (Object.keys(respostas).length) o.respostas = respostas as Record<string, 'aceitar' | 'recusar'>
    if (reivindicar) o.reivindicar = true
    return o
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setOk('')
    setEnviando(true)
    const res = await fetch('/api/ordens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...montar(), turno: dados.turno }) })
    const dados2 = await res.json()
    setEnviando(false)
    if (!res.ok) {
      setErro(dados2.erro)
      if (res.status === 409) router.refresh() // turno virou: recarrega com o turno novo
      return
    }
    setOk('Ordens salvas. Você pode trocar até o prazo.')
    router.refresh()
  }

  if (dados.encerrado) {
    return <main className="tela"><h1 className="titulo">Partida encerrada</h1><Link href="/gazeta">Ver a Gazeta</Link></main>
  }

  return (
    <main className="tela">
      <header className="topo"><Link href="/gazeta" className="marca">Ouro Branco</Link><span className="mono">Turno {dados.turno}</span></header>
      <h1 className="titulo">Ordens</h1>
      <p className="ajuda">Fecha {formatarPrazo(dados.prazo)} · {faltam(dados.prazo)}. Quem não enviar recebe a ordem padrão: paga o aviamento e vende tudo à casa comercial.</p>

      <form onSubmit={enviar}>
        <section className="bloco">
          <h3>Ações abertas (até 2, todos veem)</h3>
          {abertas.map((s, i) => (
            <div className="ordem" key={i}>
              <label className="campo-linha">Ação {i + 1}
                <select value={s.tipo} onChange={(e) => atualizarAberta(i, 'tipo', e.target.value)}>
                  <option value="">Nenhuma</option>
                  <option value="investir">Comprar seringal (6₵)</option>
                  <option value="doar">Doar (3₵, +1★)</option>
                  <option value="visitar">Visitar alguém</option>
                  <option value="denunciar">Denunciar (precisa de prova)</option>
                </select>
              </label>
              {s.tipo === 'visitar' && (
                <div className="par">
                  <select aria-label="Quem visitar" value={s.npc} onChange={(e) => atualizarAberta(i, 'npc', e.target.value)}>
                    <option value="">Quem?</option>
                    {dados.npcs.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
                  </select>
                  <select aria-label="Como abordar" value={s.metodo} onChange={(e) => atualizarAberta(i, 'metodo', e.target.value)}>
                    <option value="">Como?</option>
                    {dados.metodos.map((m) => <option key={m.id} value={m.id}>{m.nome} {m.custo ? `(${m.custo}₵)` : ''}</option>)}
                  </select>
                </div>
              )}
              {s.tipo === 'denunciar' && (
                <select aria-label="Quem denunciar" value={s.alvo} onChange={(e) => atualizarAberta(i, 'alvo', e.target.value)}>
                  <option value="">Quem?</option>
                  {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
                </select>
              )}
            </div>
          ))}
        </section>

        <section className="bloco">
          <h3>Ação secreta (1, deixa rastro)</h3>
          <select aria-label="Ação secreta" value={secreta.tipo} onChange={(e) => setSecreta({ ...secreta, tipo: e.target.value })}>
            <option value="">Nenhuma</option>
            <option value="subornar">Subornar (3₵)</option>
            <option value="plantar_boato">Plantar boato (1₵)</option>
            <option value="comprar_silencio">Comprar silêncio (3₵)</option>
            <option value="espionar">Espionar telégrafo (1₵)</option>
            <option value="contrabandear">Contrabandear lotes</option>
          </select>
          {secreta.tipo === 'subornar' && (
            <select aria-label="Quem subornar" value={secreta.npc} onChange={(e) => setSecreta({ ...secreta, npc: e.target.value })}>
              <option value="">Quem?</option>
              {dados.npcs.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
            </select>
          )}
          {['plantar_boato', 'espionar'].includes(secreta.tipo) && (
            <select aria-label="Alvo" value={secreta.alvo} onChange={(e) => setSecreta({ ...secreta, alvo: e.target.value })}>
              <option value="">Quem?</option>
              {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
          )}
          {secreta.tipo === 'contrabandear' && (
            <input type="text" inputMode="numeric" aria-label="Lotes a contrabandear" placeholder="Quantos lotes?" value={secreta.qtd} onChange={(e) => setSecreta({ ...secreta, qtd: e.target.value.replace(/\D/g, '') })} />
          )}
        </section>

        <section className="bloco">
          <h3>Economia</h3>
          <label className="campo-linha"><input type="checkbox" checked={aviar} onChange={(e) => setAviar(e.target.checked)} /> Pagar o aviamento dos seringais</label>
          <div className="par">
            <input type="text" inputMode="numeric" aria-label="Lotes para vender" placeholder="Lotes (em branco: todos)" value={vender} onChange={(e) => setVender(e.target.value.replace(/\D/g, ''))} />
            <select aria-label="Canal de venda" value={canal} onChange={(e) => setCanal(e.target.value as 'casa' | 'exportador')}>
              <option value="casa">Casa comercial (60%)</option>
              <option value="exportador">Exportador (75%, limite de 8)</option>
            </select>
          </div>
          <p className="ajuda">
            Estoque: {dados.estoque} lotes, mais {dados.seringais * 3} se o aviamento for pago. Em branco vende tudo; 0 não vende nada. Vender demais derruba o preço de todos.
          </p>
        </section>

        <section className="bloco">
          <h3>Propor contrato</h3>
          <div className="par">
            <select aria-label="Para quem" value={proposta.alvo} onChange={(e) => setProposta({ ...proposta, alvo: e.target.value })}>
              <option value="">Para quem?</option>
              {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
            <input type="text" inputMode="numeric" aria-label="Pagamento por turno" placeholder="₵ por turno (1 a 6)" value={proposta.valor} onChange={(e) => setProposta({ ...proposta, valor: e.target.value.replace(/\D/g, '') })} />
          </div>
          <p className="ajuda">Dura 2 turnos. Só vale se o outro aceitar no turno seguinte.</p>
        </section>

        {dados.contratosRecebidos.length > 0 && (
          <section className="bloco">
            <h3>Propostas recebidas</h3>
            {dados.contratosRecebidos.map((c) => (
              <div className="ordem" key={c.id}>
                <p>{c.deNome} propõe {c.valor}₵ por turno.</p>
                <div className="par">
                  <button type="button" className={`botao pequeno ${respostas[c.id] === 'aceitar' ? 'acento' : 'contorno'}`} onClick={() => setRespostas({ ...respostas, [c.id]: 'aceitar' })}>Aceitar</button>
                  <button type="button" className={`botao pequeno ${respostas[c.id] === 'recusar' ? 'acento' : 'contorno'}`} onClick={() => setRespostas({ ...respostas, [c.id]: 'recusar' })}>Recusar</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {dados.podeReivindicar && (
          <section className="bloco">
            <h3>Reivindicar</h3>
            <label className="campo-linha"><input type="checkbox" checked={reivindicar} onChange={(e) => setReivindicar(e.target.checked)} /> Reivindicar o título agora</label>
            <p className="ajuda">Todos ficam sabendo quem reivindicou, mas não qual é o objetivo. Os demais têm um turno para derrubar um marco.</p>
          </section>
        )}

        {erro && <p className="erro" role="alert">{erro}</p>}
        {ok && <p className="ajuda" role="status">{ok}</p>}
        <button type="submit" className="botao acento" disabled={enviando}>{enviando ? 'Salvando...' : dados.ordemEnviada ? 'Atualizar ordens' : 'Enviar ordens'}</button>
      </form>
    </main>
  )
}
