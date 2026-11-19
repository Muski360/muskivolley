import { expect, test } from '@playwright/test';
import { BOT_DIFFICULTIES } from '../src/bots';
import { BUFF_DURATION_SECONDS, BUFF_JUMP_MULTIPLIER, BUFF_SPEED_MULTIPLIER, type BuffKind } from '../src/buffs';
import { Volleyball, type GameInput, type MatchOptions } from '../src/game';

const tick = 1 / 60;

function waitUntil(match: Volleyball, condition: () => boolean, seconds = 5, input: GameInput = {}) {
    for (let frame = 0; frame < seconds / tick && !condition(); frame++) match.step(tick, input);
    expect(condition()).toBe(true);
}

function ready(options?: MatchOptions) {
    const match = new Volleyball();
    match.start('Muski', options);
    waitUntil(match, () => match.state.phase === 'serve');
    return match;
}

// Seed the ball at a controlled point in a rally without altering the simulation of the contact.
function isolateFlight(match: Volleyball, remaining = 12, serve?: 1 | 3) {
    const person = match.state.players[0];
    const blue = match.state.players[2];
    const from = serve ? { x: person.x, y: person.y, z: 50 } : { x: 405, y: 70, z: 10 };
    const to = { ...from, z: 0 };
    match.state.phase = 'rally';
    match.state.ball = from;
    Object.assign(match, {
        flight: {
            from, to, elapsed: 0, duration: remaining + tick, gravity: 0,
            stage: serve ? 'incoming' : 'loose',
            actor: blue, team: serve ? 'red' : 'blue', serve, pointFor: 'red',
        },
    });
}

function findPickup(match: Volleyball, kind: BuffKind) {
    expect(match.state.pickups).toHaveLength(2);
    const red = match.state.pickups.find(pickup => pickup.team === 'red')!;
    const blue = match.state.pickups.find(pickup => pickup.team === 'blue')!;
    expect([red.kind, red.x, red.y]).toEqual([kind, -blue.x, blue.y]);
    expect(blue.kind).toBe(kind);
    return red;
}

function nextServe(match: Volleyball) {
    isolateFlight(match, .03);
    waitUntil(match, () => match.state.phase === 'point');
    waitUntil(match, () => match.state.phase === 'serve');
}

test('a partida usa os níveis configurados por vaga e mantém buffs desligados por padrão', () => {
    const standard = ready();
    expect(standard.state.players.slice(1).map(bot => bot.difficulty)).toEqual(['medium', 'medium', 'medium']);
    expect(standard.state.buffsEnabled).toBe(false);
    expect(standard.state.pickups).toHaveLength(0);

    const configured = ready({ bots: ['easy', 'hard', 'brutal'] });
    expect(configured.state.players.slice(1).map(bot => [bot.team, bot.difficulty])).toEqual([
        ['red', 'easy'], ['blue', 'hard'], ['blue', 'brutal'],
    ]);
    expect(BOT_DIFFICULTIES.easy.reaction).toBeGreaterThan(BOT_DIFFICULTIES.brutal.reaction);
    expect(BOT_DIFFICULTIES.easy.receiveSuccess).toBeLessThan(BOT_DIFFICULTIES.brutal.receiveSuccess);

    const movement = (difficulty: 'easy' | 'brutal') => {
        const match = ready({ bots: ['medium', difficulty, 'medium'] });
        const bot = match.state.players[2];
        const initialX = bot.x;
        const from = { x: -400, y: 330, z: 100 };
        match.state.phase = 'rally';
        match.state.ball = from;
        Object.assign(match, {
            flight: {
                from, to: { x: 405, y: 330, z: 0 }, duration: 1.75, elapsed: 0, gravity: 370,
                stage: 'incoming', team: 'blue', actor: match.state.players[0],
            },
        });
        for (let frame = 0; frame < 12; frame++) match.step(tick);
        return bot.x - initialX;
    };
    expect(movement('easy')).toBe(0);
    expect(movement('brutal')).toBeGreaterThan(25);
});

