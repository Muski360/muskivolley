import * as THREE from 'three';
import { BOT_DIFFICULTIES, DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from '../bots';
import { BUFF_LABELS } from '../buffs';
import { createRally, type MatchFormat, type MatchOptions, type PracticeScenario, type Serve } from './rally';
import { buildScene } from './scene';
import { COURT, STEP } from './simulation';
import './style.css';

function element<T extends HTMLElement = HTMLElement>(id: string) {
    return document.getElementById(id) as T;
}

const arena = element('arena');
const playfield = element('playfield');
const notice = element('loading');
const cameraButton = element<HTMLButtonElement>('camera');
const cameraLabel = element('camera-label');
const fullscreen = element<HTMLButtonElement>('fullscreen');
const matchButton = element<HTMLButtonElement>('play-match');
const matchFormat = element<HTMLSelectElement>('match-format');
const setupButton = element<HTMLButtonElement>('open-setup');
const setup = element<HTMLDialogElement>('match-setup');
const fillBots = element<HTMLButtonElement>('fill-bots');
const enableBuffs = element<HTMLInputElement>('enable-buffs');
const vacancyNote = element('vacancy-note');
const practiceButton = element<HTMLButtonElement>('practice');
const replayButton = element<HTMLButtonElement>('replay');
const restartButton = element<HTMLButtonElement>('restart-drill');
const drill = element<HTMLSelectElement>('practice-scenario');
const gameStatus = element('game-status');
const touchCounter = element('touch-counter');
const activeBuff = element('active-buff');
const gameFeedback = element('game-feedback');
const scoreboard = element('scoreboard');
const playerScore = element('score-player');
const opponentScore = element('score-opponent');
const homeName = element('team-home-name');
const awayName = element('team-away-name');
const countdown = element('countdown');
const result = element('result');
const resultLabel = element('result-label');
const servePicker = element('serve-picker');
const serveButtons = [...servePicker.querySelectorAll<HTMLButtonElement>('[data-serve]')];
const serveMeter = element('serve-meter');
const serveCue = element('serve-cue');
const serveProgress = element<HTMLProgressElement>('serve-progress');

const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const serveKeys = new Map<string, Serve>([['Digit1', 1], ['Digit2', 2], ['Digit3', 3]]);

function setText(target: HTMLElement, text: string) {
    if (target.textContent !== text) target.textContent = text;
}

function show(target: HTMLElement, visible: boolean) {
    if (target.hidden === visible) target.hidden = !visible;
}

function syncFullscreen() {
    const expanded = arena.classList.contains('is-expanded');
    const active = document.fullscreenElement === arena || expanded;
    fullscreen.setAttribute('aria-pressed', String(active));
    setText(fullscreen, active ? 'Sair da tela cheia' : 'Tela cheia');
    playfield.focus({ preventScroll: true });
}

fullscreen.addEventListener('click', async () => {
    if (document.fullscreenElement === arena) {
        await document.exitFullscreen().catch(syncFullscreen);
        return;
    }
    if (arena.classList.contains('is-expanded')) {
        arena.classList.remove('is-expanded');
        syncFullscreen();
        return;
    }
    if (document.fullscreenEnabled && arena.requestFullscreen) {
        try {
            await arena.requestFullscreen();
            return;
        } catch {
            // A prévia embutida pode negar a tela cheia nativa.
        }
    }
    arena.classList.add('is-expanded');
    syncFullscreen();
});
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || setup.open || !arena.classList.contains('is-expanded')) return;
    arena.classList.remove('is-expanded');
    syncFullscreen();
});

function createBotSlots(roster: HTMLElement, count: number, name: string) {
    return Array.from({ length: count }, (_, index) => {
        const row = document.createElement('label');
        const select = document.createElement('select');
        select.add(new Option('Vaga livre', ''));
        for (const [difficulty, profile] of Object.entries(BOT_DIFFICULTIES)) {
            select.add(new Option(profile.label, difficulty));
        }
        select.value = DEFAULT_BOT_DIFFICULTY;
        row.append(`${name} ${index + 1}`, select);
        roster.append(row);
        return { row, select };
    });
}

