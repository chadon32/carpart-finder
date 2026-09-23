import { defineConfig } from '@playwright/test'

const desktop = { viewport: { width: 1365, height: 768 } }
const phone = { viewport: { width: 390, height: 844 } }
const tablet = { viewport: { width: 834, height: 1112 } }

// Firefox does not implement Playwright's `isMobile` emulation. Its phone and
// tablet projects therefore verify the responsive viewport without claiming a
// mobile device mode it cannot provide. Chromium and WebKit additionally get
// their supported touch/mobile emulation.
const browserProjects = [
  { name: 'chromium', use: { browserName: 'chromium' as const } },
  { name: 'firefox', use: { browserName: 'firefox' as const } },
  { name: 'webkit', use: { browserName: 'webkit' as const } },
]

const profiles = [
  { name: 'desktop', use: desktop },
  { name: 'phone', use: phone, mobile: true },
  { name: 'tablet', use: tablet, mobile: true },
]

export default defineConfig({
  testDir: './tests/web',
  outputDir: 'artifacts/benchmarks/e2e/test-results',
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/benchmarks/e2e/report', open: 'never' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: browserProjects.flatMap((browser) => profiles.map((profile) => ({
    name: `${browser.name}-${profile.name}`,
    use: {
      ...browser.use,
      ...profile.use,
      ...(profile.mobile && browser.name !== 'firefox'
        ? { isMobile: true, hasTouch: true }
        : {}),
    },
  }))),
})
