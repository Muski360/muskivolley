import { expect, test } from '@playwright/test';
import { createRally, type PracticeScenario, type RallyInput, type Serve } from '../src/arena3d/rally';

type Game = Awaited<ReturnType<typeof createRally>>;
const idle: RallyInput = { x: 0, z: 0, jump: false };
const step = (game: Game, input: Partial<RallyInput> = {}, frames = 1) => {
    for (let i = 0; i < frames; i++) game.step({ ...idle, ...input });
};

function until(game: Game, predicate: () => boolean, input: Partial<RallyInput> = {}, frames = 600) {
    for (let i = 0; i < frames && !predicate(); i++) step(game, input);
    expect(predicate(), `${game.state.phase} · ${game.state.message} · ${game.state.feedback}`).toBe(true);
}

function practice(game: Game, preset: PracticeScenario) {
    game.start('practice', preset);
    until(game, () => game.state.phase !== 'countdown');
}

function toss(game: Game, serve: Serve, hit = true) {
    step(game, { leftPress: true, serve });
    expect(game.state.serveTiming).toBe(0);
    if (hit) {
        step(game, {}, 35);
        expect(game.state.serveReady).toBe(true);
    }
    step(game, { leftPress: true, aim: { x: 0, z: -7.125 } });
}

test('mede a janela do saque, deixa o flutuante variar e dá mais velocidade ao viagem', async () => {
    const game = await createRally();
    try {
        const movement: number[] = [];
        for (const kind of [1, 2, 3] as const) {
            practice(game, 'serve');
            toss(game, kind);
            expect(game.state.phase).toBe('rally');
            const start = game.ballPosition();
            step(game, {}, 8);
            movement.push(start.z - game.ballPosition().z);
            if (kind === 2) {
                until(game, () => game.ballPosition().z < -.4);
                const positions = [];
                for (let i = 0; i < 25 && game.state.phase === 'rally'; i++) {
                    step(game);
                    positions.push(game.ballPosition().x);
                }
                expect(positions.length).toBeGreaterThan(18);
                expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(.25);
                expect(positions.at(-1)!).toBeLessThan(Math.max(...positions));
            }
        }
        expect(movement[2]).toBeGreaterThan(movement[1]);
        expect(movement[1]).toBeGreaterThan(movement[0]);

        practice(game, 'serve');
        toss(game, 3, false);
        expect(game.state.feedback).toBe('Erro de saque');
        expect(game.state.score.opponent).toBe(1);
    } finally { game.dispose(); }
});

test('recebe, levanta e crava no mesmo rally com os três toques do atleta', async () => {
    const game = await createRally();
    try {
        practice(game, 'receive');
        const ownAim = { x: 0, z: 1.35 };
        until(game, () => game.state.feedback.startsWith('Manchete'), { leftHeld: true, aim: ownAim });
        expect(game.state.touches).toBe(1);
        let receiveApex = 0;
        for (let i = 0; i < 47; i++) {
            step(game, { z: -1 });
            receiveApex = Math.max(receiveApex, game.ballPosition().y);
        }
        expect(receiveApex).toBeGreaterThan(3.7);
        until(game, () => game.ballPosition().y <= 2.85, {}, 65);
        step(game, { setPress: true, aim: ownAim });
        until(game, () => game.state.feedback.startsWith('Levantamento'), { aim: ownAim }, 25);
        expect(game.state.touches).toBe(2);
        let setApex = 0;
        for (let i = 0; i < 58; i++) {
            step(game);
            setApex = Math.max(setApex, game.ballPosition().y);
        }
        expect(setApex).toBeGreaterThan(5.2);
        until(game, () => game.ballPosition().y <= 4.85, {}, 45);
        step(game, { jump: true });
        until(game, () => game.ballPosition().y <= 3.11, {}, 40);
        const attack = { aim: { x: 1.5, z: -5 } };
        step(game, { ...attack, leftPress: true, rightPress: true });
        until(game, () => game.state.feedback.startsWith('Cravada'), attack, 15);
        expect(game.state.feedback).toBe('Cravada');
        expect(game.state.touches).toBe(3);
    } finally { game.dispose(); }
});

