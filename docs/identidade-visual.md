# Identidade visual do Muski Volley

## Quadra e câmera

O Muski Volley tem visual arcade em pixel art 2.5D. A primeira quadra é de areia, em um mirante inspirado no litoral carioca. Mar azul, morros e vegetação tropical dão profundidade ao cenário. A referência visual orienta o enquadramento. A quadra, o cenário, os personagens e a interface terão arte original.

A câmera fica fixa e elevada, com a quadra inteira visível. A rede atravessa o centro da imagem e divide as equipes em esquerda e direita. O enquadramento usa uma base de **480 × 270** em **16:9**, com escala inteira quando couber e filtragem de pixels sem suavização. A interface mantém os textos legíveis separadamente da escala do cenário.

As nuvens se deslocam suavemente e ficam estáticas com movimento reduzido. A folhagem dos cantos fica em primeiro plano, acima das linhas quando houver sobreposição. O modo **Tela cheia** mantém o enquadramento 16:9 e deixa o placar e os controles acessíveis.

## Cor e leitura da partida

- **Cenário.** Areia dourada, oceano azul e vegetação verde compõem a paleta. Os detalhes do fundo ficam visualmente mais discretos que a bola, a rede e os jogadores.
- **Equipes.** Uniformes vermelhos e azuis identificam os lados. O jogador também reconhece a equipe pelo nome no HUD e pela marcação junto aos personagens.
- **Nomes em quadra.** Use texto nítido em HTML sobre a quadra, junto aos pés dos atletas, com fundo escuro e marcação na cor da equipe.
- **Bola.** Contorno, sombra no chão e indicador de queda ajudam a distinguir altura, profundidade e ponto de chegada.
- **HUD.** No canto superior esquerdo, duas colunas exibem **Equipe Vermelha** e **Equipe Azul**, o placar e os dois nomes de cada lado. A contagem `3 · 2 · 1` ocupa o centro antes do primeiro saque. Um aviso compacto informa desconexões sem bloquear a partida.

## Animações e textos de ação

Cada saque, recepção, levantamento, ataque e bloqueio tem uma animação própria do personagem. A pose e o movimento deixam claro o que aconteceu, inclusive em golpes fracos e erros de timing. Um anel se fecha perto da bola ou do jogador para indicar o momento da ação. Ao resolver o lance, um texto curto salta perto de quem fez a jogada ou, no caso de um ponto, junto à equipe que marcou.

| Ação | Feedback na quadra |
| --- | --- |
| Saque | **Normal**, **Flutuante** ou **Viagem**. Quando o saque falhar, **Erro de saque**. |
| Recepção | **A+** em verde, **A** em turquesa, **B** em amarelo e **Erro** em coral. |
| Levantamento e ataque | **Levantamento**, **Levantamento perfeito**, **Ataque forte**, **Shot**, **Ataque fraco** ou **Largada**, conforme o lance. |
| Bloqueio | **Amorteceu**, **Bloqueio** ou **Explorou o bloqueio**, conforme o contato. |
| Ponto | **+1** em vermelho para a Equipe Vermelha e em azul para a Equipe Azul. |

Use contorno para separar o texto da areia e do cenário. Posicione o texto de modo que a bola, o anel de timing e o HUD permaneçam visíveis. O menu **Textos de ação** controla a apresentação.

| Modo | Comportamento |
| --- | --- |
| **Animados** | Padrão. O texto sobe brevemente e desaparece. |
| **Estáticos** | O texto aparece pelo mesmo intervalo, sem deslocamento. O modo de movimento reduzido aplica essa apresentação quando **Animados** estiver selecionado. |
| **Desligados** | Oculta os textos de ação, incluindo **+1**. |

As animações dos personagens, o anel de timing e o placar permanecem visíveis em todos os modos.

## Skins futuras

Uma atualização futura permitirá escolher skins para o jogador. As variações serão cosméticas e preservarão a silhueta, a identificação da equipe e os tempos das animações. A primeira versão usa os uniformes padrão.

Consulte os [requisitos](requisitos.md) e a [arquitetura](arquitetura.md) para as regras e a origem do feedback visual.
