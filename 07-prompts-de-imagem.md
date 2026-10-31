# Ouro Branco: prompts de imagem

> Material fixo, gerado antes do jogo (ver [05-identidade-visual.md](05-identidade-visual.md) §7). Os prompts usam só o nome e o papel público de cada personagem, sem segredos.

## Como gerar

- **Ferramenta:** ChatGPT (imagem) ou Midjourney v7. Ideogram e Flux também servem.
- **Consistência:** gere primeiro o retrato do Coronel. Quando ficar bom, use-o como referência de estilo em todos os outros (Midjourney: `--sref <url>`; ChatGPT: anexe a imagem e diga "mesmo estilo").
- **Prompts em inglês.** Os geradores respondem melhor.
- **Onde salvar:** `prototipo/img/retratos/<nome>.png` e `prototipo/img/rio.png`. Depois eu ligo no protótipo.

## Bloco de estilo (cole no fim de todo retrato)

```
19th-century steel engraving portrait, fine cross-hatching and stipple shading, two colours only: near-black ink (#1C1A17) on warm cream paper (#F3EBDD), no other colours, no gradients, head and shoulders, three-quarter view, plain cream background with the figure cut out cleanly, no frame, no text, no border, consistent line weight, newspaper illustration of 1898, sharp and modern print quality
```

Midjourney: acrescente `--ar 4:5 --style raw --no colour, text, frame, border`.

## Personagens jogáveis

| Arquivo | Prompt (antes do bloco de estilo) |
|---|---|
| `anacleto.png` | Portrait of a Brazilian rubber baron colonel, 1898 Manaus, about 55, heavy build, thick grey moustache, white linen suit, high collar, wide-brimmed planter's hat held at chest, stern self-assured gaze |
| `eulalia.png` | Portrait of a Brazilian merchant-banker widow, 1898 Manaus, about 45, dark hair in a tight bun, high-necked black dress with lace collar, small reading spectacles, ledger pen behind ear, calculating calm expression |
| `whitcombe.png` | Portrait of an English rubber exporter, 1898 Manaus, about 40, clean-shaven, thin face, pale linen suit, waistcoat with watch chain, pith helmet under arm, polite reserved smile |
| `teodoro.png` | Portrait of a Brazilian steamboat captain and shipowner, 1898 Amazon, about 50, weathered face, full dark beard, double-breasted captain's coat with brass buttons, peaked cap, squinting as if into river glare |
| `aristides.png` | Portrait of the governor of Amazonas state, 1898, about 60, bald crown, mutton-chop whiskers, formal frock coat, sash and medal, pince-nez, dignified politician's expression |
| `raimundo.png` | Portrait of a Brazilian newspaper owner, 1898 Manaus, about 35, slicked hair, thin moustache, sleeves rolled with arm garters, waistcoat, ink-stained fingers holding a folded newspaper, sharp curious eyes |
| `bento.png` | Portrait of a frontier strongman of the Acre territory, 1898, about 40, sunburnt, untrimmed black beard, leather bandolier over a rough shirt, slouch hat, revolver at hip, hard defiant stare |
| `ashby.png` | Portrait of a British naturalist explorer, 1898 Amazon, about 38, wiry, sandy beard, round wire spectacles, khaki field jacket with many pockets, botanical vasculum on shoulder strap, absorbed scholarly look |
| `farrow.png` | Portrait of an American railway engineer, 1898 Amazon, about 42, square jaw, short cropped hair, open-collar work shirt, suspenders, rolled survey map under arm, impatient pragmatic expression |
| `firmino.png` | Portrait of a rubber tapper leader from Ceará, 1898 Amazon, about 35, lean, sun-dark skin, short beard, straw hat, simple cotton shirt, rubber-tapping knife at belt, tired but resolute gaze |
| `hipolito.png` | Portrait of a Catholic bishop of Amazonas, 1898, about 58, round face, clean-shaven, zucchetto skullcap, pectoral cross on chain, cassock with cape, benevolent but watchful smile |
| `iracema.png` | Portrait of a river smuggler widow, 1898 Amazon, about 40, Indigenous and Portuguese features, long dark hair loosely tied, plain dark dress, shawl over shoulders, small canoe paddle resting on shoulder, guarded knowing look |
| `esteban.png` | Portrait of the Bolivian consul in Manaus, 1898, about 50, olive skin, neatly trimmed goatee, diplomatic dress coat with small rosette, gloves in hand, courteous unreadable expression |
| `ottavio.png` | Portrait of an Italian opera impresario, 1898 Manaus, about 45, curled moustache, flamboyant cravat, velvet-lapelled evening coat, top hat, theatrical confident smile |

## Personagens da cidade

| Arquivo | Prompt (antes do bloco de estilo) |
|---|---|
| `tabeliao.png` | Portrait of an elderly notary public, 1898 Manaus, thin, bald, half-moon spectacles, black frock coat, quill and stamp seal in hand |
| `telegrafista.png` | Portrait of a young woman telegraph operator, 1898 Manaus, hair pinned up, white blouse with puffed sleeves, headphones of an early telegraph receiver, attentive eyes |
| `odette.png` | Portrait of a French madame of a fashionable boarding house, 1898 Manaus, about 45, elaborate upswept hair, feathered ornament, low lace neckline, fan held half open, amused worldly look |
| `estivador.png` | Portrait of a dock worker at the Manaus floating port, 1898, muscular, bare forearms, sweat-soaked shirt, cloth tied on head, rubber bale on shoulder |
| `delegado.png` | Portrait of a Brazilian police chief, 1898 Manaus, about 50, thick moustache, military-style kepi, buttoned tunic, baton, suspicious narrowed eyes |
| `padre.png` | Portrait of a parish priest, 1898 Manaus, about 40, gaunt, cassock, rosary in hand, kind tired face |

## O Rio (mapa base)

O mapa vira **fundo** da aba Rio. Lotes, vapores e monogramas continuam em SVG por cima, então a imagem não pode ter rótulos nem ícones.

```
Hand-engraved antique map of the Amazon basin, 1898 style, flat modern print finish, two inks only: forest green (#2F5A3D) for jungle areas drawn as dense tiny tree stippling, and on warm cream paper (#F3EBDD). Rivers drawn as clean cream channels with fine ink outlines: Amazonas flowing west to east, Solimões, Rio Negro meeting it at Manaus (show the Meeting of the Waters with the Negro slightly darker brown-black #2A2622 and the Solimões muddy brown #6B5A3E), Madeira, Purus and Acre rivers branching south-west. Top-down view, vertical portrait composition, generous empty margins, no labels, no text, no compass rose, no sea monsters, no decorative border, no icons, no cities drawn
```

Midjourney: `--ar 3:4 --style raw --no text, labels, letters, border, compass`.

Se a geografia sair errada (é comum), peça só a **textura**: "dense jungle stippling texture, forest green on cream, seamless". Eu recorto com o traçado dos rios que já existe no SVG.

## Gravuras da Gazeta (opcional, depois)

Mesmo bloco de estilo, trocando "head and shoulders portrait" por "wide scene, 16:9". Cenas: vapor no porto flutuante, Teatro Amazonas à noite, seringueiro sangrando árvore, bolsa de Londres, telegrama, sementes em caixa de Kew, tribunal, febre na Santa Casa.
