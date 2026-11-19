import { defineConfig } from 'vite';

export default defineConfig({
    build: { rolldownOptions: { input: ['index.html', 'treino-2d.html'] } },
});
