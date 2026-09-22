import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

type A11yFailure = { label: string; violationIds: string[] }

export function createWcagAaCollector(testInfo: TestInfo) {
  const failures: A11yFailure[] = []

  return {
    async check(page: Page, label: string) {
      await page.waitForFunction(() => document.getAnimations().every((animation) => {
        const iterations = animation.effect?.getTiming().iterations
        return iterations === Infinity || animation.playState !== 'running'
      }))
      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
      if (results.violations.length) {
        const evidence = testInfo.outputPath(`${label}-axe-violations.json`)
        await writeFile(evidence, JSON.stringify(results.violations, null, 2))
        await testInfo.attach(`${label} axe violations`, { path: evidence, contentType: 'application/json' })
        failures.push({ label, violationIds: results.violations.map((violation) => violation.id) })
      }
    },
    assertClean() {
      expect(failures, 'WCAG 2.0/2.1 AA violations; inspect the attached JSON evidence for every affected scene').toEqual([])
    },
  }
}
