import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e', // Directorio donde estarán tus pruebas E2E
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    // Configuración específica para Chromium (Chrome)
    browserName: 'chromium',
    launchOptions: {
      headless: false, // Para ver el navegador durante la ejecución
      args: [
        `--disable-extensions-except=${path.resolve(__dirname, 'extension')}`,
        `--load-extension=${path.resolve(__dirname, 'extension')}`,
      ],
    },
  },
});
