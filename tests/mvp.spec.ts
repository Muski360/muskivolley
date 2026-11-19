import { expect, test } from '@playwright/test';
import { Volleyball } from '../src/game';

test('monta a sessão local, saca com o teclado e atualiza o placar', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/treino-2d.html');
    const court = page.locator('#game-canvas canvas');
    await expect(court).toBeVisible();
    await expect(court).toHaveAttribute('width', '480');
    await expect(page.locator('#game-canvas .court-name')).toHaveCount(4);
    await page.getByLabel('Seu nome').fill('Muski Teste');
    await page.getByRole('button', { name: 'Jogar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sala de treino' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Começar partida' })).toBeHidden();
    await page.getByRole('button', { name: 'Completar com bots' }).click();
    await expect(page.getByText('Nina · Bot')).toBeVisible();
    await page.getByRole('button', { name: 'Começar partida' }).click();
    await expect(page.locator('#countdown')).toBeVisible();
    await expect(page.locator('.court-name').first()).toHaveText('Muski Teste');
    await expect(page.locator('#match-status')).toHaveText('Saque');
    await page.keyboard.press('Space');
    await expect(page.locator('#match-status')).toHaveText('Bola em jogo');
    await expect.poll(async () => {
        const [red, blue] = await page.locator('#score-red, #score-blue').allTextContents();
        return Number(red) + Number(blue);
    }, { timeout: 25_000 }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('mantém as preferências do menu ao recarregar', async ({ page }) => {
    await page.goto('/treino-2d.html');
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByLabel('Textos de ação').selectOption('off');
    await page.getByRole('button', { name: 'Fechar configurações' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Configurações' }).click();
    await expect(page.getByLabel('Textos de ação')).toHaveValue('off');
});

test('uma partida simulada termina com dois de vantagem e pode reiniciar', () => {
    const match = new Volleyball();
    const { state } = match;
    match.start('Muski');
    const feedback = new Set<string>();
    for (let frame = 0; frame < 36_000 && state.phase !== 'finished'; frame++) {
        match.step(1 / 60, { space: state.phase === 'serve' && state.server === 'red' });
        if (state.feedback) feedback.add(state.feedback.text);
    }
    expect(feedback.has('Normal')).toBeTruthy();
    expect(feedback.has('+1')).toBeTruthy();
    expect(state.phase).toBe('finished');
    expect(Math.max(state.red, state.blue)).toBeGreaterThanOrEqual(15);
    expect(Math.abs(state.red - state.blue)).toBeGreaterThanOrEqual(2);
    match.start('Muski');
    expect([state.red, state.blue, state.phase, state.countdown]).toEqual([0, 0, 'countdown', 3]);
});
