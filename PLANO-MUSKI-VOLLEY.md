# Plano de desenvolvimento do Muski Volley

**Etapa atual: 3. Formatos, bots e power-ups entregues, aguardando aceite.**

O Muski Volley será um vôlei de praia arcade em 3D estilizado para navegador desktop. A versão 1.0 terá partidas 1v1, 2v2 e 3v3, treino com bots e salas privadas para até seis pessoas. A movimentação toma como referência o Vôlei Arcade. O timing e a sensação dos ataques partem de Spikair Volleyball. [Vôlei Arcade](https://voleyplay.vercel.app/) · [Spikair Volleyball](https://store.steampowered.com/app/1769270/Spikair_Volleyball/)

Consulte a [identidade visual](docs/identidade-visual.md), os [requisitos](docs/requisitos.md) e a [arquitetura](docs/arquitetura.md). A página inicial abre a quadra 3D. O treino anterior continua acessível em **Treino 2D**, como referência de placar, preferências, bots e power-ups.

## Como avançar

Cada etapa entrega uma prévia local, build, testes aplicáveis e um roteiro manual. Você testa e responde **OK** ou pede ajustes. Depois do **OK**, atualizar o status para **Aprovada** e só então iniciar a próxima etapa.

## 1. Protótipo 3D e mira · Concluída

**Entrega.** A primeira quadra validou movimento, salto, mira no chão e duas câmeras com `N`. A física roda em passos de 60 Hz. O pedido para avançar à Etapa 2 incluiu a troca do estilo pixelado para melhorar a leitura.

**Verificação.** Build concluído, 20 testes passaram e a mira foi conferida na mesma marca nas duas câmeras em Chromium.

## 2. Rally 1v1 e revisão visual · Concluída

**Entrega.** Quadra em 3D estilizado com resolução adaptada à janela e opção de tela cheia. Treino repetível de Saque, Manchete, Levantamento, Ataque e Bloqueio, além de partida 1v1 contra um bot com placar, contagem e revanche. A simulação inclui manchete, peixinho, levantamento, largada, três ataques, bloqueio e os três saques com mira e timing. No 1v1, o mesmo atleta pode dar os três toques.

**Verificação.** Build concluído e 31 testes passaram. Em Chromium, a leitura da quadra e do HUD foi conferida nas duas câmeras e em tela cheia. A suíte também cobre a cravada com os dois botões do mouse, o saque com timing e a sequência de três toques.

**Ajustes pedidos antes de avançar.** Quadra ampliada de 8 × 16 m para 10 × 20 m, com faixa de areia maior e câmeras ajustadas. Manchete e levantamento ganharam altura, mantendo a largada com queda rápida. Os sete testes do rally passaram após os ajustes.

**Seu teste · 5 minutos**

1. Abra a quadra em tela cheia. Pressione `N` e confira se você distingue a bola, a mira e as linhas nas duas câmeras. Saia com `Esc`.
2. No treino de Saque, lance e bata com dois cliques esquerdos. Troque o tipo de saque com `1`, `2` ou `3` e compare o timing e a trajetória.
3. Use os exercícios para repetir manchete, levantamento e ataque. Compare os botões de ataque no ar e os dois juntos para a cravada. Tente largar com dois toques em `E` e bloquear segurando `Espaço` no salto.
4. Inicie uma partida 1v1 e dispute um ponto contra o bot. Numa partida completa, confira a vitória por dois pontos de vantagem e a revanche.

## 3. 2v2, 3v3, bots e power-ups · Aguardando aceite

**Entrega.** Partidas locais em 1v1, 2v2 e 3v3 com rotação de saque, 2v2 como padrão e gestão de vagas no painel **Equipes e bônus**. Os bots Fácil, Médio, Difícil e Brutal distribuem cobertura, levantamento e ataque. Levantamentos em salto podem provocar um bloqueio antecipado. No 2v2 e no 3v3, os toques consecutivos alternam entre atletas, com a exceção do bloqueio. Os power-ups de passe, velocidade e salto são opcionais e aparecem espelhados.

**Verificação.** Build concluído e 42 testes passaram. A simulação verificou alternância real de três toques em 2v2 e 3v3, níveis de bot, rotação do saque, duração dos bônus e revanche. Em Chromium, o início do 3v3 mostrou os seis atletas e os bônus nas duas câmeras.

**Seu teste · 5 minutos**

1. Compare a altura da manchete e do levantamento pelos exercícios. Use `N` para conferir a bola e as linhas da quadra nas duas câmeras.
2. Jogue alguns pontos no 2v2. Receba para o parceiro e acompanhe a alternância dos toques.
3. Selecione 3v3. Em **Equipes e bônus**, altere o nível de um bot e ative os power-ups. Durante a partida, colete um bônus e acompanhe sua duração.

## 4. Salas privadas online · Pendente

**Entrega.** Integrar Colyseus para criar salas, entrar por código, configurar equipes e sincronizar bola, posições, timing, pontuação e efeitos. Permitir reconexão em até 30 segundos com substituição temporária por bot. A revanche começa após confirmação de todos os humanos presentes.

**Seu teste.** Abra dois navegadores e compare a trajetória, os contatos e o placar. Preencha uma sala de seis vagas. Desconecte um humano, observe o bot assumir, retorne à mesma vaga e confirme a revanche nos dois navegadores.

## 5. Polimento e versão candidata · Pendente

**Entrega.** Finalizar arte, áudio e legibilidade das câmeras. Ajustar timing e bots com partidas reais, medir carregamento e desempenho, testar a sincronização sob latência e preparar uma versão candidata em HTTPS.

**Seu teste.** Jogue partidas completas com seu grupo em redes diferentes, incluindo um 3v3, uma desconexão e uma revanche. A publicação depende da aprovação dessa versão candidata.
