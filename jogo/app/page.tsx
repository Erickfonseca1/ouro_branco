import Link from 'next/link'

export default function Inicio() {
  return (
    <main className="tela inicio">
      <h1>Ouro Branco</h1>
      <p className="lead">Manaus, 1890. A borracha paga tudo, e alguém à mesa vai ter de perder.</p>
      <div className="regua">
        <Link href="/criar" className="botao acento">Criar jogo</Link>
        <Link href="/entrar" className="botao contorno">Entrar na partida</Link>
      </div>
    </main>
  )
}
