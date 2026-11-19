# Identidade visual do Muski Volley

## Quadra do Mirante

O Muski Volley é um arcade de vôlei de praia em 3D estilizado, com formas limpas e cores de uma ilustração esportiva. A primeira quadra fica num mirante inspirado no litoral carioca. O mar, os morros e a vegetação enquadram a areia. Use menos contraste no cenário do que na quadra para que o olhar encontre a bola, a rede e os atletas.

A cena mantém a proporção **16:9**, com resolução adaptada à área disponível e contornos suavizados. A opção de tela cheia amplia a cena e mantém os controles essenciais visíveis. Os modelos originais preservam silhuetas distintas e poderão ser exportados em GLB na etapa de arte final.

## Referências pesquisadas

1. Em Nintendo Switch Sports, as linhas da quadra e as poses de cada fundamento ajudam a identificar a jogada. O Muski Volley aplica esse princípio com marcações firmes na areia e gestos distintos para os contatos. [Vôlei em Nintendo Switch Sports](https://www.nintendo.com/jp/switch/as8sa/volleyball/index.html)
2. Super Mega Baseball 4 dá personalidade aos atletas por meio das proporções e dos uniformes. O Muski Volley usa silhuetas próprias e cores de equipe fáceis de distinguir à distância. [Super Mega Baseball 4](https://www.ea.com/games/super-mega-baseball/super-mega-baseball-4?setLocale=en-us)

A câmera de trás fica elevada e voltada para a rede, com o jogador próximo ao centro da metade inferior. A lateral abre a visão da quadra de 10 × 20 m. Nas duas, o enquadramento deixa espaço para os passes mais altos. As linhas da areia, as marcas de mira e a sombra da bola orientam a leitura de altura e profundidade. `N` troca a câmera instantaneamente.

## Leitura da partida

- **Bola e mira.** A bola tem gomos contrastantes, sombra no chão e indicação de queda na versão com partidas. A mira usa um anel no ponto correspondente ao cursor.
- **Atletas e equipes.** Uniformes vermelhos e azuis, acompanhados de nomes e marcas de equipe. A silhueta deixa claras as poses de saque, manchete, peixinho, levantamento, ataque e bloqueio.
- **HUD.** O placar, a contagem e o estado da partida ficam em HTML. Textos e controles não dependem da resolução interna da cena.
- **Ações.** Mostrar avisos compactos de timing e resultado, incluindo **A+**, **A**, **B**, **Erro**, **Largada**, **Cravada** e **Bloqueio**. Em **Textos de ação**, o jogador escolhe apresentação animada, estática ou desligada. Movimento reduzido usa o modo estático para os textos animados.

O [plano de desenvolvimento](../PLANO-MUSKI-VOLLEY.md) indica quais recursos já estão em teste.
