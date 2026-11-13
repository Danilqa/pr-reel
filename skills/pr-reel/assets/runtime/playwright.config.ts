import { defineConfig, devices } from '@playwright/test'

const MINUTE = 60_000
const port = Number(process.env.REEL_PORT ?? 4310)
const baseURL = process.env.REEL_URL ?? `http://localhost:${port}`
const startCommand = process.env.REEL_START ?? ''
const isFast = process.env.REEL_FAST === '1'
const shouldRecord = !isFast && process.env.REEL_VARIANT !== 'before'
const viewport = {
  width: Number(process.env.REEL_WIDTH ?? 1280),
  height: Number(process.env.REEL_HEIGHT ?? 800),
}

if (process.env.REEL_URL === undefined && startCommand === '') {
  throw new Error('REEL_START is empty: set it in config.sh, or point REEL_URL at a running server')
}

export default defineConfig({
  testDir: './scenarios',
  testMatch: /.*\.reel\.ts/,
  outputDir: `./out/.playwright/${process.env.REEL_SLUG ?? 'run'}`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 6 * MINUTE,
  expect: { timeout: 45_000 },
  reporter: [['list']],
  webServer: process.env.REEL_URL
    ? undefined
    : {
        command: startCommand,
        cwd: process.env.REEL_REPO,
        env: { PORT: String(port) },
        url: `${baseURL}${process.env.REEL_READY_PATH ?? '/'}`,
        reuseExistingServer: true,
        timeout: 3 * MINUTE,
      },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport,
    deviceScaleFactor: 2,
    video: shouldRecord ? { mode: 'on', size: viewport } : 'off',
    trace: 'off',
    screenshot: 'off',
  },
})
