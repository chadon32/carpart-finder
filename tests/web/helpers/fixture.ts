import { expect, test as base, type Page, type TestInfo } from '@playwright/test'
import path from 'node:path'
import { startFixtureServer } from '../../../scripts/benchmark-web-lib.mjs'

type FixtureServer = {
  url: string
  unexpectedRequests: string[]
  close: () => Promise<void>
}

export type RuntimeError = { source: 'console' | 'pageerror'; message: string }

type TestFixtures = {
  app: { baseUrl: string; runtimeErrors: RuntimeError[] }
}

type WorkerFixtures = {
  fixtureServer: FixtureServer
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  fixtureServer: [async (
    // eslint-disable-next-line no-empty-pattern -- This worker fixture has no dependencies.
    {},
    provide: (server: FixtureServer) => Promise<void>,
  ) => {
    const server = await startFixtureServer(path.resolve(process.cwd(), 'dist')) as FixtureServer
    try {
      await provide(server)
    } finally {
      await server.close()
    }
  }, { scope: 'worker' }],

  app: async ({ page, fixtureServer }, provide) => {
    const runtimeErrors: RuntimeError[] = []
    await blockOffOriginRequests(page, fixtureServer.url)
    page.on('pageerror', (error) => runtimeErrors.push({ source: 'pageerror', message: error.message }))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const location = message.location().url
        if (!location || location.startsWith(fixtureServer.url)) {
          runtimeErrors.push({ source: 'console', message: message.text() })
        }
      }
    })
    await provide({ baseUrl: fixtureServer.url, runtimeErrors })
  },
})

async function blockOffOriginRequests(page: Page, baseUrl: string) {
  const origin = new URL(baseUrl).origin
  await page.context().route('**/*', async (route) => {
    const url = route.request().url()
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) {
      await route.continue()
      return
    }
    if (new URL(url).origin !== origin) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
}

export function assertNoUnexpectedRuntimeErrors(
  app: { runtimeErrors: RuntimeError[] },
  fixtureServer: FixtureServer,
  testInfo: TestInfo,
  intentionalRuntimeErrors: RegExp[] = [],
) {
  const unexpected = app.runtimeErrors.filter((error) => !intentionalRuntimeErrors.some((pattern) => pattern.test(error.message)))
  expect(unexpected, `Unexpected runtime errors in ${testInfo.title}`).toEqual([])
  expect(fixtureServer.unexpectedRequests, `Unsupported local fixture requests in ${testInfo.title}`).toEqual([])
  fixtureServer.unexpectedRequests.splice(0)
}
