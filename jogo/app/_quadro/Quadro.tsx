import Link from 'next/link'
import { formatarPrazo, faltam } from '@/lib/tempo'
import type { Visao } from '@/lib/estado'

const ABAS = [
  { href: '/gazeta', nome: 'Gazeta' },
  { href: '/rio', nome: 'Rio' },
  { href: '/bolsa', nome: 'Bolsa' },
  { href: '/praca', nome: 'Praça' },
  { href: '/caderno', nome: 'Caderno' },
]

export function anoDoTurno(turno: number) {
  return 1890 + 2 * (turno - 1)
}

// Moldura de todas as telas de jogo: cabeçalho com o turno, navegação inferior e botão Ordens.
export function Quadro({ v, ativo, children }: { v: Visao; ativo: string; children: React.ReactNode }) {
  const { partida, eu } = v
  return (
    <div className="quadro">
      <header className="topo">
        <Link href="/gazeta" className="marca">Ouro Branco</Link>
        <nav className="topo-acoes" aria-label="Atalhos">
          <Link href="/caixa" className="caixa-icone" aria-label={`Caixa de entrada, ${eu.naoLidas} não lidas`}>
            Caixa{eu.naoLidas > 0 && <span className="pend">{eu.naoLidas}</span>}
          </Link>
        </nav>
      </header>

      <div className="barra-turno">
        <span>Turno {partida.turno}, {anoDoTurno(partida.turno)}</span>
        <span>{eu.nome}</span>
        <span className="prazo">
          {partida.status === 'aberto' ? `Fecha ${formatarPrazo(partida.prazo)}, ${faltam(partida.prazo)}` : 'Partida encerrada'}
        </span>
      </div>

      <main className="tela-jogo">{children}</main>

      <nav className="abas" aria-label="Telas do jogo">
        {ABAS.map((a) => (
          <Link key={a.href} href={a.href} aria-current={ativo === a.href.slice(1) ? 'page' : undefined}>
            {a.nome}
          </Link>
        ))}
      </nav>
      {partida.status === 'aberto' && (
        <div className="fab">
          <Link href="/ordens" className="botao acento" aria-label={v.ordemEnviada ? 'Ordens enviadas, alterar' : 'Ordens pendentes'}>
            Ordens{!v.ordemEnviada && <span className="pend">!</span>}
          </Link>
        </div>
      )}
    </div>
  )
}
