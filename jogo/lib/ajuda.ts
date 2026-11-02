// Textos de ajuda (públicos, sem segredo): guia rápido de cada tela, dicas da primeira vez e tutorial dos primeiros turnos.
// Baseados em 04-regras-e-jogabilidade.md (modo piloto) e 06-guia-do-jogador.md.

export type Pagina = 'gazeta' | 'rio' | 'bolsa' | 'praca' | 'caderno' | 'ordens' | 'caixa'

export const AJUDA_PAGINAS: Record<Pagina, { titulo: string; itens: string[] }> = {
  gazeta: {
    titulo: 'A Gazeta',
    itens: [
      'É o jornal do turno que acabou de fechar. Leia primeiro: ela resume o que mudou.',
      'A manchete traz o preço da borracha e os grandes acontecimentos do Amazonas.',
      'Notas e boatos são rastros de ações de outros jogadores, quase sempre sem nome.',
      'A faixa dourada avisa quando alguém reivindicou o título ou está perto de vencer.',
      'A contagem no topo mostra quanto falta para o turno fechar. Ao zerar, uma tela avisa todos os jogadores de que o turno terminou e as ações estão sendo aplicadas.',
      'Em Próximos prazos você vê quando o turno fecha e pode votar para adiantá-lo.',
    ],
  },
  rio: {
    titulo: 'O rio',
    itens: [
      'Cada quadrado é um seringal, com as iniciais do dono. Os pontilhados são do sistema.',
      'Um seringal produz 3 lotes por turno, se você pagar o aviamento nas Ordens.',
      'Lote que não é vendido perde metade a cada turno.',
      'Para crescer, compre um seringal nas Ordens (6₵). Ele produz a partir do turno seguinte.',
    ],
  },
  bolsa: {
    titulo: 'A Bolsa',
    itens: [
      'O número grande é o preço do lote no último turno.',
      'Demanda é quanto a mesa inteira pode vender sem derrubar o preço. Vendeu mais, o preço cai para todos.',
      'A casa comercial paga 60% do preço. O exportador paga 75%, mas só compra 8 lotes por turno da mesa toda.',
      'Toda venda paga 10% de frete.',
      'Em Contratos ficam os acordos registrados com outros jogadores.',
    ],
  },
  praca: {
    titulo: 'A Praça',
    itens: [
      'Mostra quem visitou quem no último turno. As visitas são públicas; o que cada um descobriu, não.',
      'Os seis personagens em cena guardam pistas. Os pontos mostram sua relação com cada um, de 0 a 5.',
      'Uma visita pode render um boato, um indício ou uma prova sobre outro jogador.',
      'Para visitar, escolha a ação Visitar nas Ordens.',
    ],
  },
  caderno: {
    titulo: 'O Caderno',
    itens: [
      'É privado. Só você vê os seus marcos e as suas pistas.',
      'Os 3 selos são os marcos do seu objetivo secreto. Selo vermelho é marco cumprido.',
      'Marcos podem cair e voltar: são estados, não conquistas.',
      'Pistas vão de boato a indício a prova. Uma prova permite uma denúncia contra aquela pessoa.',
      'A partir do turno 8, com os 3 marcos cumpridos, você pode reivindicar a vitória nas Ordens.',
    ],
  },
  ordens: {
    titulo: 'As Ordens',
    itens: [
      'Até 2 ações abertas, que todos veem, e 1 ação secreta, que deixa rastro.',
      'Economia: pague o aviamento para produzir e diga quanto vender. Em branco vende tudo.',
      'Contratos: sua proposta vale se o outro aceitar no turno seguinte, e dura 2 turnos.',
      'Você pode mudar as ordens até o prazo. Quem não envia joga com a ordem padrão.',
    ],
  },
  caixa: {
    titulo: 'A caixa de entrada',
    itens: [
      'É o único canal de avisos do jogo. Nada chega por fora do app.',
      'Depois de cada turno chega o seu relatório: produção, vendas, visitas e contratos.',
      'Ao abrir a caixa, as mensagens novas ficam marcadas como lidas.',
    ],
  },
}

