import { expect, test } from '@playwright/test';
import { BALL_RADIUS, COURT, createSimulation } from '../src/arena3d/simulation';

const idle = { x: 0, z: 0, jump: false };

test('limita o jogador ao seu lado, permite sair das linhas e pular outra vez depois de pousar', async () => {
    const simulation = await createSimulation();
    try {
        for (let i = 0; i < 180; i++) simulation.step({ x: 1, z: -1, jump: false });
        expect(simulation.player.x).toBe(COURT.playerLimit.x);
        expect(simulation.player.x).toBeGreaterThan(COURT.halfWidth);
        expect(simulation.player.z).toBe(COURT.playerLimit.near);
        simulation.step({ ...idle, jump: true });
        for (let i = 0; i < 30; i++) simulation.step(idle);
        expect(simulation.player.y).toBeGreaterThan(1);
        for (let i = 0; i < 60; i++) simulation.step(idle);
        expect(simulation.player.y).toBe(0);
        simulation.step({ ...idle, jump: true });
        expect(simulation.player.y).toBeGreaterThan(0);
    } finally {
        simulation.dispose();
    }
});

test('a bola passa por cima da rede no lançamento alto e fica do próprio lado no lançamento baixo', async () => {
    const simulation = await createSimulation();
    try {
        simulation.launch({ x: 1, z: -5.7 });
        for (let i = 0; i < 30; i++) simulation.step(idle);
        expect(simulation.ballPosition().y).toBeGreaterThan(COURT.netHeight + BALL_RADIUS);
        for (let i = 0; i < 100; i++) simulation.step(idle);
        expect(simulation.ballPosition().z).toBeLessThan(-5);
        expect(simulation.ballPosition().y).toBeCloseTo(BALL_RADIUS, 1);

        simulation.launch({ x: 0, z: -1 });
        let closest = Infinity;
        for (let i = 0; i < 82; i++) {
            simulation.step(idle);
            closest = Math.min(closest, simulation.ballPosition().z);
        }
        expect(closest).toBeGreaterThan(0);
        expect(closest).toBeLessThan(1);
    } finally {
        simulation.dispose();
    }
});

test('a página inicial abre a quadra 3D e permite alternar câmeras pelo teclado e pelo botão', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const playfield = page.getByRole('region', { name: 'Quadra 3D' });
    const canvas = playfield.locator('canvas');
    await expect(canvas).toBeVisible();
    const buffer = await canvas.evaluate(element => {
        const field = element as HTMLCanvasElement;
        return { width: field.width, ratio: field.width / field.height, filter: getComputedStyle(field).imageRendering };
    });
    expect(buffer.width).toBeGreaterThan(480);
    expect(buffer.ratio).toBeCloseTo(16 / 9, 1);
    expect(buffer.filter).toBe('auto');
    await expect(page.getByRole('button', { name: /Câmera de trás/ })).toBeEnabled();
    await page.keyboard.press('n');
    await page.getByRole('button', { name: /Câmera lateral/ }).click();
    await expect(playfield).toBeFocused();
    await expect(page.getByRole('button', { name: /Câmera de trás/ })).toBeEnabled();
    await expect(page.locator('#game-status')).toBeInViewport();
    const rect = await canvas.boundingBox();
    await canvas.click({ position: { x: rect!.width / 2, y: rect!.height * 0.6 } });
    await page.keyboard.press('Space');
    expect(errors).toEqual([]);
});

