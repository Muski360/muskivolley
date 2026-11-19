# Arquitetura do Muski Volley

## Cliente e simulação

| Camada | Responsabilidade |
| --- | --- |
| **Simulação** | TypeScript independente do DOM, com passos de 1/60 s. Usa metros, `Y` para altura, `X` ao longo da rede e `Z` entre os lados. A rede fica em `Z = 0`. Rapier 3D simula bola, areia e rede, com detecção contínua para a bola. |
| **Renderização** | Three.js e WebGL 2 com resolução adaptada à área da quadra. Consome as posições da simulação para desenhar quadra, atletas e bola. A câmera ativa define os eixos de movimento e o raio do cursor até o plano da areia. |
| **Interface** | Vite entrega a arena e os controles em HTML. Estado da câmera, tela cheia e preferências de apresentação pertencem ao cliente. A troca de câmera recalcula a mira. A opção de tela cheia usa a API do navegador e ocupa a janela quando a API está indisponível. |
| **Servidor futuro** | Node.js e Colyseus rodam o mesmo núcleo, com autoridade sobre partida, salas, vagas e resultados. |

O jogo 3D está em `src/arena3d/`. `simulation.ts` concentra a física. `rally.ts` controla equipes, placar, exercícios e power-ups. `team-ai.ts` prevê a trajetória e escolhe as intenções dos bots de acordo com as vagas e o nível. A simulação aplica as mesmas regras aos comandos de humanos e bots. `scene.ts` monta a arena e representa até seis atletas, e `main.ts` liga entrada, câmera, simulação e renderização. Para a arte final, exportar modelos GLB com a mesma escala e os mesmos eixos.

O treino Phaser 2.5D fica em `treino-2d.html`. O build gera as duas páginas. Testes do treino anterior usam a rota específica, e os da arena 3D cobrem a página inicial.

## Contrato online planejado

- **Comandos.** O cliente envia ações de sala e comandos da partida com numeração sequencial, direção, estado dos botões e alvo da mira em coordenadas de mundo. O servidor valida fase, identidade, permissão, alcance e timing antes de resolver o contato.
- **Estado.** A sala publica formato, vagas, fase, contagem, bola, atletas, placar e power-ups. O cliente interpola bola e adversários e prevê o movimento local, corrigindo o estado com dados do servidor. Compensação de latência fica limitada à janela definida pelas regras.
- **Vagas.** A posição na equipe tem identificador estável. Um bot substitui temporariamente quem cair e o controle retorna entre rallies. Bots emitem os mesmos comandos de jogo que humanos.
- **Eventos.** Cada evento confirmado de ação ou ponto carrega um identificador. O cliente exibe animação e texto uma vez por evento, inclusive após reconectar. Preferências de movimento e texto só afetam a apresentação.

## Verificação

O Playwright verifica a simulação dos rallies, os formatos locais, a configuração dos bots no navegador e o treino 2D. O roteiro manual cobre a mira, a leitura da bola e da rede nas duas câmeras, tela cheia e partidas com bots. As etapas seguintes ampliam a verificação para sincronização entre seis contextos, reconexão e latência simulada.
