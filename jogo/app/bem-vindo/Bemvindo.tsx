'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PAPEIS } from '@/lib/papeis'

type Personagem = (typeof PAPEIS)[number]

// Conteúdo de 06-guia-do-jogador.md, em quatro passos curtos.
const PASSOS = [
  {
    titulo: 'Seu personagem',
    texto: 'Você tem uma fortuna, um segredo e uma ambição. Seu objetivo é secreto: só você o conhece.',
  },
  {
    titulo: 'Como se vence',
    texto: 'Cumpra os 3 marcos do seu objetivo antes dos outros. Quem cumprir primeiro vence.',
  },
  {
    titulo: 'Um turno',
    texto: 'Três turnos por semana: terça, quinta e domingo, às 21h. Você lê a Gazeta, analisa o tabuleiro, conversa por fora e decide. Promessa não vale nada: só vale o contrato registrado no app.',
  },
  {
    titulo: 'Dinheiro e segredos',
    texto: 'Todos vendem borracha ao mesmo tempo. Se a mesa vender demais, o preço cai para todos. Visite personagens da cidade para conseguir pistas, e toda ação secreta deixa rastro.',
  },
]

export default function Bemvindo({ personagem }: { personagem: Personagem }) {
  const router = useRouter()
  const [passo, setPasso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const total = PASSOS.length + 1 // o último passo é a caixa de entrada

  async function concluir() {
    setEnviando(true)
    await fetch('/api/eu/bem-vindo', { method: 'POST' })
    router.push('/caixa')
  }

  const ultimo = passo === total - 1
  return (
    <main className="tela">
      <header className="topo"><span>Ouro Branco</span><span>{passo + 1} de {total}</span></header>

      <div className="passos" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i <= passo ? 'on' : ''} />)}
      </div>

      <section className="passo" aria-live="polite">
        {passo === 0 ? (
          <>
            <img className="retrato-grande" src={`/retratos/${personagem.retrato}.jpg`} alt={`Retrato de ${personagem.nome}`} />
            <p className="papel-nome">{personagem.nome}</p>
            <p className="papel-funcao">{personagem.papel}</p>
            <p style={{ marginTop: 'var(--space-md)' }}>{PASSOS[0].texto}</p>
          </>
        ) : ultimo ? (
          <>
            <h2>Caixa de entrada</h2>
            <p>Os avisos da partida chegam só aqui. Não há notificação no celular: abra o app para ver o que mudou.</p>
          </>
        ) : (
          <>
            <h2>{PASSOS[passo].titulo}</h2>
            <p>{PASSOS[passo].texto}</p>
          </>
        )}
      </section>

      <div style={{ marginTop: 'var(--space-xl)' }}>
        {ultimo ? (
          <button type="button" className="botao acento" onClick={concluir} disabled={enviando}>
            {enviando ? 'Abrindo...' : 'Entrar no jogo'}
          </button>
        ) : (
          <>
            <button type="button" className="botao acento" onClick={() => setPasso(passo + 1)}>Próximo</button>
            {passo > 0 && <button type="button" className="botao contorno" onClick={() => setPasso(passo - 1)}>Voltar</button>}
          </>
        )}
      </div>
    </main>
  )
}
