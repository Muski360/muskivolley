# Requisitos do Muski Volley

O jogo é um vôlei de praia arcade 2x2 no navegador. As partidas usam teclado no desktop e acomodam até quatro pessoas, com bots nas vagas que o anfitrião preencher.

## Tela inicial e lobby

1. A tela inicial permite escolher o nome de exibição, abrir **Configurações** e selecionar **Jogar**.
2. **Jogar** oferece **Criar sala** e **Entrar com código**. Quem cria entra sozinho como anfitrião. Quem recebe um convite informa o código para entrar na sala privada.
3. O código fica no topo do lobby. O botão com ícone de olho oculta ou revela o código somente naquele navegador, para que a pessoa possa protegê-lo durante uma transmissão.
4. O HUD no canto superior esquerdo mostra placar, equipes e os dois lugares de cada lado, identificando jogadores, bots e vagas livres.
5. **Configurações** oferece volume, qualidade dos efeitos, movimento reduzido e **Textos de ação**. As escolhas são locais. Os textos começam em **Animados**. Com movimento reduzido, a opção **Animados** usa a apresentação estática. Consulte a [identidade visual](identidade-visual.md#animações-e-textos-de-ação).

## Equipes e bots

Cada equipe tem duas vagas. O anfitrião pode adicionar, remover e mudar a dificuldade dos bots de cada lado. **Completar com bots** preenche todas as vagas livres com bots **Médios** e preserva os ocupantes atuais. Só o anfitrião vê **Começar partida**. O servidor exige duas vagas ocupadas de cada lado para iniciar a contagem.

| Dificuldade | Comportamento esperado |
| --- | --- |
| **Fácil** | Reage mais devagar, cobre menos espaço e prefere golpes seguros, com maior variação de timing. |
| **Médio** | Cobre a posição esperada e alterna jogadas simples com tentativas de golpes mais difíceis. |
| **Difícil** | Antecipa melhor a trajetória, se posiciona mais cedo e executa ações de timing exigente com mais frequência. |
| **Brutal** | Tem a reação e o timing mais precisos e escolhe golpes de acordo com o espaço deixado pela defesa. |

Todos os perfis seguem as mesmas regras de movimento, alcance e timing dos humanos. Os parâmetros de reação, posicionamento, escolha de golpes e precisão de cada perfil serão ajustados em playtests.

## Partida, desconexão e revanche

- **Início e vitória.** Uma contagem estilizada de três segundos antecede o primeiro saque. Cada rally vale um ponto. Vence a equipe com pelo menos 15 pontos e dois de vantagem, sem teto adicional. De `14–14`, o placar `15–14` mantém a partida e `16–14` encerra.
- **Desconexão.** Durante a partida, um aviso identifica quem saiu e um bot assume imediatamente a mesma vaga. O substituto usa a dificuldade de um bot da própria equipe, se houver, ou de um bot adversário. Na ausência de outro bot, usa **Médio**. Quem reconectar em até 30 segundos reassume a vaga entre rallies.
- **Sucessão do anfitrião.** Se o anfitrião sair, o humano conectado há mais tempo assume suas permissões.
- **Revanche.** Na tela de resultado, cada humano presente pode clicar em **Jogar novamente**. Os bots confirmam automaticamente. Quando todos os humanos presentes confirmarem, o placar zera e começa uma nova contagem de três segundos com as mesmas equipes e vagas.

## Controles e funções

| Comando | Uso |
| --- | --- |
| Setas | Movimento em quatro direções na quadra. |
| `1`, `2`, `3` | Selecionar saque Normal, Flutuante ou Viagem, respectivamente. |
| `Espaço` | Confirmar o saque, receber, levantar ou saltar para bloquear, conforme a fase e a posição. |
| `S` na janela do levantador | Largar a bola quando a qualidade do passe permitir. |
| `W, W` ou `W, S` na janela aérea do atacante | Executar um ataque forte ou um shot, respectivamente. |

As funções mudam por rally. Qualquer jogador pode receber, o parceiro assume o levantamento com salto automático e quem recebeu volta para atacar. Os dois jogadores podem bloquear quando estiverem perto da rede.

## Fundamentos e timing

| Fundamento | Regra |
| --- | --- |
| **Saque normal** | Cruza a rede com trajetória lenta quando executado. |
| **Saque flutuante** | Exige mais precisão e pode falhar. A janela de recepção adversária é menor. |
| **Saque viagem** | Tem a maior dificuldade de execução, a menor janela de recepção e limita o passe adversário a **A**. |
| **Recepção** | A bola precisa estar ao alcance do jogador. A proximidade do comando com o instante ideal produz **A+**, **A**, **B** ou **Erro**. **A+** facilita a largada do levantador e torna perfeito o levantamento executado. **A** permite a largada com timing mais apertado e favorece bolas de boa qualidade. **B** impede a largada do levantador. No **Erro**, a bola pode desviar ou cair. |
| **Levantamento** | O levantador salta automaticamente. A janela do levantamento é ampla e o comando na faixa ideal produz uma bola perfeita. |
| **Ataque** | O atacante sobe para o contato. Na janela aérea, `W, W` dá potência e `W, S` produz um shot. Sem comando, o contato ao alcance gera um ataque fraco. Um levantamento perfeito dificulta a recepção e o bloqueio. |
| **Bloqueio** | Saltar com `Espaço` perto da rede e no momento correto pode amortecer a bola para a defesa, devolver diretamente o ataque ou desviar para fora e dar o ponto à equipe atacante. |

Cada ação tem animação e texto de resultado conforme a [identidade visual](identidade-visual.md#animações-e-textos-de-ação). As janelas de timing são valores de balanceamento a validar em playtests.

## Buffs de quadra

O anfitrião pode ligar ou desligar os buffs no lobby. Eles começam desligados. Quando ativos, aparecem oportunidades espelhadas de coleta para os dois lados. Os efeitos temporários melhoram a velocidade, a altura de salto ou a qualidade do passe. O buff de passe concede **A+** em recepções válidas. Contra o saque viagem, o limite de **A** prevalece. A duração dos buffs será ajustada em playtests.

A primeira versão terá uma quadra e controles de teclado no desktop. Controles de toque e seleção de skins ficam para atualizações futuras.