// Dicas mostradas na primeira vez que o jogador usa cada coisa.
export const DICAS = {
  'ordens-intro': {
    titulo: 'Suas primeiras ordens',
    texto: 'Comece simples: pague o aviamento e decida quanto vender. As ações são opcionais. Você pode mudar tudo até o prazo.',
  },
  investir: {
    titulo: 'Comprar seringal',
    texto: 'Custa 6₵ e produz 3 lotes por turno a partir do próximo, se você pagar o aviamento. Mais seringais também aumentam a demanda da mesa.',
  },
  doar: {
    titulo: 'Doar',
    texto: '3₵ por +1★. Prestígio abre portas e pesa em marcos, mas aumenta o luxo que você paga todo turno: 1₵ até 3★, 2₵ até 6★ e 4₵ acima disso.',
  },
  visitar: {
    titulo: 'Visitar alguém',
    texto: 'Pagar custa 3₵ e tem mais chance de prova. Cultivar custa 1₵ e melhora a relação. Fazer um favor é grátis. Pressionar é grátis, mas piora a relação. Todos veem a visita; só você vê a pista.',
  },
  denunciar: {
    titulo: 'Denunciar',
    texto: 'Exige uma prova contra o alvo, e a prova é gasta. O alvo perde 2★. Se ele estiver reivindicando, a reivindicação cai.',
  },
  secreta: {
    titulo: 'Ação secreta',
    texto: 'Ninguém vê quem fez, mas várias deixam rastro na Gazeta. Subornar melhora a relação com um personagem. Plantar boato pode tirar 1★ do alvo. Comprar silêncio apaga o último boato sobre você. Espionar revela a última visita do alvo. Contrabandear vende lotes a 75% do preço.',
  },
  exportador: {
    titulo: 'Vender ao exportador',
    texto: 'Paga 75% do preço, contra 60% da casa comercial, mas compra só 8 lotes por turno somando a mesa inteira. O que passar do limite não é vendido.',
  },
  contrato: {
    titulo: 'Propor contrato',
    texto: 'Você paga esse valor por turno durante 2 turnos, se o outro aceitar no turno seguinte. Só contrato registrado vale para os marcos; promessa fora do app não conta. Se faltar dinheiro para pagar, o contrato quebra e você perde 1★.',
  },
  resposta: {
    titulo: 'Responder a uma proposta',
    texto: 'Aceitando, você recebe o valor por 2 turnos e o contrato passa a contar para os marcos dos dois. Sem resposta, a proposta expira.',
  },
  reivindicar: {
    titulo: 'Reivindicar',
    texto: 'Todos ficam sabendo que foi você, mas não qual é o objetivo. Os outros têm um turno para derrubar um marco seu ou denunciar com prova. Se você resistir, vence.',
  },
  votar: {
    titulo: 'Adiantar o turno',
    texto: 'Se todos votarem, o turno fecha na hora e o próximo abre. Quem ainda não enviou ordens joga com a ordem padrão, então combine com o grupo antes.',
  },
} as const

export type ChaveDica = keyof typeof DICAS

// Tutorial dos primeiros turnos, mostrado na Gazeta (04, seção 8.2: liberação progressiva).
export const TUTORIAL_TURNOS: Record<number, { titulo: string; passos: { texto: string; href?: string }[] }> = {
  1: {
    titulo: 'Turno 1: o básico',
    passos: [
      { texto: 'Leia o Caderno: os 3 selos são os marcos do seu objetivo.', href: '/caderno' },
      { texto: 'Veja na Bolsa a demanda da mesa e o preço base.', href: '/bolsa' },
      { texto: 'Nas Ordens, pague o aviamento e decida quanto vender.', href: '/ordens' },
      { texto: 'Faça uma visita para ganhar a primeira pista.', href: '/praca' },
      { texto: 'Converse com o grupo por fora e proponha um contrato.' },
    ],
  },
  2: {
    titulo: 'Turno 2: segredos',
    passos: [
      { texto: 'Leia o relatório do turno 1 na caixa de entrada.', href: '/caixa' },
      { texto: 'Veja na Gazeta o preço que a mesa produziu e os boatos.' },
      { texto: 'Responda às propostas de contrato que recebeu.', href: '/ordens' },
      { texto: 'Experimente uma ação secreta: espionar o telégrafo ou plantar um boato.', href: '/ordens' },
    ],
  },
  3: {
    titulo: 'Turno 3: a mesa em jogo',
    passos: [
      { texto: 'Confira no Caderno quais marcos já estão cumpridos.', href: '/caderno' },
      { texto: 'Junte pistas: uma prova permite denunciar alguém.', href: '/praca' },
      { texto: 'Combine o volume de venda com o grupo: vender demais derruba o preço de todos.', href: '/bolsa' },
      { texto: 'A partir do turno 8, com os 3 marcos cumpridos, dá para reivindicar.' },
    ],
  },
}

export const ULTIMO_TURNO_TUTORIAL = 3

export const CHAVES_VALIDAS = new Set<string>([
  ...Object.keys(DICAS),
  ...Object.keys(TUTORIAL_TURNOS).map((t) => `tutorial-${t}`),
])