test('os buffs surgem em pares, exigem coleta na própria quadra e expiram em jogo', () => {
    const match = ready({ buffs: true });
    const pass = findPickup(match, 'pass');
    const person = match.state.players[0];
    match.step(tick, { space: true });
    waitUntil(match, () => person.y <= pass.y + 3, 1, { right: true, up: true });
    waitUntil(match, () => person.buff?.kind === 'pass', 1, { right: true });
    expect(person.buff?.kind).toBe('pass');
    expect(person.buff?.remaining).toBeGreaterThan(BUFF_DURATION_SECONDS - 1);
    expect(match.state.pickups.some(pickup => pickup.team === 'red')).toBe(false);
    expect(match.state.pickups.some(pickup => pickup.team === 'blue')).toBe(true);

    isolateFlight(match);
    waitUntil(match, () => person.buff === undefined, BUFF_DURATION_SECONDS + 1);
    nextServe(match);
    findPickup(match, 'speed');
    nextServe(match);
    findPickup(match, 'jump');
});

test('os efeitos mudam o movimento, o salto e a recepção dentro dos limites das regras', () => {
    const distances = ['speed', undefined].map(kind => {
        const match = ready({ buffs: true });
        const person = match.state.players[0];
        if (kind) person.buff = { kind: 'speed', remaining: BUFF_DURATION_SECONDS };
        isolateFlight(match);
        const startX = person.x;
        match.step(tick, { right: true });
        return person.x - startX;
    });
    expect(distances[0] / distances[1]).toBeCloseTo(BUFF_SPEED_MULTIPLIER, 2);

    const jumps = ['jump', undefined].map(kind => {
        const match = ready({ buffs: true });
        const person = match.state.players[0];
        Object.assign(person, { x: -33, y: 240 });
        if (kind) person.buff = { kind: 'jump', remaining: BUFF_DURATION_SECONDS };
        const from = { x: 42, y: 240, z: 145 };
        match.state.phase = 'rally';
        match.state.ball = from;
        Object.assign(match, {
            flight: {
                from, to: { x: -280, y: 240, z: 0 }, duration: .9, elapsed: 0, gravity: 420,
                stage: 'incoming', team: 'red', actor: match.state.players[2], attack: 'Ataque forte',
            },
        });
        match.step(tick, { space: true });
        expect(person.action).toBe('block');
        match.step(tick);
        return person.z;
    });
    expect(jumps[0] / jumps[1]).toBeCloseTo(BUFF_JUMP_MULTIPLIER, 2);

    for (const [serve, remaining, result] of [[1, .40, 'A+'], [3, .25, 'A'], [1, .56, 'Erro']] as const) {
        const match = ready({ buffs: true });
        match.state.players[0].buff = { kind: 'pass', remaining: BUFF_DURATION_SECONDS };
        isolateFlight(match, remaining, serve);
        match.step(tick, { space: true });
        expect(match.state.feedback?.text).toBe(result);
    }
});

test('o lobby mantém as escolhas e completa apenas as vagas livres', async ({ page }) => {
    await page.goto('/treino-2d.html');
    await page.getByRole('button', { name: 'Jogar', exact: true }).click();
    const start = page.getByRole('button', { name: 'Começar partida' });
    const fill = page.getByRole('button', { name: 'Completar com bots' });
    const buffs = page.locator('#buffs-enabled');
    const difficulty = (slot: number) => page.locator(`[data-bot-difficulty="${slot}"]`);
    await expect(buffs).not.toBeChecked();
    await expect(start).toBeHidden();
    await page.locator('[data-add-bot="1"]').click();
    await difficulty(1).selectOption('brutal');
    await fill.click();
    await expect(difficulty(1)).toHaveValue('brutal');
    await expect(difficulty(2)).toHaveValue('medium');
    await expect(difficulty(3)).toHaveValue('medium');
    await expect(start).toBeEnabled();
    await page.locator('[data-remove-bot="2"]').click();
    await expect(start).toBeHidden();
    await page.locator('[data-add-bot="2"]').click();
    await difficulty(2).selectOption('easy');
    await buffs.check();
    await start.click();
    await expect(page.locator('#match-status')).toHaveText('Saque');
    await expect(page.locator('#blue-player')).toContainText('Nina · Bot');
});
