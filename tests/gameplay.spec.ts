import { expect, test } from '@playwright/test';
import { COURT, Volleyball, type GameInput, type Player } from '../src/game';

const STEP = 1 / 120;

function advanceUntil(match: Volleyball, done: () => boolean, seconds = 4) {
    for (let remaining = Math.ceil(seconds / STEP); remaining > 0 && !done(); remaining--) {
        match.step(STEP);
    }
    expect(done()).toBe(true);
}

function atServe() {
    const match = new Volleyball();
    match.start('Muski');
    advanceUntil(match, () => match.state.phase === 'serve');
    return match;
}

type FlightFixture = {
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    duration: number;
    elapsed?: number;
    gravity?: number;
    stage?: 'incoming' | 'set' | 'attack';
    team?: Player['team'];
    actor?: Player;
    serve?: 1 | 2 | 3;
    grade?: 'A+' | 'A' | 'B';
    attack?: 'Ataque forte' | 'Shot' | 'Ataque fraco' | 'Largada';
};

// Seed a ball already in flight to exercise a single contact via the same public step used by the court.
function setFlight(match: Volleyball, flight: FlightFixture) {
    match.state.phase = 'rally';
    match.state.ball = { ...flight.from };
    Object.assign(match, {
        flight: { elapsed: 0, gravity: 420, stage: 'incoming', team: 'red', actor: match.state.players[2], ...flight },
    });
}

function readyToReceive(match: Volleyball, remaining: number, serve: NonNullable<FlightFixture['serve']> = 1) {
    const { x, y } = match.state.players[0];
    setFlight(match, {
        from: { x, y, z: 52 }, to: { x, y, z: 0 }, duration: remaining + STEP, serve,
    });
}

function readyToSet(match: Volleyball, grade: NonNullable<FlightFixture['grade']>, remaining: number) {
    const player = match.state.players[0];
    const duration = .72;
    setFlight(match, {
        from: { x: player.x, y: player.y, z: 118 }, to: { x: player.x, y: player.y, z: 118 },
        actor: player, duration, stage: 'set', grade,
    });
    for (let time = STEP; time < duration - remaining; time += STEP) match.step(STEP);
}

test('os três saques cruzam a rede em ritmo próprio e os avançados podem falhar', () => {
    const crossingTimes = [];
    const crossingDepths = [];
    for (const [serve, name] of [[1, 'Normal'], [2, 'Flutuante'], [3, 'Viagem']] as const) {
        const match = atServe();
        if (serve !== 1) {
            match.step(STEP, { serve });
            advanceUntil(match, () => match.state.timing?.progress !== undefined && match.state.timing.progress >= .55, 1);
            expect(match.state.timing).toMatchObject({ action: 'serve', active: true, ideal: true });
        }
        match.step(STEP, { space: true });
        expect(match.state.feedback?.text).toBe(name);
        let frames = 0;
        while (match.state.ball.x <= 0 && frames < 2 / STEP) {
            match.step(STEP);
            frames++;
        }
        expect(match.state.ball.x).toBeGreaterThan(0);
        expect(match.state.phase).toBe('rally');
        expect(match.state.ball.z).toBeGreaterThan(COURT.netHeight);
        crossingTimes.push(frames);
        crossingDepths.push(match.state.ball.y);

        if (serve !== 1) {
            const mistimed = atServe();
            mistimed.step(STEP, { serve, space: true });
            expect(mistimed.state.feedback).toMatchObject({ text: 'Erro de saque', kind: 'error' });
            advanceUntil(mistimed, () => mistimed.state.phase === 'point', 2);
            expect(mistimed.state.blue).toBe(1);
            expect(mistimed.state.message).toContain('Erro de saque');
        }
    }
    expect(crossingTimes[0]).toBeGreaterThan(crossingTimes[1]);
    expect(crossingTimes[1]).toBeGreaterThan(crossingTimes[2]);
    expect(Math.abs(crossingDepths[1] - crossingDepths[0])).toBeGreaterThan(8);

    for (const [serve, active] of [[2, true], [3, false]] as const) {
        const match = atServe();
        match.step(STEP, { serve });
        advanceUntil(match, () => (match.state.timing?.progress ?? 0) >= .35, 1);
        expect(match.state.timing?.active).toBe(active);
    }
});

