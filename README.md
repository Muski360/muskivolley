# Muski Volley

Primeiro MVP visual de vôlei de praia arcade 2 × 2. Explore a quadra do Mirante da Costa e jogue um treino local contra bots.

## Executar no navegador

```sh
npm ci
npm run dev
```

Abra o endereço mostrado pelo Vite. Informe seu nome, clique em **Jogar**, complete a sala com bots e comece a partida.

| Controle | Ação |
| --- | --- |
| Setas | Mover durante o rally |
| `1`, `2`, `3` | Escolher saque Normal, Flutuante ou Viagem. Você também pode clicar no tipo de saque durante sua vez. |
| `Espaço` | Sacar, receber, levantar ou saltar para bloquear |
| `S` na janela de levantamento | Largada quando o passe permitir |
| `W`, `W` ou `W`, `S` no ar | Ataque forte ou shot |

Em **Configurações**, ajuste volume, efeitos, movimento reduzido e textos de ação. Use **Tela cheia** no cabeçalho da arena para ampliar a quadra e `Esc` para voltar. A partida vai a pelo menos 15 pontos, com dois de vantagem.

O anel de timing fica amarelo na janela do comando e verde na faixa ideal. Durante o saque normal, pressione `Espaço` quando estiver pronto. Para experimentar a recepção e os bloqueios, acompanhe a bola e as instruções da partida na lateral.

## Verificar

```sh
npm run build
npx playwright install chromium
npm test
```

O protótipo roda inteiramente no navegador. Ele usa uma dificuldade de bot e levantamento assistido. Salas online, reconexão, buffs e skins pertencem às próximas etapas.

## Arte

- [Mirante da Costa](public/assets/mirante.png). Cenário original criado com ImageGen e preparado em 480 × 270 pixels.
- [Atletas](src/athletes.ts). Quatro personagens originais com oito poses. Rede, bola, marcações e efeitos são desenhados pelo jogo.

<details>
<summary>Prompt do cenário</summary>

> Create an ORIGINAL 16:9 background plate for a polished 2.5D pixel-art beach volleyball video game, no UI. Style: exquisite late-1990s 32-bit arcade pixel art, crisp chunky hand placed pixels and deliberate clusters, extremely clear playable surface, vibrant warm and sophisticated coastal colors. Camera centered, fixed and elevated, looking diagonally down at the whole playing surface with the horizon visible at top. Scene: a sandy tournament terrace at a tropical Rio de Janeiro-inspired coastal overlook with deep cobalt blue ocean, layered green and slate mountains including a Sugarloaf-like silhouette behind the far-left, cloud banks, turquoise water and a hint of ivory coastal buildings. One landmark silhouette can be on a distant hill but keep it small. Golden afternoon, high-pigment light. The sandy open terrace itself is flat and EMPTY, with subtly stippled warm gold sand, spanning x=4% to 96% and y=39% to 100%. The section from x=12% to 88%, y=49% to 91% MUST be continuous clear empty golden sand of similar value, with no items or marks; a playable court with lines, middle net and sprites will be drawn in code later. Far edge can have a stone railing and an intimate row of tiny pixel spectators outside the playing area near y=33%-42%. Tropical palms and dark teal leaves frame the left and right outer borders only, some red hibiscus and darker foreground foliage just in the extreme bottom corners. Keep the playable sand expressive but clean. Attractive focal landscape plus uncluttered action space; the view is a game camera, not a poster illustration. No actual court lining, no net, no ball, no athletes inside the sand area, no overlaid graphics, no writing, no numbers, no logos, no menus, no border. Wide 16:9 cropping composition, full bleed.

</details>

Consulte a [identidade visual](docs/identidade-visual.md), os [requisitos](docs/requisitos.md) e a [arquitetura](docs/arquitetura.md) para o escopo completo.

O [plano de desenvolvimento](PLANO-MUSKI-VOLLEY.md) indica o que testar em cada etapa e qual é a entrega atual.
