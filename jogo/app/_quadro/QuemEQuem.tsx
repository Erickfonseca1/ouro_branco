import type { Visao } from '@/lib/estado'

// Lista fixa de quem joga com qual personagem, com a mesma cor e as mesmas iniciais do mapa.
export function QuemEQuem({ jogadores, titulo = 'Quem é quem' }: { jogadores: Visao['jogadores']; titulo?: string }) {
  return (
    <section className="bloco" aria-labelledby="qq-t">
      <h3 id="qq-t">{titulo}</h3>
      <ul className="quem-lista">
        {jogadores.map((j) => (
          <li key={j.id}>
            <span className="monograma" style={{ borderColor: `var(${j.cor})` }} aria-hidden="true">{j.iniciais}</span>
            <span>
              <strong>{j.nome}</strong>
              {j.personagem ? <> – {j.personagem.curto}</> : <span className="ajuda"> – ainda não entrou</span>}
              {j.eu && <span className="ajuda"> (você)</span>}
              {j.personagem && <span className="quem-funcao">{j.personagem.papel}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
