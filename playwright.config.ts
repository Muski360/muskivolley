import { defineConfig } from '@playwright/test';

const origin = 'http://127.0.0.1:5173';

export default defineConfig({
    testDir: './tests',
    use: { baseURL: origin },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --strictPort',
        url: origin,
        reuseExistingServer: true,
    },
});
