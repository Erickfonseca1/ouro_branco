// Os 14 papéis jogáveis, na ordem de entrada (02-personagens-e-relacoes.md, resumo).
// Com N jogadores, entram os papéis 1 a N.
export const PAPEIS = [
  { id: 1, nome: 'Coronel Anacleto Vasconcelos Brandão', papel: 'Coronel seringalista', retrato: 'anacleto' },
  { id: 2, nome: 'Dona Eulália Saraiva', papel: 'Casa aviadora', retrato: 'eulalia' },
  { id: 3, nome: 'Mr. Edmund Whitcombe', papel: 'Exportador estrangeiro', retrato: 'whitcombe' },
  { id: 4, nome: 'Capitão Teodoro Amaral', papel: 'Armador dos vapores', retrato: 'teodoro' },
  { id: 5, nome: 'Dr. Aristides Monforte', papel: 'Governador', retrato: 'aristides' },
  { id: 6, nome: 'Raimundo Leite', papel: 'Dono do jornal', retrato: 'raimundo' },
  { id: 7, nome: 'Bento Galvão', papel: 'Caudilho do Acre', retrato: 'bento' },
  { id: 8, nome: 'Dr. Matias Ashby', papel: 'Naturalista', retrato: 'ashby' },
  { id: 9, nome: 'Silas Farrow', papel: 'Engenheiro da ferrovia', retrato: 'farrow' },
  { id: 10, nome: 'Firmino Cabral, "o Cearense"', papel: 'Líder seringueiro', retrato: 'firmino' },
  { id: 11, nome: 'Dom Hipólito Arcoverde', papel: 'Bispo', retrato: 'hipolito' },
  { id: 12, nome: 'Iracema Bastos, "a Viúva do Furo"', papel: 'Contrabandista', retrato: 'iracema' },
  { id: 13, nome: 'Don Esteban Arriaga', papel: 'Cônsul da Bolívia', retrato: 'esteban' },
  { id: 14, nome: 'Ottavio Ruggieri', papel: 'Empresário do Teatro', retrato: 'ottavio' },
]

export function papel(id: number | null) {
  return PAPEIS.find((p) => p.id === id) ?? null
}
