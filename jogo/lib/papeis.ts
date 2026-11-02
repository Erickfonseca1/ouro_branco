// Os 14 papéis jogáveis, na ordem de entrada (02-personagens-e-relacoes.md, resumo).
// Com N jogadores, entram os papéis 1 a N.
export const PAPEIS = [
  { id: 1, curto: 'Coronel Anacleto', nome: 'Coronel Anacleto Vasconcelos Brandão', papel: 'Coronel seringalista', retrato: 'anacleto' },
  { id: 2, curto: 'Dona Eulália', nome: 'Dona Eulália Saraiva', papel: 'Casa aviadora', retrato: 'eulalia' },
  { id: 3, curto: 'Mr. Whitcombe', nome: 'Mr. Edmund Whitcombe', papel: 'Exportador estrangeiro', retrato: 'whitcombe' },
  { id: 4, curto: 'Capitão Teodoro', nome: 'Capitão Teodoro Amaral', papel: 'Armador dos vapores', retrato: 'teodoro' },
  { id: 5, curto: 'Dr. Aristides', nome: 'Dr. Aristides Monforte', papel: 'Governador', retrato: 'aristides' },
  { id: 6, curto: 'Raimundo Leite', nome: 'Raimundo Leite', papel: 'Dono do jornal', retrato: 'raimundo' },
  { id: 7, curto: 'Bento Galvão', nome: 'Bento Galvão', papel: 'Caudilho do Acre', retrato: 'bento' },
  { id: 8, curto: 'Dr. Ashby', nome: 'Dr. Matias Ashby', papel: 'Naturalista', retrato: 'ashby' },
  { id: 9, curto: 'Silas Farrow', nome: 'Silas Farrow', papel: 'Engenheiro da ferrovia', retrato: 'farrow' },
  { id: 10, curto: 'Firmino, o Cearense', nome: 'Firmino Cabral, "o Cearense"', papel: 'Líder seringueiro', retrato: 'firmino' },
  { id: 11, curto: 'Dom Hipólito', nome: 'Dom Hipólito Arcoverde', papel: 'Bispo', retrato: 'hipolito' },
  { id: 12, curto: 'Iracema, a Viúva do Furo', nome: 'Iracema Bastos, "a Viúva do Furo"', papel: 'Contrabandista', retrato: 'iracema' },
  { id: 13, curto: 'Don Esteban', nome: 'Don Esteban Arriaga', papel: 'Cônsul da Bolívia', retrato: 'esteban' },
  { id: 14, curto: 'Ottavio Ruggieri', nome: 'Ottavio Ruggieri', papel: 'Empresário do Teatro', retrato: 'ottavio' },
]

export function papel(id: number | null) {
  return PAPEIS.find((p) => p.id === id) ?? null
}

// "Matheus – Coronel Anacleto": o jogador sempre aparece junto do personagem que joga.
export function rotuloJogador(nome: string, papelId: number | null) {
  const p = papel(papelId)
  return p ? `${nome} – ${p.curto}` : nome
}
