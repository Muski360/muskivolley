# Arquitetura do Muski Volley

## Cliente, servidor e simulação

| Camada | Responsabilidade |
| --- | --- |
| **Cliente web** | TypeScript e Vite. O Phaser renderiza quadra, personagens, bola, animações e efeitos. Menus, configurações e HUD usam o DOM. |
| **Servidor de partidas** | Node.js e Colyseus. Controla as regras, as salas, as permissões, o relógio, os bots e os resultados. |
| **Simulação** | Representa a quadra em dois eixos no chão mais a altura. Calcula movimento, gravidade, alcance, contatos com a bola e colisões com a rede e o chão. O cliente projeta essas coordenadas na câmera 2.5D. |

A primeira versão usa um servidor com salas em memória. O navegador guarda nome e preferências locais. Consulte as APIs da versão adotada antes da implementação. [Phaser](https://github.com/phaserjs/phaser) · [Colyseus](https://docs.colyseus.io/)

## Contrato de multiplayer

- **Comandos do cliente.** Ações de sala incluem criar, entrar por código, gerenciar bots, ajustar buffs, iniciar e confirmar a revanche. Durante a partida, o cliente envia comandos de movimento e ações sequenciadas. O servidor valida a identidade, a fase, a permissão e o alcance antes de aceitar comandos relevantes à jogada.
- **Estado do servidor.** Atualizações sincronizam as quatro vagas, a fase, a contagem, o placar, as posições e a trajetória da bola. O servidor avança a simulação em passos fixos e determina as janelas de timing, os resultados dos contatos, a pontuação e os buffs. Os bots emitem intenções pelos mesmos sistemas de movimento e golpe usados pelos humanos.
- **Apresentação.** O cliente interpola bola e adversários e prevê o movimento local, reconciliando a posição com o estado confirmado. A avaliação de timing usa compensação limitada por latência no servidor. [Netcode do Colyseus](https://github.com/colyseus/docs/blob/master/pages/netcode/server-input.mdx)

## Sala e reconexão

A sala é privada e acessível pelo código de convite. Seu ciclo passa por **Lobby → Contagem → Partida → Resultado → Contagem da revanche**. O relógio do servidor orienta a contagem de três segundos para que todos vejam a mesma abertura. As regras de ocupação, início e confirmação constam nos [requisitos](requisitos.md).

Cada vaga tem identidade estável de equipe e posição, independente da sessão de rede. Na queda de um jogador em partida, o servidor troca o controlador daquela vaga por um bot e publica o aviso. Ao reconectar dentro da janela, o jogador recebe o estado atual e o servidor devolve o controle entre rallies. O placar e o estado do rally são mantidos durante a queda. As confirmações de revanche consideram os humanos presentes.

## Eventos de animação e texto

Cada evento de feedback carrega um identificador único, a ação, o resultado e a vaga ou equipe responsável. O cliente usa o evento para disparar a animação e associar o texto à ação no mundo. No ponto, o placar é atualizado pelo estado do servidor e o **+1** é disparado pelo evento de ponto confirmado.

O cliente trata cada evento uma única vez. Ao reconectar, usa o estado sincronizado para reconstruir o HUD e as poses atuais e evita repetir o feedback de eventos já exibidos. A preferência local define se o texto sobe, aparece estático ou fica oculto. Reduzir efeitos ou ocultar textos não altera as regras da partida. Consulte a [identidade visual](identidade-visual.md#animações-e-textos-de-ação).

## Verificação planejada

| Verificação | Cenários e resultados esperados |
| --- | --- |
| **Testes unitários da simulação** | `14–14` → `15–14` mantém a partida e `16–14` encerra. Verificar limites das janelas de timing, passe máximo **A** no saque viagem mesmo com buff, variações de levantamento e resultados de bloqueio. |
| **Playwright com quatro humanos** | Criar sala e conectar quatro contextos independentes pelo código. Conferir duas vagas por equipe, início restrito ao anfitrião e contagem sincronizada. Ocultar o código em um contexto e verificar que os outros continuam com a configuração própria. Conferir que a revanche aguarda todos os humanos presentes. |
| **Playwright com bots e reconexão** | Completar uma sala com um humano e três bots e conferir a gestão de bots por equipe. Em outra sala, com dois humanos e dois bots, derrubar uma conexão enquanto o outro humano observa a substituição. Reconectar em até 30 segundos e confirmar a retomada da mesma vaga entre rallies. |
| **Revisão visual** | Capturar HUD, contagem e lances em viewport desktop. Conferir animações, anel de timing, **A+** verde, **B** amarelo e **+1** na cor da equipe. Alternar os três modos de texto e conferir que reconectar não duplica o feedback. |

As verificações serão executadas quando houver uma versão jogável. Os resultados dos playtests orientarão o ajuste das janelas de timing, dos perfis dos bots e da duração dos buffs.
