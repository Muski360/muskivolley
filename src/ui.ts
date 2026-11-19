type TextMode = 'animated' | 'static' | 'off';
type Screen = 'menu' | 'lobby' | 'match' | 'result';

export type GameActions = {
  start: (name: string) => void;
  reset: () => void;
  setEffects: (enabled: boolean) => void;
  setTextMode?: (mode: TextMode) => void;
  setVolume?: (volume: number) => void;
};

export type MatchViewState = {
  red: number;
  blue: number;
  phase: 'menu' | 'serve' | 'rally' | 'point' | 'finished' | 'countdown';
  countdown?: number;
  message?: string;
  player?: string;
};

type Preferences = {
  name: string;
  textMode: TextMode;
  reduceMotion: boolean;
  effects: boolean;
  volume: number;
};

const settingsKey = 'muski-volley-settings';
const botNames = ['Léo · Bot', 'Nina · Bot', 'Caio · Bot'];
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
  const match = element('play-panel');
  const result = element('result-panel');
  const fillButton = element<HTMLButtonElement>('fill-bots');
  const startButton = element<HTMLButtonElement>('start-match');
  const replayButton = element<HTMLButtonElement>('replay');
  const arenaMode = element('arena-mode');
  const status = element('match-status');
  const countdown = element('countdown');
  const hint = element('phase-hint');
  const resultHeading = element('result-heading');
  const resultDescription = element('result-description');
  const redScore = element('score-red');
  const blueScore = element('score-blue');
  const redPlayer = element('red-player');
  const botSlots = ['red-partner', 'blue-player', 'blue-partner'].map(id => element(id));
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
  let filled = false;
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
    fillButton.hidden = filled;
    startButton.hidden = !filled;
    element('lobby-description').textContent = filled
      ? 'Quatro jogadores em quadra. Tudo pronto.'
      : 'Preencha as três vagas para começar.';
    for (const [index, slot] of botSlots.entries()) {
      slot.textContent = filled ? botNames[index] : 'Vaga livre';
      slot.classList.toggle('vacant', !filled);
    }
  }

  function showScreen(next: Screen) {
    screen = next;
    form.hidden = next !== 'menu';
    lobby.hidden = next !== 'lobby';
    match.hidden = next !== 'match';
    result.hidden = next !== 'result';
    arenaMode.textContent = next === 'lobby' ? 'Sala local' : 'Treino local';
  }

  function startMatch() {
    showScreen('match');
    actions.start(player);
    gameCanvas.focus({ preventScroll: true });
  }

  function goHome() {
    showScreen('menu');
    filled = false;
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
    status.textContent = 'Aguardando jogadores';
    fillButton.focus({ preventScroll: true });
  });

  fillButton.addEventListener('click', () => {
    filled = true;
    renderLobby();
    status.textContent = 'Quatro jogadores prontos';
    startButton.focus({ preventScroll: true });
  });
  startButton.addEventListener('click', startMatch);
  replayButton.addEventListener('click', startMatch);
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
      if (state.player) setText(redPlayer, state.player);

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
