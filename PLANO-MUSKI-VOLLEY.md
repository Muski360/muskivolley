# Plano de desenvolvimento do Muski Volley

**Etapa atual:** 0 — acabamento visual do MVP. **Status:** aguardando seu teste.

A meta da versão 1.0 é um jogo de vôlei de praia 2×2 no navegador, com salas privadas pela internet, quatro vagas para humanos ou bots, gameplay baseado em timing, placar, reconexão e revanche. Use a [identidade visual](docs/identidade-visual.md), os [requisitos](docs/requisitos.md) e a [arquitetura](docs/arquitetura.md) como referência.

## Como cada etapa é aprovada

1. Implementar uma etapa por vez, rodar o build e os testes aplicáveis e entregar uma prévia com um roteiro curto de teste.
2. Você testa e responde **OK** ou descreve o que quer mudar. Se pedir ajustes, a mesma etapa continua aberta até que você aprove a nova versão.
3. Após seu **OK**, registrar a etapa como **Aprovada** e iniciar a próxima. Testes automatizados servem como evidência da entrega. A aprovação para avançar vem de você.

Para abrir o jogo localmente, rode `npm ci` na primeira execução e `npm run dev`. Use `npm run build` e `npm test` para verificar o projeto. O [README](README.md) traz os controles e o preparo do Playwright.

## 0. Acabamento visual do MVP · Aguardando teste

**Entrega.** Nuvens com deslocamento discreto, folhagem em primeiro plano sobre as linhas, nomes legíveis em qualquer escala da quadra e botão **Tela cheia** com acesso ao placar e aos controles. A opção de movimento reduzido deixa as nuvens paradas.

**Seu teste.** Observe o céu por alguns segundos, confira os nomes e as linhas nos cantos. Comece um treino, entre em tela cheia, saque com `Espaço` e volte pelo botão ou por `Esc`. Ative movimento reduzido em **Configurações** e observe o céu de novo.

## 1. Gameplay completo no treino local · Pendente

**Entrega.** Consolidar o motor de simulação de quadra, bola, saltos, rede e contatos com testes reproduzíveis. Completar os três saques, as quatro notas de recepção, o levantamento, a largada do levantador, os ataques `W, W` e `W, S` e os três resultados de bloqueio. Mostrar um sinal de timing, animação e feedback para cada ação. Fechar a regra de 15 pontos com dois de vantagem e a revanche local.

**Seu teste.** Jogue uma partida completa. Compare a dificuldade dos três saques, tente uma recepção boa e uma atrasada, alterne os ataques e experimente bloquear junto à rede. Confira se um passe B impede a largada do levantador e se o placar continua em `15–14`.

## 2. Bots e buffs na quadra · Pendente

**Entrega.** Criar perfis Fácil, Médio, Difícil e Brutal com diferenças de reação, posicionamento, decisão e timing. Adicionar, remover e configurar bots por equipe, além de preencher vagas livres com um botão. Implementar os buffs espelhados de passe, velocidade e salto, desligados por padrão e ajustáveis no lobby. Preservar o passe máximo A contra o saque viagem.

**Seu teste.** Compare dois níveis em quadra, monte formações diferentes e experimente a partida com os buffs desligados e ligados. Confira se os perfis parecem distintos e se cada buff comunica seu efeito.

## 3. Salas privadas pela internet · Pendente

**Entrega.** Criar o servidor Node.js com Colyseus e ligar **Criar sala** e **Entrar com código** ao lobby real. Sincronizar as quatro vagas, as equipes, os bots e as permissões do anfitrião. Incluir o botão de ocultar o código localmente e mensagens para sala inexistente, fechada ou cheia. Só o anfitrião pode iniciar com duas vagas ocupadas de cada lado.

**Seu teste.** Crie uma sala em um navegador e entre em outro pelo código. Confira se ambos veem as mesmas equipes e bots, se o olho afeta só a sua tela e se o visitante fica sem o controle de iniciar.

## 4. Partida online sincronizada · Pendente

**Entrega.** Rodar a simulação no servidor e usar o mesmo núcleo de regras no treino. Sincronizar contagem, movimento, bola, contatos, timing, efeitos e placar. Implementar interpolação dos adversários e da bola, previsão e correção do movimento local e limites na compensação de latência. Validar comandos e permissões no servidor.

**Seu teste.** Jogue com até quatro navegadores, primeiro na rede local e depois pela internet em uma prévia. Compare contagem, trajetória da bola, placar e resultado do ponto em duas telas. Jogue também com uma combinação de humanos e bots.

## 5. Reconexão, anfitrião e revanche · Pendente

**Entrega.** Preservar a identidade de cada vaga. Quando alguém cair, exibir um aviso e assumir a vaga com o bot previsto pelas regras. Se o jogador voltar em até 30 segundos, devolver o controle entre rallies. Transferir o anfitrião para o humano conectado há mais tempo e iniciar a revanche somente após a confirmação dos humanos presentes.

**Seu teste.** Derrube uma conexão durante o rally e observe a troca na outra tela. Volte dentro do tempo e confira a mesma vaga e o placar. Repita deixando o tempo expirar. Na revanche, confirme em uma tela por vez e veja se a contagem só inicia depois da última confirmação.

## 6. Balanceamento, desempenho e qualidade · Pendente

**Entrega.** Ajustar ritmo, janelas de timing e bots com partidas reais. Revisar legibilidade, feedback, áudio, controle por teclado, configurações, tela cheia e movimento reduzido. Medir carregamento e fluidez em telas e máquinas diferentes. Rodar testes de regressão de regras, lobby, multiplayer, reconexão e permissões, incluindo partidas sob latência simulada.

**Seu teste.** Faça uma sessão mais longa em tela cheia e em janela, com um adversário humano e bots de níveis diferentes. Avalie se o jogo comunica o que aconteceu, responde aos controles e mantém os resultados coerentes nos dois lados.

## 7. Validação final e lançamento da versão 1.0 · Pendente

**Entrega.** Publicar uma versão candidata em um ambiente de teste com HTTPS e conexão multiplayer segura. Verificar partidas completas com quatro humanos em redes distintas e com vagas preenchidas por bots. Preparar instruções para operar o serviço, acompanhar erros e retornar à versão anterior se necessário. Só promover a versão para lançamento após seu aceite da candidata.

**Seu teste.** Compartilhe o link com seu grupo. Criem uma sala, completem uma partida e joguem a revanche. Testem também uma desconexão. Se o fluxo estiver pronto para uso, seu **OK** aprova o lançamento.

Skins cosméticas, controles de toque e novas arenas ficam no roteiro pós-1.0. Cada atualização também pode seguir o mesmo ciclo de entrega, teste e aceite.