test('a arena 3D entra em tela cheia e devolve o foco à quadra ao sair', async ({ page }) => {
    await page.goto('/');
    const playfield = page.getByRole('region', { name: 'Quadra 3D' });
    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    const exit = page.getByRole('button', { name: 'Sair da tela cheia' });
    await expect(exit).toHaveAttribute('aria-pressed', 'true');
    await expect(playfield).toBeFocused();
    expect(await page.locator('#arena').evaluate(arena => document.fullscreenElement === arena
        || arena.classList.contains('is-expanded'))).toBe(true);
    await exit.click();
    await expect(page.getByRole('button', { name: 'Tela cheia', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(playfield).toBeFocused();
});

test('a arena usa a janela inteira no modo alternativo e sai com Escape', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    const arena = page.locator('#arena');
    await expect(arena).toHaveClass(/is-expanded/);
    expect(await arena.evaluate(element => {
        const { width, height } = element.getBoundingClientRect();
        return width === innerWidth && height === innerHeight;
    })).toBe(true);
    await page.keyboard.press('n');
    await expect(page.getByRole('button', { name: /Câmera lateral/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(arena).not.toHaveClass(/is-expanded/);
});

test('dá para entrar no treino, repetir o exercício e abrir uma partida com placar', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 640 });
    const start = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.goto('/');
    const status = page.locator('#game-status');
    await page.getByLabel('Exercício').selectOption('serve');
    await page.getByRole('button', { name: 'Treinar', exact: true }).evaluate(button => (button as HTMLElement).click());
    await page.clock.runFor(2150);
    await expect(status).toHaveText('Clique para lançar a bola', { timeout: 10_000 });
    const canvas = page.locator('#playfield canvas');
    const rect = await canvas.boundingBox();
    const x = rect!.x + rect!.width * 0.56;
    const y = rect!.y + rect!.height * 0.38;
    await page.mouse.click(x, y);
    await page.clock.runFor(580);
    await expect(page.locator('#serve-meter')).toHaveAttribute('data-window', 'true');
    await page.mouse.click(x, y);
    await page.clock.runFor(60);
    await expect(page.locator('#serve-meter')).toBeHidden();
    await expect(page.locator('#game-feedback')).toHaveText('Normal');
    await page.keyboard.press('r');
    await page.clock.runFor(60);
    await expect(page.locator('#countdown')).toBeVisible();
    await page.getByLabel('Formato').selectOption('1');
    await page.getByRole('button', { name: 'Jogar 1v1' }).evaluate(button => (button as HTMLElement).click());
    await page.clock.runFor(60);
    await expect(page.locator('#scoreboard')).toBeVisible();
    await expect(page.locator('#score-player')).toHaveText('0');
    await expect(page.locator('#score-opponent')).toHaveText('0');
});

test('dois botões do mouse no ar armam a cravada pelo navegador', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 640 });
    const start = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.goto('/');
    await page.getByLabel('Exercício').selectOption('attack');
    await page.getByRole('button', { name: 'Treinar', exact: true }).evaluate(button => (button as HTMLElement).click());
    await page.clock.runFor(2100);
    await page.keyboard.press('Space');
    await page.clock.runFor(250);
    const rect = await page.locator('#playfield canvas').boundingBox();
    await page.mouse.move(rect!.x + rect!.width * 0.55, rect!.y + rect!.height * 0.38);
    await page.mouse.down({ button: 'left' });
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.mouse.up({ button: 'left' });
    await page.clock.runFor(160);
    await expect(page.locator('#game-feedback')).toHaveText('Cravada');
});

test('configura vagas e power-ups e inicia uma partida 3v3', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Jogar 2v2' })).toBeEnabled();
    await page.getByLabel('Formato').selectOption('3');
    await page.getByRole('button', { name: 'Equipes e bônus' }).click();
    const dialog = page.getByRole('dialog', { name: 'Equipes e bônus' });
    await expect(dialog.getByRole('combobox')).toHaveCount(5);
    const partner = dialog.getByLabel('Parceiro 1');
    const opponent = dialog.getByLabel('Adversário 2');
    await partner.selectOption('brutal');
    await opponent.selectOption('');
    await expect(page.locator('#play-match')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Completar com bots' }).click();
    await expect(partner).toHaveValue('brutal');
    await expect(opponent).toHaveValue('medium');
    await dialog.getByRole('checkbox', { name: 'Ativar power-ups' }).check();
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Jogar 3v3' }).click();
    await expect(page.locator('#scoreboard')).toContainText('Time laranja');
    await expect(page.locator('#scoreboard')).toContainText('Time azul');
    await expect(page.locator('#countdown')).toBeVisible();
});