test('executa peixinho, largada e os dois ataques individuais', async () => {
    const game = await createRally();
    try {
        practice(game, 'receive');
        until(game, () => game.ballPosition().z > 4.74);
        step(game, { rightPress: true, aim: { x: .27, z: 4.9 } });
        until(game, () => game.state.feedback === 'Peixinho · B', {}, 20);

        practice(game, 'set');
        step(game, {}, 15);
        step(game, { setPress: true });
        step(game, {}, 4);
        step(game, { setPress: true, aim: { x: 1, z: -6 } });
        until(game, () => game.state.feedback === 'Largada', { aim: { x: 1, z: -6 } }, 20);

        for (const [button, label] of [
            [{ leftPress: true }, 'Ataque forte'], [{ rightPress: true }, 'Ataque colocado'],
        ] as const) {
            practice(game, 'attack');
            step(game, {}, 4);
            step(game, { jump: true });
            step(game, {}, 14);
            step(game, { ...button, aim: { x: 1.6, z: -5.7 } });
            until(game, () => game.state.feedback === label, { aim: { x: 1.6, z: -5.7 } }, 18);
        }
    } finally { game.dispose(); }
});

test('devolve a cravada bloqueada sem cobertura e repete o treino no mesmo lugar', async () => {
    const game = await createRally();
    try {
        practice(game, 'block');
        step(game, {}, 16);
        step(game, { jump: true, block: true });
        until(game, () => game.state.feedback === 'Cravada bloqueada', { block: true }, 35);
        until(game, () => game.state.phase === 'point');
        expect(game.state.feedback).toBe('Bloqueio sem cobertura');
        expect(game.state.score.player).toBe(1);
        practice(game, 'block');
        expect(game.state.score.player).toBe(0);
        expect(game.player.z).toBe(1.02);
    } finally { game.dispose(); }
});

test('encerra 16 a 14, mantém a partida aos 15 a 14 e reinicia na revanche', async () => {
    const game = await createRally();
    try {
        game.start('match');
        until(game, () => game.state.phase === 'serve');
        game.state.score.player = 14;
        game.state.score.opponent = 14;
        toss(game, 1, false);
        expect(game.state.phase).toBe('point');
        expect(game.state.score).toEqual({ player: 14, opponent: 15 });
        until(game, () => game.state.phase === 'finished');
        expect(game.state.score).toEqual({ player: 14, opponent: 16 });
        game.start('match');
        expect(game.state.score).toEqual({ player: 0, opponent: 0 });
        expect(game.state.countdown).toBe(3);
    } finally { game.dispose(); }
});

test('o bot recebe, levanta e devolve um saque no mesmo rally', async () => {
    const game = await createRally();
    try {
        game.start('match');
        until(game, () => game.state.phase === 'serve');
        toss(game, 1);
        until(game, () => game.state.feedback.startsWith('Manchete'));
        expect(game.state.possession).toBe('opponent');
        until(game, () => game.state.feedback.startsWith('Levantamento'));
        until(game, () => game.state.feedback === 'Ataque forte');
        expect(game.state.touches).toBe(3);
    } finally { game.dispose(); }
});

test('a cravada com bola afastada bate na rede e o quarto toque encerra o rally', async () => {
    const game = await createRally();
    try {
        practice(game, 'set');
        const far = { x: 0, z: 3.6 };
        step(game, {}, 15);
        step(game, { setPress: true, aim: far });
        until(game, () => game.state.feedback === 'Levantamento', { aim: far });
        step(game, { z: 1 }, 21);
        step(game, {}, 24);
        until(game, () => game.ballPosition().y <= 4.85, {}, 45);
        step(game, { jump: true });
        until(game, () => game.ballPosition().y <= 3.11, {}, 40);
        step(game, { leftPress: true, rightPress: true, aim: { x: 0, z: -5.7 } });
        until(game, () => game.state.feedback === 'Cravada na rede', {}, 15);
        until(game, () => game.state.phase === 'point');
        expect(game.state.score.opponent).toBe(1);

        practice(game, 'receive');
        until(game, () => game.state.possession === 'player');
        game.state.touches = 3;
        until(game, () => game.state.feedback === 'Quatro toques', { leftHeld: true });
        expect(game.state.score.opponent).toBe(1);
    } finally { game.dispose(); }
});
