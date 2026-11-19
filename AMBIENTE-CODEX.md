# Ambiente Codex do Muski Volley

Use este guia para preparar o Codex em uma máquina nova ou em um executor remoto com terminal. Ele reúne as ferramentas para desenvolver e testar o jogo web de vôlei de praia 2x2.

**Prompt para copiar em uma nova sessão do Codex**

> Leia o arquivo AMBIENTE-CODEX.md anexado ou na raiz do Muski Volley. Confira o ambiente atual, instale somente os recursos ausentes pelas fontes indicadas e verifique se o Codex consegue usá-los. Preserve minhas instalações e configurações existentes. Informe o que funcionou e o que ficou pendente. Pare antes de instalar as dependências do jogo ou iniciar o desenvolvimento.

## 1. Conferir o ambiente

Em Windows, macOS ou Linux, use um terminal com Codex CLI recente, Git e Node.js LTS com npm e npx. Execute os comandos no ambiente que vai rodar o Codex. Em uma sessão remota, a instalação vale para o usuário e a máquina daquela sessão. Se o executor bloquear algum download ou login, avance com as outras etapas e informe o bloqueio específico. No PowerShell, se a execução de `npx.ps1` estiver bloqueada, use `npx.cmd` nos comandos executados diretamente no terminal.

```text
codex --version
git --version
node --version
npx --version
codex mcp list
codex plugin marketplace list
codex plugin list --json
```

Para conferir as skills existentes, consulte a lista de skills do cliente Codex e procure os arquivos `SKILL.md` em `.agents/skills/` do projeto, em `~/.agents/skills/` e em `$CODEX_HOME/skills/` (por padrão, `~/.codex/skills/`). No PowerShell, a variável correspondente é `$env:CODEX_HOME`. Reaproveite recursos equivalentes já disponíveis e instale apenas os que faltam. [Documentação de skills](https://learn.chatgpt.com/docs/build-skills)

## 2. Configurar os MCPs

Execute cada comando apenas se o respectivo MCP estiver ausente. Use `codex mcp get context7` e `codex mcp get playwright` para conferir configurações existentes.

```text
codex mcp add context7 --url https://mcp.context7.com/mcp
codex mcp add playwright -- npx -y @playwright/mcp@latest
```

O **Context7** fornece documentação de APIs por versão. Se o CLI solicitar OAuth, conclua o login no navegador. Use o Context7 nas consultas de APIs do projeto e confira a versão declarada ou instalada de cada biblioteca. Os IDs já verificados são `/phaserjs/phaser` e `/colyseus/docs`. [Instalação oficial do Context7](https://context7.com/guides/codex-mcp-setup)

O **Playwright MCP** permite que o Codex navegue e teste o jogo. Reutilize qualquer configuração funcional existente. Se a primeira chamada indicar que o navegador está ausente, use a ferramenta de instalação de navegador do próprio MCP e repita o teste. [Playwright MCP](https://github.com/microsoft/playwright-mcp)

## 3. Instalar as skills do Phaser e do Colyseus

O primeiro comando seleciona 15 skills oficiais do Phaser 4 para o projeto, cobrindo física, animações, sprites, controles, cenas, renderização, câmera, efeitos e escala. Em uma instalação parcial, mantenha na lista após `--skill` apenas os nomes ausentes. O segundo comando instala a skill oficial do Colyseus, com referências de salas, sincronização e reconexão.

```text
npx --yes skills add https://github.com/phaserjs/phaser/tree/master/skills --global --agent codex --copy --yes --skill physics-arcade physics-matter animations sprites-and-images input-keyboard-mouse-touch scenes graphics-and-shapes render-textures filters-and-postfx game-setup-and-config loading-assets tweens particles cameras scale-and-responsive
npx --yes skills add colyseus/skill --global --agent codex --copy --yes --skill colyseus
```

[Skills do Phaser](https://github.com/phaserjs/phaser/tree/master/skills) · [Skill do Colyseus](https://github.com/colyseus/skill) · [CLI de instalação de skills](https://github.com/vercel-labs/skills)

## 4. Instalar os plugins

**Game Studio** é o plugin oficial da OpenAI para orientar a implementação e os testes do jogo. Se já houver uma instalação ativa, reutilize-a. Se o catálogo `openai-curated` já estiver registrado, execute apenas a segunda linha.

```text
codex plugin marketplace add openai/plugins --ref main
codex plugin add game-studio@openai-curated
```

Se essa opção estiver indisponível no cliente, procure **Game Studio** no catálogo oficial de plugins do Codex. Use uma única instalação funcional. Se o plugin estiver ativo e as skills não aparecerem na lista da sessão, localize a pasta `skills/` através de `installedPath` retornado pelo comando de instalação com `--json` ou no cache de plugins do Codex. Leia os arquivos `SKILL.md` de `game-studio`, `phaser-2d-game` e `game-playtest` conforme a etapa do projeto. [Game Studio](https://github.com/openai/plugins/tree/main/plugins/game-studio) · [Catálogos do Codex](https://developers.openai.com/plugins/build/plugins)

**Ponytail** orienta a implementação e a revisão de código. Se a skill ou o plugin já estiver disponível, use a instalação existente. Em uma máquina nova, siga a instalação oficial abaixo. Pule a primeira linha se o catálogo já estiver registrado.

```text
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

[Instalação oficial do Ponytail](https://github.com/DietrichGebert/ponytail)

**i-have-adhd** é uma preferência de estilo de resposta. Para reproduzir a configuração deste ambiente, instale o plugin se estiver ausente. Pule a primeira linha se o catálogo já estiver registrado. Para ativar o estilo em uma sessão do Codex, digite `$i-have-adhd`.

```text
codex plugin marketplace add ayghri/i-have-adhd --ref main
codex plugin add i-have-adhd@i-have-adhd
```

[Instruções do repositório](https://github.com/ayghri/i-have-adhd/blob/main/AGENTS.md) · [Instalação no Codex](https://github.com/ayghri/i-have-adhd/blob/main/INSTALL.md#codex)

## 5. Verificar em uma sessão nova

1. Abra uma nova sessão do Codex no projeto. Em `codex mcp list` ou no painel `/mcp`, confira Context7 e Playwright. Peça uma consulta de documentação do Phaser pelo Context7 e abra uma página de teste pelo Playwright.
2. Confira se as 15 skills do Phaser e a skill Colyseus aparecem na lista de skills ou se o Codex consegue abrir os respectivos arquivos `SKILL.md`.
3. Use `codex plugin list --json` ou o painel de plugins para conferir o Game Studio e o i-have-adhd. Para Ponytail, confirme a skill existente ou o plugin ativo. Verifique se o Codex consegue ler as skills do Game Studio, usando o caminho da instalação quando necessário.
4. Registre o que já existia, o que foi instalado e os bloqueios que restaram. Vincule cada bloqueio ao comando ou teste que falhou.

Este guia instala o ambiente do agente. As bibliotecas Phaser e Colyseus, o TypeScript, o Vite e o pacote de testes `@playwright/test` entram no projeto quando o desenvolvimento começar. O MCP do Playwright serve às sessões do Codex e o pacote de testes roda a suíte do projeto.