async function start() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    try {
        const game = await createRally();
        const view = buildScene();
        const camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 180);
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        const ray = new THREE.Raycaster();
        const ground = new THREE.Plane(up, 0);
        const pointer = new THREE.Vector2();
        const hit = new THREE.Vector3();
        const keys = new Set<string>();
        let cursor: { x: number; y: number } | undefined;
        let lateral = false;
        let ready = true;
        let jump = false;
        let leftHeld = false;
        let leftTaps = 0;
        let rightTaps = 0;
        let setTaps = 0;
        let serve: Serve | undefined;
        let previousFrame = 0;
        let accumulated = 0;
        let stride = 0;
        let activeScenario: PracticeScenario = 'serve';
        let previousPhase = game.state.phase;
        let previousFeedback = game.state.feedbackId;
        let feedbackUntil = 0;

        const homeSlots = createBotSlots(element('home-roster'), 2, 'Parceiro');
        const awaySlots = createBotSlots(element('away-roster'), 3, 'Adversário');
        const botSlots = [...homeSlots, ...awaySlots];
        const format = () => Number(matchFormat.value) as MatchFormat;
        const activeSlots = () => [...homeSlots.slice(0, format() - 1), ...awaySlots.slice(0, format())];

        function syncSetup() {
            const size = format();
            homeSlots.forEach(({ row }, index) => show(row, index < size - 1));
            awaySlots.forEach(({ row }, index) => show(row, index < size));
            const missing = activeSlots().some(({ select }) => !select.value);
            setText(matchButton, `Jogar ${size}v${size}`);
            matchButton.disabled = !ready || missing;
            fillBots.disabled = !missing;
            show(vacancyNote, missing);
        }

        function matchOptions(): MatchOptions {
            const size = format();
            return {
                teamSize: size,
                homeBots: homeSlots.slice(0, size - 1).map(({ select }) => select.value as BotDifficulty),
                awayBots: awaySlots.slice(0, size).map(({ select }) => select.value as BotDifficulty),
                buffs: enableBuffs.checked,
            };
        }

        matchFormat.addEventListener('change', syncSetup);
        for (const { select } of botSlots) select.addEventListener('change', syncSetup);
        fillBots.addEventListener('click', () => {
            for (const { select } of activeSlots()) if (!select.value) select.value = DEFAULT_BOT_DIFFICULTY;
            syncSetup();
            element('close-setup').focus();
        });
        setupButton.addEventListener('click', () => {
            clearInput();
            setup.showModal();
        });
        setup.addEventListener('close', () => {
            if (game.state.phase !== 'ready') playfield.focus({ preventScroll: true });
        });

        renderer.domElement.setAttribute('aria-hidden', 'true');
        playfield.append(renderer.domElement);

        function updateAim() {
            const rect = renderer.domElement.getBoundingClientRect();
            const inFrame = cursor && cursor.x >= rect.left && cursor.x <= rect.right
                && cursor.y >= rect.top && cursor.y <= rect.bottom && rect.width > 0 && rect.height > 0;
            if (!inFrame || !cursor) {
                view.aim.visible = false;
                return;
            }
            pointer.set(2 * (cursor.x - rect.left) / rect.width - 1, 1 - 2 * (cursor.y - rect.top) / rect.height);
            ray.setFromCamera(pointer, camera);
            view.aim.visible = Boolean(ray.ray.intersectPlane(ground, hit) && Math.abs(hit.x) <= COURT.sandWidth / 2
                && Math.abs(hit.z) <= COURT.sandLength / 2);
            if (view.aim.visible) view.aim.position.set(hit.x, 0.032, hit.z);
        }

        function resize() {
            const { width, height } = playfield.getBoundingClientRect();
            if (width < 1 || height < 1) return;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75, 1920 / width, 1080 / height));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            updateAim();
        }

        function positionCamera() {
            if (lateral) {
                camera.position.set(24, 13.85, 4.1);
                camera.lookAt(0.75, 1.1, 0);
            } else {
                camera.position.set(3.2, 15.4, 28);
                camera.lookAt(0, 0.5, 1.2);
            }
            camera.updateMatrixWorld();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            right.crossVectors(forward, up);
            setText(cameraLabel, lateral ? 'Câmera lateral' : 'Câmera de trás');
            updateAim();
        }

        function toggleCamera() {
            lateral = !lateral;
            positionCamera();
        }

        function clearInput() {
            keys.clear();
            jump = leftHeld = false;
            leftTaps = rightTaps = setTaps = 0;
            serve = undefined;
        }

        function readPointer(event: MouseEvent) {
            cursor = { x: event.clientX, y: event.clientY };
            updateAim();
        }

        function beginGame(begin: () => void) {
            clearInput();
            feedbackUntil = 0;
            begin();
            previousFeedback = game.state.feedbackId;
            playfield.focus({ preventScroll: true });
        }

        function startPractice(scenario = activeScenario) {
            activeScenario = scenario;
            drill.value = scenario;
            beginGame(() => game.start('practice', scenario));
        }

        matchButton.addEventListener('click', () => beginGame(() => game.start('match', undefined, matchOptions())));
        practiceButton.addEventListener('click', () => startPractice(drill.value as PracticeScenario));
        replayButton.addEventListener('click', () => beginGame(game.replay));
        restartButton.addEventListener('click', () => startPractice());
        for (const choice of serveButtons) {
            choice.addEventListener('click', () => {
                serve = Number(choice.dataset.serve) as Serve;
                playfield.focus({ preventScroll: true });
            });
        }

        resize();
        positionCamera();
        new ResizeObserver(resize).observe(playfield);
        for (const control of [cameraButton, practiceButton, drill, matchFormat, setupButton]) control.disabled = false;
        syncSetup();
        notice.hidden = true;
        playfield.setAttribute('aria-busy', 'false');
        cameraButton.addEventListener('click', () => {
            toggleCamera();
            playfield.focus({ preventScroll: true });
        });
        playfield.addEventListener('pointermove', readPointer);
        playfield.addEventListener('pointerleave', () => {
            cursor = undefined;
            view.aim.visible = false;
        });
        playfield.addEventListener('contextmenu', event => {
            if (game.state.phase !== 'ready') event.preventDefault();
        });
        playfield.addEventListener('mousedown', event => {
            if (!ready || (event.button !== 0 && event.button !== 2) || event.target instanceof HTMLButtonElement) return;
            playfield.focus({ preventScroll: true });
            readPointer(event);
            if (event.button === 0) {
                leftHeld = true;
                leftTaps++;
            } else {
                rightTaps++;
            }
        });
        window.addEventListener('pointermove', event => {
            if (!(event.buttons & 1)) leftHeld = false;
        });
        window.addEventListener('mouseup', event => {
            if (!(event.buttons & 1)) leftHeld = false;
        });
        window.addEventListener('pointercancel', clearInput);
        window.addEventListener('keydown', event => {
            if (!ready || setup.open || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, a, summary, [contenteditable]')) return;
            const { code } = event;
            const selected = serveKeys.get(code);
            if (!moveKeys.has(code) && !['Space', 'KeyN', 'KeyE', 'KeyR'].includes(code) && !selected) return;
            event.preventDefault();
            if (moveKeys.has(code) || code === 'Space') keys.add(code);
            if (event.repeat) return;
            if (code === 'Space') jump = true;
            if (code === 'KeyE') setTaps++;
            if (code === 'KeyN') toggleCamera();
            if (code === 'KeyR' && game.state.mode === 'practice' && game.state.phase !== 'ready') startPractice();
            if (selected) serve = selected;
        });
        window.addEventListener('keyup', event => keys.delete(event.code));
        window.addEventListener('blur', clearInput);
        document.addEventListener('focusin', event => {
            if (event.target !== playfield) clearInput();
        });
        document.addEventListener('visibilitychange', clearInput);
        renderer.domElement.addEventListener('webglcontextlost', () => {
            ready = false;
            clearInput();
            for (const control of [cameraButton, practiceButton, drill, restartButton, replayButton, matchFormat, setupButton]) control.disabled = true;
            syncSetup();
            notice.hidden = false;
            notice.textContent = 'A conexão com a GPU foi interrompida. Recarregue se a quadra não voltar.';
        });
        renderer.domElement.addEventListener('webglcontextrestored', () => {
            ready = true;
            for (const control of [cameraButton, practiceButton, drill, restartButton, replayButton, matchFormat, setupButton]) control.disabled = false;
            syncSetup();
            notice.hidden = true;
            previousFrame = 0;
            accumulated = 0;
        });

        function renderHUD(time: number) {
            const state = game.state;
            const active = state.phase !== 'ready';
            show(scoreboard, active && state.mode === 'match');
            show(restartButton, active && state.mode === 'practice');
            if (!scoreboard.hidden) {
                setText(playerScore, String(state.score.player));
                setText(opponentScore, String(state.score.opponent));
                setText(homeName, state.teamSize === 1 ? 'Você' : 'Time laranja');
                setText(awayName, state.teamSize === 1 ? 'Bot' : 'Time azul');
            }
            setText(gameStatus, active ? state.message : 'Escolha uma partida ou um exercício.');
            show(touchCounter, state.phase === 'rally' && state.possession === 'player');
            if (!touchCounter.hidden) setText(touchCounter, `Toques ${state.touches}/3`);
            const buff = game.player.buff;
            show(activeBuff, Boolean(buff));
            if (buff) setText(activeBuff, `${BUFF_LABELS[buff.kind]} · ${Math.ceil(buff.remaining)} s`);
            show(countdown, state.phase === 'countdown');
            if (!countdown.hidden) setText(countdown, String(state.countdown));
            show(servePicker, state.phase === 'serve' && state.serverId === game.player.id);
            if (!servePicker.hidden) {
                for (const choice of serveButtons) {
                    const pressed = String(Number(choice.dataset.serve) === state.serve);
                    if (choice.getAttribute('aria-pressed') !== pressed) choice.setAttribute('aria-pressed', pressed);
                }
            }
            const timing = state.serveTiming;
            show(serveMeter, timing !== null && !servePicker.hidden);
            if (!serveMeter.hidden && timing !== null) {
                const [start, end] = game.serveWindow();
                serveMeter.style.setProperty('--start', `${start * 100}%`);
                serveMeter.style.setProperty('--end', `${end * 100}%`);
                serveMeter.style.setProperty('--timing', `${timing * 100}%`);
                serveMeter.dataset.window = String(state.serveReady);
                serveProgress.value = timing;
                setText(serveCue, state.serveReady ? 'Bata agora' : 'Espere o ponto de contato');
            }
            if (state.feedbackId !== previousFeedback) {
                previousFeedback = state.feedbackId;
                feedbackUntil = time + 1400;
                setText(gameFeedback, state.feedback);
            }
            show(gameFeedback, time < feedbackUntil && Boolean(state.feedback));
            if (state.phase !== previousPhase) {
                result.hidden = state.phase !== 'finished';
                if (!result.hidden) {
                    setText(resultLabel, state.score.player > state.score.opponent
                        ? 'Você venceu' : state.teamSize === 1 ? 'Vitória do bot' : 'Vitória do time azul');
                    replayButton.focus({ preventScroll: true });
                }
                previousPhase = state.phase;
            }
        }

        renderer.setAnimationLoop(time => {
            if (!ready) return;
            if (setup.open) {
                previousFrame = 0;
                return;
            }
            accumulated += previousFrame ? Math.min((time - previousFrame) / 1000, 0.1) : 0;
            previousFrame = time;
            const h = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
            const v = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
            while (accumulated >= STEP) {
                game.step({
                    x: right.x * h + forward.x * v, z: right.z * h + forward.z * v, jump, block: keys.has('Space'),
                    leftHeld, leftPress: leftTaps > 0, rightPress: rightTaps > 0, setPress: setTaps > 0,
                    ...(view.aim.visible ? { aim: { x: hit.x, z: hit.z } } : {}),
                    ...(serve ? { serve } : {}),
                });
                jump = false;
                leftTaps = Math.max(0, leftTaps - 1);
                rightTaps = Math.max(0, rightTaps - 1);
                setTaps = Math.max(0, setTaps - 1);
                serve = undefined;
                accumulated -= STEP;
                stride += STEP * 13;
            }

            for (const side of ['player', 'opponent'] as const) {
                const athletes = game.teams[side];
                for (const [index, { model, shadow, pose }] of view.teams[side].entries()) {
                    const athlete = athletes[index];
                    model.visible = shadow.visible = Boolean(athlete);
                    if (!athlete) continue;
                    model.position.set(athlete.x, athlete.y, athlete.z);
                    model.rotation.y = athlete.heading;
                    pose(athlete.action === 'move' ? 'run' : athlete.action === 'idle' && athlete.y > 0 ? 'jump' : athlete.action, stride);
                    shadow.position.x = athlete.x;
                    shadow.position.z = athlete.z;
                }
            }
            view.updatePickups(game.state.pickups);
            const ball = game.ballPosition();
            const rotation = game.ballRotation();
            view.ball.position.set(ball.x, ball.y, ball.z);
            view.ball.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            view.ballShadow.position.x = ball.x;
            view.ballShadow.position.z = ball.z;
            view.ballShadow.visible = Math.abs(ball.x) < COURT.sandWidth / 2 && Math.abs(ball.z) < COURT.sandLength / 2;
            const landing = game.landingPoint();
            view.landing.visible = Boolean(landing && Math.abs(landing.x) <= COURT.sandWidth / 2
                && Math.abs(landing.z) <= COURT.sandLength / 2);
            if (landing && view.landing.visible) view.landing.position.set(landing.x, 0.03, landing.z);
            renderHUD(time);
            renderer.render(view.scene, camera);
        });
    } catch (error) {
        renderer.dispose();
        throw error;
    }
}

void start().catch(error => {
    console.error(error);
    notice.hidden = false;
    notice.textContent = 'Não foi possível abrir a quadra 3D. Use um navegador com WebGL 2 ou abra o Treino 2D.';
    playfield.setAttribute('aria-busy', 'false');
});
