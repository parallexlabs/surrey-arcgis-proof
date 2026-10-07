import { defineConfig, devices } from '@playwright/test';

const portText = process.env.PROOF_PORT ?? '4287';
const port = Number(portText);
if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('PROOF_PORT must be an integer between 1024 and 65535');
}
const baseURL = `http://127.0.0.1:${port}/demos/surrey-arcgis/`;

// Requires npm run build first; tests exercise the production preview. [9]
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 960 },
    reducedMotion: 'reduce',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 960 },
      launchOptions: {
        args: [
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--enable-webgl',
          '--ignore-gpu-blocklist',
        ],
      },
    },
  }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