test('recepção avalia o timing, pune erro e limita um passe contra viagem a A', () => {
    for (const [seconds, serve, title, color] of [
        [.17, 1, 'A+', 'green'], [.29, 1, 'A', 'teal'], [.40, 1, 'B', 'yellow'], [.17, 3, 'A', 'teal'],
    ] as const) {
        const match = atServe();
        readyToReceive(match, seconds, serve);
        match.step(STEP, { space: true });
        expect(match.state.feedback).toMatchObject({ text: title, kind: color });
        expect(match.state.players[0].action).toBe('receive');
    }

    for (const seconds of [.56, .02]) {
        const mistimed = atServe();
        readyToReceive(mistimed, seconds);
        mistimed.step(STEP, { space: true });
        expect(mistimed.state.feedback).toMatchObject({ text: 'Erro', kind: 'error' });
        advanceUntil(mistimed, () => mistimed.state.phase === 'point', 2);
        expect(mistimed.state.blue).toBe(1);
    }
});

test('o levantador salta, acerta o levantamento perfeito e só larga com A ou A+', () => {
    const match = atServe();
    readyToSet(match, 'A+', .25);
    expect(match.state.players[0].z).toBeGreaterThan(0);
    expect(match.state.timing).toMatchObject({ action: 'set', active: true, ideal: true });
    match.step(STEP, { space: true });
    expect(match.state.feedback?.text).toBe('Levantamento perfeito');

    for (const grade of ['A+', 'A'] as const) {
        const allowed = atServe();
        readyToSet(allowed, grade, .12);
        allowed.step(STEP, { s: true });
        expect(allowed.state.feedback?.text).toBe('Largada');
    }
    const forbidden = atServe();
    readyToSet(forbidden, 'B', .12);
    forbidden.step(STEP, { s: true });
    expect(forbidden.state.feedback?.text).not.toBe('Largada');
    forbidden.step(STEP, { space: true });
    expect(forbidden.state.feedback?.text).toMatch(/^Levantamento/);

    const earlyA = atServe();
    readyToSet(earlyA, 'A', .25);
    earlyA.step(STEP, { s: true });
    expect(earlyA.state.feedback?.text).not.toBe('Largada');
});

test('o atacante usa W W para força, W S para shot e rebate fraco sem comando', () => {
    const cases: Array<{ secondKey?: GameInput; outcome: string }> = [
        { secondKey: { w: true }, outcome: 'Ataque forte' },
        { secondKey: { s: true }, outcome: 'Shot' },
        { outcome: 'Ataque fraco' },
    ];
    for (const { secondKey, outcome } of cases) {
        const match = atServe();
        const player = match.state.players[0];
        setFlight(match, {
            from: { x: player.x, y: player.y, z: 142 }, to: { x: player.x, y: player.y, z: 142 },
            actor: player, stage: 'attack', duration: .66,
        });
        advanceUntil(match, () => player.z > 5, .55);
        if (secondKey) {
            match.step(STEP, { w: true });
            for (let tick = 0; tick < 6; tick++) match.step(STEP);
            match.step(STEP, secondKey);
        }
        advanceUntil(match, () => match.state.feedback?.text === outcome, 1);
        expect(player.action).toBe('attack');
    }
});

