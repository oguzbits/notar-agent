import { defineConfig, devices } from '@playwright/test';

// Qualitäts-Gates gegen den Produktionsbuild (Layoutstabilität, Barrierefreiheit).
// Eigene Konfiguration und eigener Port, damit ein laufender Dev-Server nicht stört.
const PORT = 3100;

export default defineConfig({
  testDir: './e2e/quality',
  timeout: 60 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
  },
});
