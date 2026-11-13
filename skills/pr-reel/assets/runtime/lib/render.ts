import { type Browser, type BrowserContext, type Page, chromium } from '@playwright/test'

// tsx transpiles with esbuild keepNames, which wraps functions in __name(); the browser needs that helper too
export const KEEP_NAMES_SHIM = 'globalThis.__name = (target) => target'

interface RenderOptions {
  width: number
  height?: number
  scale?: number
  transparent?: boolean
  path: string
}

// Renders HTML to PNG with headless Chromium; one browser per compose run, one context per scale factor.
export class Renderer {
  private browser: Browser | null = null
  private readonly pages = new Map<number, Page>()

  async open() {
    this.browser = await chromium.launch()
  }

  async png(html: string, { width, height, scale = 1, transparent = false, path }: RenderOptions) {
    const page = await this.pageFor(scale)
    await page.setViewportSize({ width, height: height ?? 100 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.screenshot({ path, omitBackground: transparent, fullPage: height === undefined })
    return path
  }

  async evaluate<T, A>(fn: (arg: A) => Promise<T> | T, arg: A): Promise<T> {
    const page = await this.pageFor(1)
    await page.setContent('<!doctype html><html><body></body></html>')
    const result: unknown = await page.evaluate(fn as never, arg as never)
    return result as T
  }

  async close() {
    await this.browser?.close()
    this.browser = null
    this.pages.clear()
  }

  private async pageFor(scale: number) {
    const existing = this.pages.get(scale)
    if (existing) return existing
    if (this.browser === null) throw new Error('Renderer is not open')
    const context: BrowserContext = await this.browser.newContext({ deviceScaleFactor: scale })
    await context.addInitScript(KEEP_NAMES_SHIM)
    const page = await context.newPage()
    this.pages.set(scale, page)
    return page
  }
}
