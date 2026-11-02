'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { anoDoTurno } from '@/lib/tempo'

type Props = {
  turno: number
  prazo: string // ISO
  agora: number // hora do servidor (ms) quando a página foi gerada
  status: string
  semTexto?: boolean // só o aviso de tela cheia, sem a contagem no cabeçalho
}

type Fase = 'contando' | 'fechando' | 'pronto'

const POLL_LENTO_MS = 8000 // detecta turnos fechados antes do prazo (votação ou criador)
const POLL_RAPIDO_MS = 1500 // depois de zerar, até o servidor aplicar as ações
const MIN_FECHANDO_MS = 2500 // o aviso "aplicando as ações" fica o bastante para ser lido

// O refresh que traz o turno novo pode remontar a página e perder o estado do React.
// Por isso o aviso "turno terminou" fica em sessionStorage até o jogador tocar em "Ler a Gazeta".
const CHAVE = 'ouro-fechamento'
type Aviso = { antes: number; turno: number; status: string }
function lerAviso(): Aviso | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const { aviso, em } = JSON.parse(bruto) as { aviso: Aviso; em: number }
    return Date.now() - em < 10 * 60 * 1000 ? aviso : null
  } catch {
    return null
  }
}
function gravarAviso(aviso: Aviso | null) {
  try {
    if (aviso) sessionStorage.setItem(CHAVE, JSON.stringify({ aviso, em: Date.now() }))
    else sessionStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: o aviso só vale enquanto a página não remontar
  }
}

function formatar(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d > 0 ? `${d}d ` : ''}${dois(Math.floor((s % 86400) / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`
}

// Contagem regressiva ao vivo, só em texto. Corrige o relógio do aparelho com a hora do servidor.
export function Contagem({ prazo, agora }: { prazo: string; agora: number }) {
  const [restante, setRestante] = useState(() => new Date(prazo).getTime() - agora)
  useEffect(() => {
    const deslocamento = agora - Date.now()
    const tick = () => setRestante(new Date(prazo).getTime() - (Date.now() + deslocamento))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [prazo, agora])
  return <span className={`contagem${restante < 10 * 60 * 1000 ? ' urgente' : ''}`}>{formatar(restante)}</span>
}

// Contagem do turno e tela cheia global quando ele fecha. O aviso aparece ao chegar a zero e também quando
// outro jogador fecha o turno antes do prazo (todos votaram ou o criador fechou): todos ficam em sincronia.
export default function RelogioTurno({ turno, prazo, agora, status, semTexto }: Props) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('contando')
  const [novo, setNovo] = useState<Aviso | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const inicioFechando = useRef<number | null>(null)
  const visto = useRef(`${turno}:${status}`) // último estado (turno:status) que o jogador já reconheceu
  const aberto = status === 'aberto'

  useEffect(() => {
    visto.current = `${turno}:${status}`
    // Retoma o aviso se a página remontou depois do refresh: ele só some quando o jogador toca em "Ler a Gazeta".
    const pendente = lerAviso()
    if (pendente && pendente.turno === turno && pendente.status === status) {
      setNovo(pendente)
      setFase('pronto')
    }
  }, [turno, status])

  useEffect(() => {
    if (!aberto) return
    let vivo = true
    let consultando = false
    let ultimaConsulta = 0
    const deslocamento = agora - Date.now()
    const alvo = new Date(prazo).getTime()

    async function consultar() {
      if (consultando) return
      consultando = true
      ultimaConsulta = Date.now()
      try {
        const res = await fetch('/api/partida/status', { cache: 'no-store' })
        if (!res.ok || !vivo) return
        const s = (await res.json()) as { turno: number; status: string }
        if (`${s.turno}:${s.status}` !== visto.current) {
          const aviso = { antes: turno, turno: s.turno, status: s.status }
          gravarAviso(aviso)
          setNovo(aviso)
          // Fechamento antecipado (votação ou criador) também passa pela tela "aplicando as ações".
          if (inicioFechando.current === null) inicioFechando.current = Date.now()
          setFase((f) => (f === 'contando' ? 'fechando' : f))
          const resta = Math.max(0, MIN_FECHANDO_MS - (Date.now() - inicioFechando.current))
          visto.current = `${s.turno}:${s.status}` // para de consultar enquanto espera
          setTimeout(() => {
            if (!vivo) return
            setFase('pronto')
            router.refresh() // atualiza o que está por trás do aviso
          }, resta)
        }
      } catch {
        // sem rede: tenta de novo no próximo ciclo
      } finally {
        consultando = false
      }
    }

    const id = setInterval(() => {
      if (document.hidden) return
      const zerou = alvo - (Date.now() + deslocamento) <= 0
      if (zerou && inicioFechando.current === null) inicioFechando.current = Date.now()
      if (zerou) setFase((f) => (f === 'contando' ? 'fechando' : f))
      const espera = zerou ? POLL_RAPIDO_MS : POLL_LENTO_MS
      if (Date.now() - ultimaConsulta >= espera) consultar()
    }, 500)
    const aoVoltar = () => {
      if (!document.hidden) consultar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [turno, prazo, agora, aberto, router])

  useEffect(() => {
    if (fase === 'pronto') botao.current?.focus()
  }, [fase])

  const fim = novo ? novo.status !== 'aberto' : false

  return (
    <>
      {!semTexto && (
        <span className="prazo">
          {aberto ? <>Fecha em <Contagem prazo={prazo} agora={agora} /></> : 'Partida encerrada'}
        </span>
      )}
      {fase !== 'contando' && (
        <div className="fechamento" role="alertdialog" aria-modal="true" aria-labelledby="fech-t" aria-describedby="fech-d">
          <div className="fechamento-miolo">
            <p className="fechamento-ano">{anoDoTurno(turno)}</p>
            <h2 id="fech-t">{fase === 'fechando' ? `O turno ${novo?.antes ?? turno} terminou` : fim ? 'A partida acabou' : `Turno ${novo?.turno} aberto`}</h2>
            {fase === 'fechando' ? (
              <>
                <span className="fechamento-pulso" aria-hidden="true" />
                <p id="fech-d" aria-live="assertive">Aplicando as ações de todos os jogadores…</p>
              </>
            ) : (
              <>
                <p id="fech-d" aria-live="assertive">
                  {fim ? 'As ações do último turno foram aplicadas.' : `O turno ${novo?.antes ?? turno} terminou e as ações foram aplicadas. A Gazeta já saiu.`}
                </p>
                <button
                  ref={botao}
                  type="button"
                  className="botao"
                  onClick={() => {
                    if (novo) visto.current = `${novo.turno}:${novo.status}`
                    gravarAviso(null)
                    inicioFechando.current = null
                    setFase('contando')
                    router.push('/gazeta')
                    router.refresh()
                  }}
                >
                  Ler a Gazeta
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
