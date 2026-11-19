# Ambiente Codex

Ao configurar este projeto em outra máquina ou sessão remota, siga o [guia de ambiente Codex](AMBIENTE-CODEX.md) para instalar os recursos ausentes e verificar a configuração.

# Documentação técnica

Consulte a [identidade visual](docs/identidade-visual.md), os [requisitos](docs/requisitos.md) e a [arquitetura](docs/arquitetura.md) antes de alterar o jogo.

Siga o [plano de desenvolvimento por etapas](PLANO-MUSKI-VOLLEY.md). Entregue a etapa atual com um roteiro de teste. Inicie a próxima somente após a aprovação explícita do usuário e mantenha o status atualizado no plano.

Use o MCP Context7 sempre que precisar consultar APIs ou documentação atualizadas para este projeto. Identifique primeiro a versão declarada ou instalada da dependência. Para Three.js, Rapier e Colyseus, use `/mrdoob/three.js`, `/dimforge/rapier.js` e `/colyseus/docs` como ponto de partida.

# Game Studio

Use `game-studio` para escolher o fluxo, `three-webgl-game` para a implementação 3D, `web-3d-asset-pipeline` para os modelos e `game-playtest` para testes no navegador. Use `phaser-2d-game` para manutenção do treino 2D. Se o cliente Codex não listar as skills, siga o [procedimento no guia](AMBIENTE-CODEX.md#4-instalar-os-plugins) para localizar os arquivos `SKILL.md`.
