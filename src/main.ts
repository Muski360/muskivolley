import * as Phaser from 'phaser';
import { CourtScene, VIEW_HEIGHT, VIEW_WIDTH } from './court';
import { Volleyball, type GameInput } from './game';
import { mountUI } from './ui';

const game = new Volleyball();
const held = new Set<string>();
const taps: GameInput[] = [];
const tapInputs = new Map<string, GameInput>([
    ['Space', { space: true }], ['KeyW', { w: true }], ['KeyS', { s: true }],
    ['Digit1', { serve: 1 }], ['Digit2', { serve: 2 }], ['Digit3', { serve: 3 }],
]);
const directionKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const simulationStep = 1 / 60;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let accumulatedTime = 0;
let effects = true;
let textMode: 'animated' | 'static' | 'off' = 'animated';
let volume = 0.35;
let audio: AudioContext | undefined;
let lastFeedback = -1;
let lastCount: number | undefined;
let lastView = '';

const ui = mountUI({
    start(name, options) {
        clearInputs();
        accumulatedTime = 0;
        game.start(name, options);
        if (typeof AudioContext !== 'undefined') {
            audio ??= new AudioContext();
            if (audio.state === 'suspended') void audio.resume().catch(() => {});
        }
    },
    reset() {
        clearInputs();
        accumulatedTime = 0;
        game.reset();
    },
    chooseServe: serve => { taps.push({ serve }); },
    setEffects: enabled => { effects = enabled; },
    setTextMode: mode => { textMode = mode; },
    setVolume: value => { volume = value; },
});

window.addEventListener('keydown', event => {
    if (game.state.phase === 'menu' || game.state.phase === 'finished') return;
    const tap = tapInputs.get(event.code);
    const direction = directionKeys.has(event.code);
    if (!tap && !direction) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, button, a')) return;
    event.preventDefault();
    if (direction) held.add(event.code);
    if (tap && !event.repeat) taps.push(tap);
});
window.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', clearInputs);

function clearInputs() {
    held.clear();
    taps.length = 0;
}

function playTone(frequency: number, endFrequency: number, duration: number) {
    if (audio?.state !== 'running' || volume <= 0) return;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.linearRampToValueAtTime(0.18 * volume, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function step(delta: number) {
    const state = game.state;
    if (document.querySelector('dialog[open]')) {
        clearInputs();
        accumulatedTime = 0;
    } else {
        accumulatedTime += delta;
        while (accumulatedTime >= simulationStep) {
            game.step(simulationStep, {
                left: held.has('ArrowLeft'), right: held.has('ArrowRight'),
                up: held.has('ArrowUp'), down: held.has('ArrowDown'),
                ...taps.shift(),
            });
            accumulatedTime -= simulationStep;
        }
    }

    const buff = state.players[0]?.buff;
    const view = [state.red, state.blue, state.phase, state.countdown, state.message, state.player,
        state.serve, state.server, state.buffsEnabled, buff?.kind, buff && Math.ceil(buff.remaining)].join('|');
    if (view !== lastView) {
        ui.update(state);
        lastView = view;
    }
    if (state.countdown !== lastCount) {
        if (state.countdown !== undefined) playTone(440, 370, 0.16);
        else if (state.phase === 'serve') playTone(520, 825, 0.22);
        lastCount = state.countdown;
    }
    const feedback = state.feedback;
    if (feedback && feedback.id > lastFeedback) {
        if (feedback.text === '+1') playTone(520, 745, 0.25);
        else playTone(230, 115, 0.125);
        lastFeedback = feedback.id;
    }
}

new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-canvas',
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    render: { pixelArt: true, roundPixels: true },
    scale: { mode: Phaser.Scale.NONE },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    backgroundColor: '#e1ab66',
    banner: false,
    autoFocus: false,
    scene: new CourtScene({
        state: game.state,
        step,
        effects: () => effects && !motion.matches,
        textMode: () => motion.matches && textMode === 'animated' ? 'static' : textMode,
    }),
});
