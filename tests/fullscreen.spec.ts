import { expect, test } from '@playwright/test';

test('a partida aceita o saque em tela cheia e a interface acompanha a saída nativa', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Jogar', exact: true }).click();
    await page.getByRole('button', { name: 'Completar com bots' }).click();
    await page.getByRole('button', { name: 'Começar partida' }).click();
    await expect(page.locator('#match-status')).toHaveText('Saque');

    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeFocused();
    await expect(page.locator('#score-red')).toBeInViewport();
    await expect(page.getByText('Tipo de saque', { exact: true })).toBeInViewport();

    const court = await page.locator('#game-canvas').boundingBox();
    expect(court!.width / court!.height).toBeCloseTo(16 / 9, 2);

    await page.keyboard.press('Space');
    await expect(page.locator('#match-status')).toHaveText('Bola em jogo');
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.getByRole('button', { name: 'Tela cheia', exact: true })).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeFocused();
});

test('a arena preenche a janela quando a tela cheia não está disponível', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
        Object.defineProperty(document, 'fullscreenEnabled', { value: false });
    });
    await page.goto('/');
    const arena = page.locator('#game-arena');

    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reduzir arena' })).toBeInViewport();
    await expect(arena).toHaveClass(/is-expanded/);
    const bounds = await arena.boundingBox();
    expect(bounds).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    await page.keyboard.press('Escape');
    await expect(arena).not.toHaveClass(/is-expanded/);
});