test('Espaço perto da rede produz os três resultados de bloqueio conforme o contato', () => {
    for (const [offset, outcome] of [[0, 'Bloqueio'], [40, 'Amorteceu'], [62, 'Explorou o bloqueio']] as const) {
        const match = atServe();
        const defender = match.state.players[0];
        Object.assign(defender, { x: -33, y: 240 + offset });
        setFlight(match, {
            from: { x: 42, y: 240, z: 145 }, to: { x: -280, y: 240, z: 0 }, duration: .9,
            attack: 'Ataque forte',
        });
        match.step(STEP, { space: true });
        advanceUntil(match, () => match.state.feedback?.text === outcome, .7);
        expect(defender.action).toBe('block');
        if (outcome === 'Amorteceu') {
            advanceUntil(match, () => match.state.ball.x < -65, .5);
            expect(match.state.phase).toBe('rally');
        } else if (outcome === 'Bloqueio') {
            advanceUntil(match, () => match.state.ball.x > 0, .5);
            expect(match.state.phase).toBe('rally');
        } else {
            advanceUntil(match, () => match.state.phase === 'point', 2);
            expect(match.state.blue).toBe(1);
        }
    }
});

test('a rede bloqueia a bola baixa e cair fora dá ponto à defesa', () => {
    const net = atServe();
    setFlight(net, { from: { x: 40, y: 240, z: 16 }, to: { x: -70, y: 240, z: 0 }, duration: .3 });
    advanceUntil(net, () => net.state.feedback?.text === 'Rede', 1);
    expect(net.state.ball.z).toBeGreaterThan(0);
    advanceUntil(net, () => net.state.phase === 'point', 1);
    expect(net.state.red).toBe(1);

    const outside = atServe();
    setFlight(outside, {
        from: { x: -250, y: 450, z: 4 }, to: { x: -250, y: COURT.depth + 20, z: 0 }, duration: .12,
    });
    advanceUntil(outside, () => outside.state.phase === 'point', 1);
    expect(outside.state.red).toBe(1);
    expect(outside.state.ball.y).toBeGreaterThan(COURT.depth);
});

test('15 a 14 mantém a partida, 16 a 14 encerra e a revanche reinicia com as mesmas equipes', () => {
    const match = atServe();
    match.state.red = match.state.blue = 14;
    const scoreForRed = () => {
        setFlight(match, {
            actor: match.state.players[0], team: 'blue',
            from: { x: 410, y: 70, z: 6 }, to: { x: 410, y: 70, z: 0 }, duration: .1,
        });
        advanceUntil(match, () => match.state.phase === 'point', 1);
    };
    const roster = match.state.players.map(({ name, team }) => ({ name, team }));
    scoreForRed();
    expect([match.state.red, match.state.blue]).toEqual([15, 14]);
    advanceUntil(match, () => match.state.phase === 'serve', 2);
    scoreForRed();
    advanceUntil(match, () => match.state.phase === 'finished', 2);
    expect([match.state.red, match.state.blue]).toEqual([16, 14]);
    match.start('Muski');
    expect([match.state.red, match.state.blue, match.state.countdown]).toEqual([0, 0, 3]);
    expect(match.state.players.map(({ name, team }) => ({ name, team }))).toEqual(roster);
});

test('a interface seleciona saque pelo botão e pelas teclas, e devolve o foco à quadra', async ({ page }) => {
    await page.goto('/treino-2d.html');
    await page.getByRole('button', { name: 'Jogar', exact: true }).click();
    await page.getByRole('button', { name: 'Completar com bots' }).click();
    await page.getByRole('button', { name: 'Começar partida' }).click();

    const picker = page.locator('#serve-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('[data-serve="1"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('2');
    await expect(picker.locator('[data-serve="2"]')).toHaveAttribute('aria-pressed', 'true');
    await picker.locator('[data-serve="3"]').click();
    await expect(picker.locator('[data-serve="3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#game-canvas')).toBeFocused();
    await page.keyboard.press('1');
    await expect(picker.locator('[data-serve="1"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(page.locator('#match-status')).toHaveText('Bola em jogo');
    await expect(picker).toBeHidden();
});
