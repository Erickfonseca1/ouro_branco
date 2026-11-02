'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Ordens as OrdensTipo } from '@/lib/motor'
import { faltam, formatarPrazo } from '@/lib/tempo'
import * as R from '@/lib/regras'
import type { ChaveDica } from '@/lib/ajuda'
import VotarTurno from '../_quadro/VotarTurno'
import Ajuda from '../_quadro/Ajuda'
import Dica from '../_quadro/Dica'

type Dados = ReturnType<typeof import('@/lib/estado').listaParaOrdens>
type Slot = { tipo: string; npc: string; metodo: string; alvo: string }
type Opcao = { id: string; nome: string; custo?: number; extra?: string }

const VAZIO: Slot = { tipo: '', npc: '', metodo: '', alvo: '' }
const OPCOES_ABERTAS: Opcao[] = [
  { id: '', nome: 'Nenhuma' },
  { id: 'investir', nome: 'Comprar seringal', custo: R.CUSTO_SERINGAL },
  { id: 'doar', nome: 'Doar', custo: R.CUSTO_DOAR, extra: '+1★' },
  { id: 'visitar', nome: 'Visitar alguém' },
  { id: 'denunciar', nome: 'Denunciar', extra: 'prova' },
]
const OPCOES_SECRETAS: Opcao[] = [
  { id: '', nome: 'Nenhuma' },
  { id: 'subornar', nome: 'Subornar', custo: R.CUSTO_SECRETA.subornar },
  { id: 'plantar_boato', nome: 'Plantar boato', custo: R.CUSTO_SECRETA.plantar_boato },
  { id: 'comprar_silencio', nome: 'Comprar silêncio', custo: R.CUSTO_SECRETA.comprar_silencio },
  { id: 'espionar', nome: 'Espionar telégrafo', custo: R.CUSTO_SECRETA.espionar },
  { id: 'contrabandear', nome: 'Contrabandear' },
]
const NIVEIS = ['nada', 'boato', 'indício', 'prova']
const moeda = (n: number) => `${n.toFixed(2).replace('.', ',')}₵`
const so = (v: string) => v.replace(/\D/g, '')

