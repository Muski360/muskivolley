import { expect, test } from '@playwright/test';
import { BUFF_DURATION_SECONDS, BUFF_JUMP_MULTIPLIER, BUFF_SPEED_MULTIPLIER } from '../src/buffs';
import { createRally, type MatchFormat, type MatchOptions, type RallyInput } from '../src/arena3d/rally';
import { COURT, STEP } from '../src/arena3d/simulation';

type Game = Awaited<ReturnType<typeof createRally>>;
const idle: RallyInput = { x: 0, z: 0, jump: false };

const step = (game: Game, input: Partial<RallyInput> = {}) => game.step({ ...idle, ...input });
const config = (teamSize: MatchFormat, buffs = false): MatchOptions => ({
    teamSize, homeBots: ['hard', 'brutal'], awayBots: ['easy', 'medium', 'hard'], buffs,
});

function until(game: Game, condition: () => boolean, next = () => step(game), frames = 600) {
    for (let i = 0; i < frames && !condition(); i++) next();
    expect(condition(), `${game.state.phase} · ${game.state.message} · ${game.state.feedback}`).toBe(true);
}

function start(game: Game, options: MatchOptions) {
    game.start('match', undefined, options);
    until(game, () => game.state.phase === 'serve');
}

function incoming(game: Game) {
    step(game, { leftPress: true });
    step(game, { leftPress: true });
    expect(game.state.serverId).toBe('opponent-0');
    until(game, () => game.state.phase === 'rally');
}

function receive(game: Game, aim: { x: number; z: number }) {
    until(game, () => game.ballPosition().z > 1);
    until(game, () => game.state.feedback.startsWith('Manchete'), () => {
        const ball = game.ballPosition();
        game.player.x = ball.x;
        game.player.z = ball.z;
        step(game, { leftHeld: true, aim });
    });
}

test('mantém escalações por formato e as recupera na revanche', async () => {
    const game = await createRally();
    try {
        for (const size of [1, 2, 3] as const) {
            start(game, config(size));
            expect(game.state.teamSize).toBe(size);
            expect(game.teams.player).toHaveLength(size);
            expect(game.teams.opponent).toHaveLength(size);
            expect(game.teams.player.map(athlete => athlete.difficulty)).toEqual([undefined, 'hard', 'brutal'].slice(0, size));
            expect(game.teams.opponent.map(athlete => athlete.difficulty)).toEqual(['easy', 'medium', 'hard'].slice(0, size));
            expect(game.state.pickups).toEqual([]);
        }
        game.start('practice');
        expect(game.teams.player).toHaveLength(1);
        game.replay();
        expect(game.state.teamSize).toBe(3);
        expect(game.teams.player[2].difficulty).toBe('brutal');
        expect(game.state.serverId).toBe(game.player.id);
    } finally { game.dispose(); }
});

test('alterna o sacador a cada retomada do saque e o mantém nos pontos consecutivos', async () => {
    const game = await createRally();
    try {
        start(game, config(2));
        incoming(game);
        receive(game, { x: -4.2, z: -9 });
        until(game, () => game.state.phase === 'point', () => {
            for (const rival of game.teams.opponent) {
                rival.x = COURT.playerLimit.x;
                rival.z = -COURT.playerLimit.far;
            }
            step(game);
        });
        expect(game.state.score).toEqual({ player: 1, opponent: 1 });
        expect(game.state.serverId).toBe('player-1');
        until(game, () => game.state.phase === 'rally');
        until(game, () => game.state.phase === 'point', () => {
            for (const rival of game.teams.opponent) {
                rival.x = COURT.playerLimit.x;
                rival.z = -COURT.playerLimit.far;
            }
            step(game);
        });
        expect(game.state.score.player).toBe(2);
        expect(game.state.serverId).toBe('player-1');
    } finally { game.dispose(); }
});

test('marca infração quando o mesmo atleta recebe e levanta em 2v2', async () => {
    const game = await createRally();
    try {
        start(game, config(2));
        incoming(game);
        receive(game, { x: -.1, z: 6.8 });
        expect(game.state.touches).toBe(1);
        const parkPartner = (input: Partial<RallyInput> = {}) => {
            game.teams.player[1].x = COURT.playerLimit.x;
            game.teams.player[1].z = COURT.playerLimit.near;
            game.player.x = -.1;
            game.player.z = 6.8;
            step(game, input);
        };
        for (let i = 0; i < 60; i++) parkPartner();
        until(game, () => game.ballPosition().y < 2.85, parkPartner);
        parkPartner({ setPress: true });
        until(game, () => game.state.phase === 'point', parkPartner);
        expect(game.state.feedback).toBe('Dois toques seguidos');
        expect(game.state.score.opponent).toBe(2);
    } finally { game.dispose(); }
});

test('bônus espelhados recolhem do próprio lado e afetam passe, velocidade e salto', async () => {
    const game = await createRally();
    try {
        start(game, config(1, true));
        const [left, right] = game.state.pickups;
        expect(left).toMatchObject({ side: 'player', kind: 'pass' });
        expect(right).toMatchObject({ side: 'opponent', kind: left.kind, x: left.x, z: -left.z });
        incoming(game);
        const pickup = game.state.pickups.find(item => item.side === 'player')!;
        expect(pickup.kind).toBe('speed');
        Object.assign(game.player, { x: pickup.x, z: pickup.z });
        step(game);
        expect(game.player.buff).toEqual({ kind: 'speed', remaining: BUFF_DURATION_SECONDS });
        expect(game.state.pickups.some(item => item.side === 'player')).toBe(false);
        const x = game.player.x;
        step(game, { x: 1 });
        expect(game.player.x - x).toBeCloseTo(5.5 * STEP * BUFF_SPEED_MULTIPLIER, 4);
        game.player.buff!.remaining = 2 * STEP;
        step(game);
        step(game);
        expect(game.player.buff).toBeUndefined();

        game.player.buff = { kind: 'jump', remaining: BUFF_DURATION_SECONDS };
        step(game, { jump: true });
        expect(game.player.y).toBeCloseTo(4.8 * STEP * Math.sqrt(BUFF_JUMP_MULTIPLIER), 4);

        game.start('practice');
        until(game, () => game.state.phase === 'rally');
        game.player.buff = { kind: 'pass', remaining: BUFF_DURATION_SECONDS };
        until(game, () => game.state.feedback.startsWith('Manchete'), () => step(game, { leftHeld: true }));
        expect(game.state.feedback).toBe('Manchete · A+');
    } finally { game.dispose(); }
});

test('bônus conserva o tempo restante entre o ponto e o saque seguinte', async () => {
    const game = await createRally();
    try {
        start(game, config(1, true));
        incoming(game);
        const pickup = game.state.pickups.find(item => item.side === 'player')!;
        Object.assign(game.player, { x: pickup.x, z: pickup.z });
        step(game);
        until(game, () => game.state.phase === 'point');
        const left = game.player.buff!.remaining;
        expect(left).toBeGreaterThan(4);
        until(game, () => game.state.phase === 'serve');
        expect(game.player.buff).toEqual({ kind: 'speed', remaining: left });
        until(game, () => game.state.phase === 'rally');
        step(game);
        expect(game.player.buff!.remaining).toBeCloseTo(left - STEP, 6);
        game.replay();
        expect(game.player.buff).toBeUndefined();
    } finally { game.dispose(); }
});
