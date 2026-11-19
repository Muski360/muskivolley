import { BOT_DIFFICULTIES, DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from './bots';
import { BUFF_LABELS } from './buffs';
import type { GameState, MatchOptions } from './game';

type TextMode = 'animated' | 'static' | 'off';
type Screen = 'menu' | 'lobby' | 'match' | 'result';

export type GameActions = {
  start: (name: string, options?: MatchOptions) => void;
  reset: () => void;
  setEffects: (enabled: boolean) => void;
  setTextMode?: (mode: TextMode) => void;
  setVolume?: (volume: number) => void;
  chooseServe?: (serve: GameState['serve']) => void;
};

type MatchViewState = Pick<GameState, 'red' | 'blue' | 'phase' | 'countdown' | 'message' | 'player' | 'serve' | 'server' | 'players' | 'buffsEnabled'>;

type Preferences = {
  name: string;
  textMode: TextMode;
  reduceMotion: boolean;
  effects: boolean;
  volume: number;
};

const settingsKey = 'muski-volley-settings';
const botNames = ['Léo', 'Nina', 'Caio'];
const botTeams = ['Equipe Vermelha', 'Equipe Azul', 'Equipe Azul'];
const serveTips = {
  1: 'Saque seguro, com trajetória mais lenta.',
  2: 'Trajetória com desvio. Espere o anel verde.',
  3: 'Janela curta no anel. A recepção vale no máximo A.',
} satisfies Record<GameState['serve'], string>;
const phaseLabels: Record<MatchViewState['phase'], string> = {
  menu: 'Prévia da quadra',
  countdown: 'Prepare-se',
  serve: 'Saque',
  rally: 'Bola em jogo',
  point: 'Ponto',
  finished: 'Fim de jogo',
};

function loadPreferences(): Preferences {
  const defaults: Preferences = {
    name: '',
    textMode: 'animated',
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    effects: true,
    volume: 55,
  };

  try {
    return { ...defaults, ...JSON.parse(window.localStorage.getItem(settingsKey) ?? '{}') };
  } catch {
    return defaults;
  }
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function setText(target: HTMLElement, content: string) {
  if (target.textContent !== content) target.textContent = content;
}

export function mountUI(actions: GameActions) {
  const preferences = loadPreferences();
  const form = element<HTMLFormElement>('player-form');
  const nameInput = element<HTMLInputElement>('player-name');
  const lobby = element('lobby-panel');
  const lobbyActions = element('lobby-actions');
  const rosterLabel = element('roster-label');
  const buffsEnabled = element<HTMLInputElement>('buffs-enabled');
  const buffStatus = element('buff-status');
  const match = element('play-panel');
  const result = element('result-panel');
  const fillButton = element<HTMLButtonElement>('fill-bots');
  const startButton = element<HTMLButtonElement>('start-match');
  const replayButton = element<HTMLButtonElement>('replay');
  const arenaMode = element('arena-mode');
  const status = element('match-status');
  const countdown = element('countdown');
  const hint = element('phase-hint');
  const servePicker = element('serve-picker');
  const serveTip = element('serve-tip');
  const serveButtons = servePicker.querySelectorAll<HTMLButtonElement>('[data-serve]');
  const resultHeading = element('result-heading');
  const resultDescription = element('result-description');
  const redScore = element('score-red');
  const blueScore = element('score-blue');
  const redPlayer = element('red-player');
  const botSlots = ['red-partner', 'blue-player', 'blue-partner'].map((id, index) => {
    const row = element(id);
    const name = row.querySelector<HTMLSpanElement>('.bot-name')!;
    const controls = element<HTMLTemplateElement>('bot-slot-controls').content.cloneNode(true) as DocumentFragment;
    const choose = controls.querySelector('select')!;
    const add = controls.querySelector<HTMLButtonElement>('.bot-add')!;
    const remove = controls.querySelector<HTMLButtonElement>('.bot-remove')!;
    choose.dataset.botDifficulty = String(index + 1);
    add.dataset.addBot = String(index + 1);
    remove.dataset.removeBot = String(index + 1);
    choose.setAttribute('aria-label', `Dificuldade de ${botNames[index]} na ${botTeams[index]}`);
    add.setAttribute('aria-label', `Adicionar bot ${botNames[index]} à ${botTeams[index]}`);
    remove.setAttribute('aria-label', `Remover bot ${botNames[index]} da ${botTeams[index]}`);
    for (const [key, profile] of Object.entries(BOT_DIFFICULTIES)) {
      choose.add(new Option(profile.label, key));
    }
    row.append(controls);
    return { row, name, choose, add, remove };
  });
  const settings = element<HTMLDialogElement>('settings-dialog');
  const textMode = element<HTMLSelectElement>('text-mode');
  const reduceMotion = element<HTMLInputElement>('reduce-motion');
  const effects = element<HTMLInputElement>('effects-enabled');
  const volume = element<HTMLInputElement>('volume-control');
  const gameCanvas = element('game-canvas');
  const arena = element('game-arena');
  const fullscreenButton = element<HTMLButtonElement>('fullscreen-button');
  const fullscreenLabel = element('fullscreen-label');

  let screen: Screen = 'menu';
  const bots: [BotDifficulty | null, BotDifficulty | null, BotDifficulty | null] = [null, null, null];
  let player = preferences.name || 'Você';

  function syncFullscreen() {
    const nativeFullscreen = document.fullscreenElement === arena;
    const expanded = arena.classList.contains('is-expanded');
    fullscreenLabel.textContent = nativeFullscreen ? 'Sair da tela cheia'
      : expanded ? 'Reduzir arena' : 'Tela cheia';
    if (screen === 'match') gameCanvas.focus({ preventScroll: true });
  }

  fullscreenButton.addEventListener('click', async () => {
    if (document.fullscreenElement === arena) {
      await document.exitFullscreen().catch(syncFullscreen);
      return;
    }

    if (arena.classList.contains('is-expanded')) {
      arena.classList.remove('is-expanded');
      syncFullscreen();
      return;
    }

    if (document.fullscreenEnabled && typeof arena.requestFullscreen === 'function') {
      try {
        await arena.requestFullscreen();
        return;
      } catch {
        // An embedded preview can deny native fullscreen.
      }
    }

    arena.classList.add('is-expanded');
    syncFullscreen();
  });
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !arena.classList.contains('is-expanded')) return;
    arena.classList.remove('is-expanded');
    syncFullscreen();
  });

  function savePreferences() {
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify(preferences));
    } catch {
      // The current session can still use the settings when storage is unavailable.
    }
  }

  function renderLobby() {
    const occupied = bots.filter(Boolean).length;
    fillButton.hidden = occupied === bots.length;
    startButton.hidden = occupied < bots.length;
    if (screen === 'lobby') setText(status, `${occupied + 1} de 4 vagas ocupadas`);

    for (const [index, { row, name, choose, add, remove }] of botSlots.entries()) {
      const difficulty = bots[index];
      setText(name, difficulty ? `${botNames[index]} · Bot` : 'Vaga livre');
      row.classList.toggle('vacant', !difficulty);
      row.title = difficulty ? BOT_DIFFICULTIES[difficulty].label : '';
      choose.value = difficulty ?? DEFAULT_BOT_DIFFICULTY;
      choose.hidden = remove.hidden = !difficulty;
      add.hidden = Boolean(difficulty);
    }
  }

  function showScreen(next: Screen) {
    screen = next;
    form.hidden = next !== 'menu';
    lobby.hidden = next !== 'lobby';
    lobbyActions.hidden = next !== 'lobby';
    match.hidden = next !== 'match';
    result.hidden = next !== 'result';
    arena.classList.toggle('is-lobby', next === 'lobby');
    rosterLabel.textContent = next === 'lobby' ? 'Equipes' : 'Placar';
    arenaMode.textContent = next === 'lobby' ? 'Sala local' : 'Treino local';
  }

  function startMatch() {
    const [partner, blueFirst, blueSecond] = bots;
    if (!partner || !blueFirst || !blueSecond) return;
    showScreen('match');
    servePicker.hidden = true;
    actions.start(player, { bots: [partner, blueFirst, blueSecond], buffs: buffsEnabled.checked });
    gameCanvas.focus({ preventScroll: true });
  }

  function goHome() {
    showScreen('menu');
    bots.fill(null);
    buffsEnabled.checked = false;
    renderLobby();
    status.textContent = phaseLabels.menu;
    countdown.hidden = true;
    actions.reset();
  }

  nameInput.value = preferences.name;
  redPlayer.textContent = player;
  renderLobby();
  form.addEventListener('submit', event => {
    event.preventDefault();
    player = nameInput.value.trim() || 'Muski';
    preferences.name = player;
    savePreferences();
    redPlayer.textContent = player;
    showScreen('lobby');
    renderLobby();
    fillButton.focus({ preventScroll: true });
  });

  fillButton.addEventListener('click', () => {
    for (let index = 0; index < bots.length; index++) bots[index] ??= DEFAULT_BOT_DIFFICULTY;
    renderLobby();
    startButton.focus({ preventScroll: true });
  });
  for (const [index, { choose, add, remove }] of botSlots.entries()) {
    add.addEventListener('click', () => {
      bots[index] = DEFAULT_BOT_DIFFICULTY;
      renderLobby();
      choose.focus({ preventScroll: true });
    });
    remove.addEventListener('click', () => {
      bots[index] = null;
      renderLobby();
      add.focus({ preventScroll: true });
    });
    choose.addEventListener('change', () => {
      bots[index] = choose.value as BotDifficulty;
      renderLobby();
    });
  }
  startButton.addEventListener('click', startMatch);
  replayButton.addEventListener('click', startMatch);
  for (const button of serveButtons) {
    button.disabled = !actions.chooseServe;
    button.addEventListener('click', () => {
      actions.chooseServe?.(Number(button.dataset.serve) as GameState['serve']);
      gameCanvas.focus({ preventScroll: true });
    });
  }
  document.querySelectorAll('[data-home]').forEach(button => {
    button.addEventListener('click', () => {
      goHome();
      nameInput.focus({ preventScroll: true });
    });
  });
  element('brand-link').addEventListener('click', event => {
    event.preventDefault();
    goHome();
  });

  function applyPreferences() {
    actions.setEffects(preferences.effects && !preferences.reduceMotion);
    const mode = preferences.reduceMotion && preferences.textMode === 'animated' ? 'static' : preferences.textMode;
    actions.setTextMode?.(mode);
    actions.setVolume?.(preferences.volume / 100);
  }

  textMode.value = preferences.textMode;
  reduceMotion.checked = preferences.reduceMotion;
  effects.checked = preferences.effects;
  volume.value = String(preferences.volume);
  element('volume-setting').hidden = !actions.setVolume;
  element('open-settings').addEventListener('click', () => settings.showModal());
  settings.addEventListener('keydown', event => event.stopPropagation());
  settings.addEventListener('input', () => {
    preferences.textMode = textMode.value as TextMode;
    preferences.reduceMotion = reduceMotion.checked;
    preferences.effects = effects.checked;
    preferences.volume = volume.valueAsNumber;
    savePreferences();
    applyPreferences();
  });
  settings.addEventListener('close', () => {
    if (screen === 'match') gameCanvas.focus({ preventScroll: true });
  });
  applyPreferences();

  return {
    update(state: MatchViewState) {
      setText(redScore, String(state.red).padStart(2, '0'));
      setText(blueScore, String(state.blue).padStart(2, '0'));
      if (state.phase === 'menu') return;

      countdown.hidden = state.phase !== 'countdown' || !state.countdown;
      if (!countdown.hidden) setText(countdown, String(state.countdown));
      setText(status, phaseLabels[state.phase]);
      const fallbackHint = state.phase === 'serve' ? 'Escolha o saque e pressione Espaço.' : phaseLabels[state.phase];
      setText(hint, state.message || fallbackHint);
      const isYourServe = state.phase === 'serve' && state.server === 'red';
      servePicker.hidden = !isYourServe;
      if (isYourServe) {
        for (const button of serveButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.serve) === state.serve));
        setText(serveTip, serveTips[state.serve]);
      }
      if (state.player) setText(redPlayer, state.player);
      buffStatus.hidden = !state.buffsEnabled;
      if (state.buffsEnabled) {
        const buff = state.players[0]?.buff;
        setText(buffStatus, buff
          ? `${BUFF_LABELS[buff.kind]} ativo · ${Math.ceil(buff.remaining)} s`
          : 'Colete um ícone na quadra para ganhar um buff.');
      }

      if (state.phase === 'finished' && screen !== 'result') {
        const winner = state.red > state.blue ? 'Vermelha' : 'Azul';
        resultHeading.textContent = `Vitória ${winner.toLowerCase()}`;
        resultDescription.textContent = `Equipe ${winner} venceu por ${Math.max(state.red, state.blue)} a ${Math.min(state.red, state.blue)}.`;
        showScreen('result');
        replayButton.focus({ preventScroll: true });
      }
    },
  };
}