// Grupo de escolhas em "pílulas" (rádios), mais fácil de tocar no celular do que um select.
function Opcoes({ nome, legenda, opcoes, valor, aoMudar }: { nome: string; legenda: string; opcoes: Opcao[]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <fieldset className="opcoes">
      <legend className="visually-hidden">{legenda}</legend>
      {opcoes.map((o) => (
        <label key={o.id || 'nenhuma'} className="opcao">
          <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => aoMudar(o.id)} />
          <span>
            {o.nome}
            {o.custo ? <small>{o.custo}₵</small> : null}
            {o.extra ? <small>{o.extra}</small> : null}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

// Chance pública de cada resultado da visita (06: "a tela mostra a chance antes de você decidir").
function Chances({ metodo }: { metodo: R.MetodoId }) {
  const c = R.METODOS[metodo].chances
  return (
    <div className="chances">
      <div className="chances-barra" aria-hidden="true">
        {c.map((p, i) => <span key={i} className={`nivel-${i}`} style={{ width: `${p * 100}%` }} />)}
      </div>
      <p className="ajuda">{c.map((p, i) => `${NIVEIS[i]} ${Math.round(p * 100)}%`).join(', ')}</p>
    </div>
  )
}

function Erro({ id, erros }: { id: string; erros: Record<string, string> }) {
  return erros[id] ? <p id={`${id}-erro`} className="campo-erro">{erros[id]}</p> : null
}

export default function Ordens({ dados }: { dados: Dados }) {
  const router = useRouter()
  const salvas = dados.ordens
  const V = dados.dicasVistas

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
    qtd: salvas?.secreta?.quantidade ? String(salvas.secreta.quantidade) : '',
  })
  const [aviar, setAviar] = useState(salvas?.aviar ?? true)
  // Em branco = vender tudo (a ordem padrão grava 999).
  const [vender, setVender] = useState(salvas?.vender && salvas.vender.quantidade < 999 ? String(salvas.vender.quantidade) : '')
  const [canal, setCanal] = useState<'casa' | 'exportador'>(salvas?.vender?.canal ?? 'casa')
  const [proposta, setProposta] = useState({
    alvo: String(salvas?.propostas?.[0]?.alvo ?? ''),
    valor: String(salvas?.propostas?.[0]?.valor ?? ''),
  })
  const [respostas, setRespostas] = useState<Record<string, string>>(salvas?.respostas ?? {})
  const [reivindicar, setReivindicar] = useState(!!salvas?.reivindicar)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function atualizarAberta(i: number, campo: keyof Slot, valor: string) {
    setAbertas((a) => a.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)))
  }

  function montar(): OrdensTipo {
    const ab: NonNullable<OrdensTipo['abertas']> = []
    for (const s of abertas) {
      if (!s.tipo) continue
      if (s.tipo === 'visitar') ab.push({ tipo: 'visitar', alvo: s.npc as R.NpcId, metodo: s.metodo as R.MetodoId })
      else if (s.tipo === 'denunciar') ab.push({ tipo: 'denunciar', alvo: Number(s.alvo) })
      else ab.push({ tipo: s.tipo as 'investir' | 'doar' })
    }
    const o: OrdensTipo = { abertas: ab, aviar }
    if (secreta.tipo) {
      if (secreta.tipo === 'subornar') o.secreta = { tipo: 'subornar', alvo: secreta.npc as R.NpcId }
      else if (['plantar_boato', 'espionar'].includes(secreta.tipo)) o.secreta = { tipo: secreta.tipo as 'espionar', alvo: Number(secreta.alvo) }
      else if (secreta.tipo === 'contrabandear') o.secreta = { tipo: 'contrabandear', quantidade: Number(secreta.qtd) || 0 }
      else o.secreta = { tipo: secreta.tipo as 'comprar_silencio' }
    }
    if (vender !== '') o.vender = { quantidade: Number(vender), canal }
    else if (canal === 'exportador') o.vender = { quantidade: 999, canal }
    if (proposta.alvo && proposta.valor) o.propostas = [{ alvo: Number(proposta.alvo), valor: Number(proposta.valor) }]
    const resp = Object.fromEntries(Object.entries(respostas).filter(([, r]) => r === 'aceitar' || r === 'recusar'))
    if (Object.keys(resp).length) o.respostas = resp as Record<string, 'aceitar' | 'recusar'>
    if (reivindicar) o.reivindicar = true
    return o
  }

  // Alterações não salvas: compara com o que estava gravado quando a tela abriu.
  const [gravado, setGravado] = useState(() => JSON.stringify(montar()))
  const sujo = JSON.stringify(montar()) !== gravado
  useEffect(() => {
    if (!sujo) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  function validar() {
    const e: Record<string, string> = {}
    abertas.forEach((s, i) => {
      if (s.tipo === 'visitar' && !s.npc) e[`a${i}-npc`] = 'Escolha quem visitar.'
      if (s.tipo === 'visitar' && !s.metodo) e[`a${i}-metodo`] = 'Escolha como abordar.'
      if (s.tipo === 'denunciar' && !s.alvo) e[`a${i}-alvo`] = 'Escolha quem denunciar.'
    })
    if (secreta.tipo === 'subornar' && !secreta.npc) e['s-npc'] = 'Escolha quem subornar.'
    if (['plantar_boato', 'espionar'].includes(secreta.tipo) && !secreta.alvo) e['s-alvo'] = 'Escolha o alvo.'
    if (secreta.tipo === 'contrabandear' && !(Number(secreta.qtd) > 0)) e['s-qtd'] = 'Diga quantos lotes.'
    if (proposta.alvo && !(Number(proposta.valor) >= 1 && Number(proposta.valor) <= R.PROPOSTA_VALOR_MAX)) e['p-valor'] = `Valor entre 1 e ${R.PROPOSTA_VALOR_MAX}₵.`
    if (!proposta.alvo && proposta.valor) e['p-alvo'] = 'Escolha para quem.'
    return e
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro('')
    const e = validar()
    setErros(e)
    const primeiro = Object.keys(e)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      return
    }
    setEnviando(true)
    const corpo = montar()
    const res = await fetch('/api/ordens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corpo, turno: dados.turno }) })
    const r = await res.json()
    setEnviando(false)
    if (!res.ok) {
      setErro(r.erro)
      if (res.status === 409) router.refresh() // o turno virou: recarrega com o turno novo
      return
    }
    setGravado(JSON.stringify(corpo))
    router.refresh()
  }

  // Estimativas: a interface faz a conta pelo jogador (04, seção 8.1).
  const producao = aviar ? dados.seringais * R.PRODUCAO_POR_SERINGAL : 0
  const disponivel = dados.estoque + producao
  const lotes = vender === '' ? disponivel : Math.min(Number(vender), disponivel)
  const lotesVendidos = canal === 'exportador' ? Math.min(lotes, R.CAPACIDADE_EXPORTADOR) : lotes
  const taxa = canal === 'exportador' ? R.PRECO_EXPORTADOR : R.PRECO_CASA
  const receita = lotesVendidos * (dados.preco * taxa - R.frete(dados.preco))
  const gastoAviamento = aviar ? dados.seringais * dados.aviamento : 0
  const gastoAbertas = abertas.reduce((s, a) => {
    if (a.tipo === 'investir') return s + R.CUSTO_SERINGAL
    if (a.tipo === 'doar') return s + R.CUSTO_DOAR
    if (a.tipo === 'visitar' && a.metodo) return s + R.METODOS[a.metodo as R.MetodoId].custo
    return s
  }, 0)
  const gastoSecreta = secreta.tipo ? R.CUSTO_SECRETA[secreta.tipo as R.SecretaId] : 0
  const saldo = dados.caixa - gastoAviamento + receita - gastoAbertas - gastoSecreta - dados.luxo

  if (dados.encerrado) {
    return (
      <main className="tela">
        <h1 className="titulo">Partida encerrada</h1>
        <Link href="/gazeta">Ver a Gazeta</Link>
      </main>
    )
  }

  const status = enviando ? 'Salvando…' : sujo ? 'Alterações não salvas' : dados.ordemEnviada ? 'Ordens enviadas' : 'Ordens ainda não enviadas'
  const erroProps = (id: string) => ({ id, 'aria-invalid': !!erros[id], 'aria-describedby': erros[id] ? `${id}-erro` : undefined })

  return (
    <main className="tela tela-ordens">
      <header className="topo">
        <Link href="/gazeta" className="marca">Ouro Branco</Link>
        <span className="topo-acoes"><span className="mono">Turno {dados.turno}</span><Ajuda pagina="ordens" /></span>
      </header>
      <h1 className="titulo">Ordens</h1>
      <p className="quem-sou">{dados.eu}</p>
      <p className="ajuda">Fecha {formatarPrazo(dados.prazo)}, {faltam(dados.prazo)}. Quem não enviar recebe a ordem padrão: paga o aviamento e vende tudo à casa comercial.</p>
      <Dica chave="ordens-intro" vistas={V} />

      <form onSubmit={enviar} noValidate>
        <fieldset className="etapa-ordens">
          <legend><span className="etapa-num">1</span>Economia</legend>
          <label className="interruptor">
            <input type="checkbox" checked={aviar} onChange={(e) => setAviar(e.target.checked)} />
            <span>Pagar o aviamento: {dados.seringais} {dados.seringais === 1 ? 'seringal' : 'seringais'} × {dados.aviamento}₵, produz {dados.seringais * R.PRODUCAO_POR_SERINGAL} lotes</span>
          </label>

          <p className="rotulo-campo" id="venda-rot">Quantos lotes vender</p>
          <div className="stepper" role="group" aria-labelledby="venda-rot">
            <button type="button" aria-label="Vender um lote a menos" onClick={() => setVender(String(Math.max(0, (vender === '' ? disponivel : Number(vender)) - 1)))}>−</button>
            <input type="text" inputMode="numeric" aria-label="Lotes para vender" placeholder={`Tudo (${disponivel})`} value={vender} onChange={(e) => setVender(so(e.target.value))} />
            <button type="button" aria-label="Vender um lote a mais" onClick={() => setVender(String(Math.min(disponivel, (vender === '' ? 0 : Number(vender)) + 1)))}>+</button>
            <button type="button" className="stepper-tudo" aria-pressed={vender === ''} onClick={() => setVender('')}>Tudo</button>
          </div>
          <Opcoes
            nome="canal"
            legenda="Para quem vender"
            valor={canal}
            aoMudar={(v) => setCanal(v as 'casa' | 'exportador')}
            opcoes={[
              { id: 'casa', nome: 'Casa comercial', extra: '60%' },
              { id: 'exportador', nome: 'Exportador', extra: '75%, até 8' },
            ]}
          />
          {canal === 'exportador' && <Dica chave="exportador" vistas={V} />}
          <p className="ajuda">
            Estoque {dados.estoque} + produção {producao} = {disponivel} lotes. Vendendo {lotesVendidos}, cerca de {moeda(receita)} se o preço ficar em {moeda(dados.preco)}. Vender demais derruba o preço de todos; o que sobrar perde metade.
          </p>
        </fieldset>

        <fieldset className="etapa-ordens">
          <legend><span className="etapa-num">2</span>Ações abertas <span className="ajuda">até 2, todos veem</span></legend>
          {abertas.map((s, i) => (
            <div className="ordem" key={i}>
              <p className="rotulo-campo">Ação {i + 1}</p>
              <Opcoes nome={`aberta-${i}`} legenda={`Ação aberta ${i + 1}`} opcoes={OPCOES_ABERTAS} valor={s.tipo} aoMudar={(v) => atualizarAberta(i, 'tipo', v)} />
              {s.tipo === 'visitar' && (
                <>
                  <label className="campo">
                    <span>Quem visitar</span>
                    <select {...erroProps(`a${i}-npc`)} value={s.npc} onChange={(e) => atualizarAberta(i, 'npc', e.target.value)}>
                      <option value="">Escolha</option>
                      {dados.npcs.map((n) => <option key={n.id} value={n.id}>{n.nome}, {n.papel.toLowerCase()}</option>)}
                    </select>
                  </label>
                  <Erro id={`a${i}-npc`} erros={erros} />
                  <p className="rotulo-campo" id={`a${i}-metodo`} tabIndex={-1}>Como abordar</p>
                  <Opcoes
                    nome={`metodo-${i}`}
                    legenda="Como abordar"
                    valor={s.metodo}
                    aoMudar={(v) => atualizarAberta(i, 'metodo', v)}
                    opcoes={dados.metodos.map((m) => ({ id: m.id, nome: m.nome, custo: m.custo || undefined }))}
                  />
                  <Erro id={`a${i}-metodo`} erros={erros} />
                  {s.metodo && <Chances metodo={s.metodo as R.MetodoId} />}
                </>
              )}
              {s.tipo === 'denunciar' && (
                <>
                  <label className="campo">
                    <span>Quem denunciar</span>
                    <select {...erroProps(`a${i}-alvo`)} value={s.alvo} onChange={(e) => atualizarAberta(i, 'alvo', e.target.value)}>
                      <option value="">Escolha</option>
                      {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
                    </select>
                  </label>
                  <Erro id={`a${i}-alvo`} erros={erros} />
                </>
              )}
              {s.tipo && abertas.findIndex((x) => x.tipo === s.tipo) === i && <Dica key={s.tipo} chave={s.tipo as ChaveDica} vistas={V} />}
            </div>
          ))}
        </fieldset>

        <fieldset className="etapa-ordens">
          <legend><span className="etapa-num">3</span>Ação secreta <span className="ajuda">1, deixa rastro</span></legend>
          <Opcoes nome="secreta" legenda="Ação secreta" opcoes={OPCOES_SECRETAS} valor={secreta.tipo} aoMudar={(v) => setSecreta({ ...secreta, tipo: v })} />
          {secreta.tipo === 'subornar' && (
            <>
              <label className="campo">
                <span>Quem subornar</span>
                <select {...erroProps('s-npc')} value={secreta.npc} onChange={(e) => setSecreta({ ...secreta, npc: e.target.value })}>
                  <option value="">Escolha</option>
                  {dados.npcs.map((n) => <option key={n.id} value={n.id}>{n.nome}, {n.papel.toLowerCase()}</option>)}
                </select>
              </label>
              <Erro id="s-npc" erros={erros} />
            </>
          )}
          {['plantar_boato', 'espionar'].includes(secreta.tipo) && (
            <>
              <label className="campo">
                <span>{secreta.tipo === 'espionar' ? 'Quem espionar' : 'Boato sobre quem'}</span>
                <select {...erroProps('s-alvo')} value={secreta.alvo} onChange={(e) => setSecreta({ ...secreta, alvo: e.target.value })}>
                  <option value="">Escolha</option>
                  {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
                </select>
              </label>
              <Erro id="s-alvo" erros={erros} />
            </>
          )}
          {secreta.tipo === 'contrabandear' && (
            <>
              <label className="campo">
                <span>Lotes a contrabandear (75% do preço, sem frete)</span>
                <input {...erroProps('s-qtd')} type="text" inputMode="numeric" placeholder="Quantos lotes?" value={secreta.qtd} onChange={(e) => setSecreta({ ...secreta, qtd: so(e.target.value) })} />
              </label>
              <Erro id="s-qtd" erros={erros} />
            </>
          )}
          {secreta.tipo && <Dica chave="secreta" vistas={V} />}
        </fieldset>

        <fieldset className="etapa-ordens">
          <legend><span className="etapa-num">4</span>Contratos</legend>
          <div className="par">
            <label className="campo">
              <span>Propor a</span>
              <select {...erroProps('p-alvo')} value={proposta.alvo} onChange={(e) => setProposta({ ...proposta, alvo: e.target.value })}>
                <option value="">Ninguém</option>
                {dados.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>₵ por turno (1 a {R.PROPOSTA_VALOR_MAX})</span>
              <input {...erroProps('p-valor')} type="text" inputMode="numeric" maxLength={1} value={proposta.valor} onChange={(e) => setProposta({ ...proposta, valor: so(e.target.value) })} />
            </label>
          </div>
          <Erro id="p-alvo" erros={erros} />
          <Erro id="p-valor" erros={erros} />
          <p className="ajuda">Você paga por 2 turnos, se o outro aceitar no turno seguinte.</p>
          {proposta.alvo && <Dica chave="contrato" vistas={V} />}

          {dados.contratosRecebidos.length > 0 && (
            <div className="recebidas">
              <p className="rotulo-campo">Propostas recebidas</p>
              <Dica chave="resposta" vistas={V} />
              {dados.contratosRecebidos.map((c) => (
                <div className="ordem" key={c.id}>
                  <p>{c.deNome} propõe pagar {c.valor}₵ por turno, por 2 turnos.</p>
                  <Opcoes
                    nome={`resp-${c.id}`}
                    legenda={`Resposta a ${c.deNome}`}
                    valor={respostas[c.id] ?? ''}
                    aoMudar={(v) => setRespostas({ ...respostas, [c.id]: v })}
                    opcoes={[{ id: 'aceitar', nome: 'Aceitar' }, { id: 'recusar', nome: 'Recusar' }, { id: '', nome: 'Decidir depois' }]}
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {dados.podeReivindicar && (
          <fieldset className="etapa-ordens">
            <legend><span className="etapa-num">5</span>Reivindicar</legend>
            <Dica chave="reivindicar" vistas={V} />
            <label className="interruptor">
              <input type="checkbox" checked={reivindicar} onChange={(e) => setReivindicar(e.target.checked)} />
              <span>Reivindicar o título neste turno</span>
            </label>
          </fieldset>
        )}

        <section className="resumo" aria-labelledby="res-t">
          <h3 id="res-t">Resumo do turno</h3>
          <dl>
            <div><dt>Caixa agora</dt><dd>{moeda(dados.caixa)}</dd></div>
            {gastoAviamento > 0 && <div><dt>Aviamento</dt><dd>−{moeda(gastoAviamento)}</dd></div>}
            {receita > 0 && <div><dt>Venda (estimada)</dt><dd>+{moeda(receita)}</dd></div>}
            {gastoAbertas > 0 && <div><dt>Ações abertas</dt><dd>−{moeda(gastoAbertas)}</dd></div>}
            {gastoSecreta > 0 && <div><dt>Ação secreta</dt><dd>−{moeda(gastoSecreta)}</dd></div>}
            <div><dt>Luxo ({dados.prestigio}★)</dt><dd>−{moeda(dados.luxo)}</dd></div>
            <div className="resumo-total"><dt>Fim do turno (estimado)</dt><dd>{moeda(saldo)}</dd></div>
          </dl>
          {gastoAviamento > dados.caixa && <p className="campo-erro">O aviamento é pago antes da venda e o caixa não cobre tudo: parte dos seringais não vai produzir.</p>}
          {saldo < 0 && <p className="campo-erro">As contas não fecham: a ação que ficar sem dinheiro falha, e sem luxo pago você perde 1★.</p>}
        </section>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="barra-salvar">
          <span className={`estado-salvo${sujo ? ' sujo' : ''}`} role="status">{status}</span>
          <button type="submit" className="botao acento" disabled={enviando}>
            {dados.ordemEnviada ? 'Atualizar ordens' : 'Enviar ordens'}
          </button>
        </div>
      </form>

      <section className="bloco" aria-labelledby="vt-t">
        <h3 id="vt-t">Adiantar o turno</h3>
        <Dica chave="votar" vistas={V} />
        <VotarTurno votos={dados.votos} />
      </section>
    </main>
  )
}
