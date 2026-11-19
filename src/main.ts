import * as Phaser from 'phaser';
import { CourtScene, VIEW_HEIGHT, VIEW_WIDTH } from './court';
import { Volleyball, type GameInput } from './game';
import { mountUI } from './ui';

const game = new Volleyball();
const held = new Set<string>();
const pressed = new Set<string>();
const gameKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyS', 'Digit1', 'Digit2', 'Digit3']);
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let effects = true;
let textMode: 'animated' | 'static' | 'off' = 'animated';
let volume = 0.35;
let audio: AudioContext | undefined;
let lastFeedback = -1;
let lastCount: number | undefined;
let lastView = '';

const ui = mountUI({
    start(name) {
        held.clear();
        pressed.clear();
        game.start(name);
        if (typeof AudioContext !== 'undefined') {
            audio ??= new AudioContext();
            if (audio.state === 'suspended') void audio.resume().catch(() => {});
        }
    },
    reset() {
        held.clear();
        pressed.clear();
        game.reset();
    },
    setEffects: enabled => { effects = enabled; },
    setTextMode: mode => { textMode = mode; },
    setVolume: value => { volume = value; },
});

window.addEventListener('keydown', event => {
    if (!gameKeys.has(event.code) || game.state.phase === 'menu' || game.state.phase === 'finished') return;
    if (document.querySelector('dialog[open]')) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, button, a')) return;
    event.preventDefault();
    held.add(event.code);
    if (!event.repeat) pressed.add(event.code);
});
window.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', () => {
    held.clear();
    pressed.clear();
});

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
        held.clear();
        pressed.clear();
    } else {
        const input: GameInput = {
            left: held.has('ArrowLeft'), right: held.has('ArrowRight'),
            up: held.has('ArrowUp'), down: held.has('ArrowDown'),
            space: pressed.has('Space'), w: pressed.has('KeyW'), s: pressed.has('KeyS'),
            serve: pressed.has('Digit1') ? 1 : pressed.has('Digit2') ? 2 : pressed.has('Digit3') ? 3 : undefined,
        };
        game.step(delta, input);
        pressed.clear();
    }

    const view = [state.red, state.blue, state.phase, state.countdown, state.message, state.player].join('|');
    if (view !== lastView) {
        ui.update(state);
        lastView = view;
    }
    if (state.countdown !== lastCount) {
        if (state.countdown !== undefined) playTone(440, 370, 0.16);
        else if (state.phase === 'serve') playTone(520, 825, 0.22);
        lastCount = state.countdown;
    }
    if (state.feedback && state.feedback.id !== lastFeedback) {
        if (state.feedback.text === '+1') playTone(520, 745, 0.25);
        else playTone(230, 115, 0.125);
        lastFeedback = state.feedback.id;
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
