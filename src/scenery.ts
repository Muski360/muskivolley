const WIDTH = 480;
const HEIGHT = 270;

// Keep the drifting sky above the profiles of the mountains, statue and palms.
const SKY_EDGE = [
    [122, 39], [147, 45], [173, 44], [193, 43], [217, 40],
    [240, 36], [257, 30], [281, 31], [302, 32], [328, 29], [346, 22],
] as const;

function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    return canvas;
}

function isFoliage(red: number, green: number, blue: number) {
    const isLeaf = red < 170 && green + 18 >= red && blue < 162;
    const isHibiscus = red > 112 && green < Math.min(103, red * 0.58) && blue < 128;
    return isLeaf || isHibiscus;
}

export function makeSceneryLayers(source: CanvasImageSource) {
    const background = makeCanvas();
    const backgroundContext = background.getContext('2d', { willReadFrequently: true })!;
    backgroundContext.drawImage(source, 0, 0, WIDTH, HEIGHT);
    const pixels = backgroundContext.getImageData(0, 0, WIDTH, HEIGHT);

    const clouds = makeCanvas();
    const cloudsContext = clouds.getContext('2d')!;
    const cloudPixels = cloudsContext.createImageData(WIDTH, HEIGHT);
    const left = SKY_EDGE[0][0];
    const right = SKY_EDGE[SKY_EDGE.length - 1][0];

    // Feather only sky pixels at the boundary. Keeping the original plate underneath
    // covers the few pixels exposed as this layer drifts over the blue sky.
    let section = 1;
    for (let x = left; x < right; x++) {
        if (x > SKY_EDGE[section][0]) section++;
        const [leftX, leftY] = SKY_EDGE[section - 1];
        const [rightX, rightY] = SKY_EDGE[section];
        const bottom = leftY + (rightY - leftY) * (x - leftX) / (rightX - leftX);
        const sideFade = Math.min(1, (x - left) / 10, (right - x) / 10);

        for (let y = 0; y < bottom; y++) {
            const index = (y * WIDTH + x) * 4;
            cloudPixels.data[index] = pixels.data[index];
            cloudPixels.data[index + 1] = pixels.data[index + 1];
            cloudPixels.data[index + 2] = pixels.data[index + 2];
            cloudPixels.data[index + 3] = 255 * Math.min(sideFade, (bottom - y) / 7);
        }
    }
    cloudsContext.putImageData(cloudPixels, 0, 0);

    const foliage = makeCanvas();
    const foliageContext = foliage.getContext('2d')!;
    const foliagePixels = foliageContext.createImageData(WIDTH, HEIGHT);
    for (let y = 178; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (x >= 105 && x < WIDTH - 105) continue;
            const index = (y * WIDTH + x) * 4;
            const red = pixels.data[index];
            const green = pixels.data[index + 1];
            const blue = pixels.data[index + 2];
            if (!isFoliage(red, green, blue)) continue;
            foliagePixels.data[index] = red;
            foliagePixels.data[index + 1] = green;
            foliagePixels.data[index + 2] = blue;
            foliagePixels.data[index + 3] = 255;
        }
    }
    foliageContext.putImageData(foliagePixels, 0, 0);

    return { background, clouds, foliage };
}
