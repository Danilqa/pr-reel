import { test as base, expect } from '@playwright/test'
import { Reel } from './reel'

export const test = base.extend<{ reel: Reel }>({
  reel: async ({ page }, use, testInfo) => {
    const reel = new Reel(page, testInfo)
    await reel.prepare()
    await use(reel)
    await reel.finish()
  },
})

export { expect }
export type { Reel }
