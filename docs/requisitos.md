# Requisitos do Muski Volley

Vôlei de praia arcade 3D para navegador desktop, com teclado e mouse. A quadra mede 10 × 20 m e tem faixa de areia fora das linhas para salvar a bola. A versão 1.0 oferece treino com bots e salas privadas em 1v1, 2v2 e 3v3.

## Controles e fundamentos

| Comando | Regra |
| --- | --- |
| `WASD`, mouse e `N` | Mover em relação à câmera pelo próprio lado, incluindo fora das linhas. A rede separa os lados. O cursor marca um alvo na areia. `N` alterna entre a câmera elevada de trás e a lateral. O cursor fica livre nas duas. Use **Tela cheia** para ampliar a quadra e `Esc` para voltar. |
| `Espaço` | Um toque pula quando o atleta estiver no chão, inclusive no saque. Segurar no ar perto da rede, contra bola adversária, ativa o bloqueio. |
| Mouse no chão | Segurar o botão esquerdo prepara a manchete. O passe acontece quando a bola entra no alcance, seguindo a mira no contato. O clique direito inicia o peixinho na direção da mira e amplia o alcance para bolas baixas. |
| `E` | Um toque prepara o levantamento na mira. O levantamento em salto pode enganar bots no bloqueio. Dois toques em até 180 ms, antes do contato, preparam a largada. Pode mirar em qualquer ponto. A queda rápida pode fazer uma largada de longe bater na rede ou cair do próprio lado. |
| Mouse no ar | Esquerdo dá ataque forte, direito dá ataque menos potente. Os dois em até 70 ms armam a cravada. No contato aéreo, a cravada exige altura, proximidade da rede e timing mais preciso. Uma bola alcançável, mas ruim para cravar, bate no meio da rede. Sem alcance, o golpe passa no vazio. |
| Saque | `1`, `2` e `3` selecionam Normal, Flutuante e Viagem. O primeiro clique esquerdo lança a bola. O segundo golpeia no timing e usa a mira daquele instante. |

Resolva cada contato uma única vez. Um segundo clique ou `E` precisa chegar antes do contato para mudar o golpe armado. O jogo sinaliza a janela do saque e os resultados dos contatos. As demais janelas de timing, alcances e velocidades serão ajustadas na Etapa 2 com treino e testes reproduzíveis.

A posição e a altura do contato definem a nota da manchete enquanto o botão estiver segurado. A manchete e o levantamento sobem para dar tempo de chegar ao próximo toque. A largada continua com queda rápida. O flutuante alterna a direção no trecho adversário. O viagem chega mais rápido e limita a nota do passe a **A**. Após um bloqueio válido de cravada, a bola cai do lado atacante sem chance de cobertura. Ataques comuns permitem a defesa de bolas desviadas pelo bloqueio.

## Partida e formatos

- A escolha de 1v1, 2v2 ou 3v3 ocorre antes do início. 2v2 é o padrão. Todos podem receber, levantar, atacar e bloquear. Cada equipe tem até três toques, contando o bloqueio. Apenas no 1v1 um atleta pode fazer sozinho a sequência completa. Nos demais formatos, os toques alternam entre atletas, com exceção de quem acabou de bloquear.
- Cada rally vale um ponto. A partida começa após uma contagem de três segundos. Vence a equipe com 15 ou mais pontos e dois de vantagem. A revanche reinicia com o mesmo formato e as mesmas vagas.
- Os níveis de bot são Fácil, Médio, Difícil e Brutal. Reação, posicionamento, timing e escolha de golpe distinguem cada nível. Bots seguem as mesmas regras de movimento e alcance dos humanos. **Completar com bots** preenche vagas livres com bots Médios.
- Power-ups de passe, velocidade e salto começam desligados. O anfitrião pode ativar coletas espelhadas. Cada efeito dura seis segundos de bola em jogo. O de passe melhora a nota da recepção válida, respeitando o máximo **A** contra viagem.

## Sala e preferências

O anfitrião escolhe o formato, preenche vagas com humanos ou bots e inicia quando todas estiverem ocupadas. O código de convite pode ser ocultado localmente. Na desconexão durante uma partida, um bot assume a vaga. Reconectar em até 30 segundos devolve o controle entre rallies. Se o anfitrião sair, o humano conectado há mais tempo assume suas permissões. A revanche espera a confirmação de todos os humanos presentes.

Nome de exibição, volume, efeitos, movimento reduzido e textos de ação são preferências locais. A [identidade visual](identidade-visual.md) especifica o feedback.

## Treino e partida local

A página inicial oferece exercícios repetíveis de Saque, Manchete, Levantamento, Ataque e Bloqueio. Cada partida local tem um humano e bots nas outras vagas do formato escolhido. O painel **Equipes e bônus** permite abrir vagas, preencher as vagas livres e configurar cada bot. A partida começa com contagem e oferece revanche com as mesmas equipes e opções.
