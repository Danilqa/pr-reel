import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type Locator, type Page, type TestInfo, expect, test as base } from '@playwright/test'
import { type ReelWindow, type SpotlightRect, overlayInitScript } from './overlay'
import { KEEP_NAMES_SHIM } from './render'
import type { FractionRect, ReelMeta, Timeline, TimelineShot, TimelineStep } from './timeline'

const isFast = process.env.REEL_FAST === '1'
const pace = isFast ? 0 : Number(process.env.REEL_PACE ?? 1)

const BEAT_MS = 500
const SETTLE_MS = 900
const SPOTLIGHT_MS = 1600
const TYPING_DELAY_MS = 75
const HIGHLIGHT_PADDING_PX = 6

export const runtimeRoot = path.resolve(import.meta.dirname, '..')

export const slugOf = (info: TestInfo) => path.basename(info.file).replace(/\.reel\.ts$/, '')

export class Reel {
  readonly page: Page
  readonly slug: string
  readonly variant = process.env.REEL_VARIANT ?? 'after'
  readonly isBefore = this.variant === 'before'
  readonly outDir: string
  private readonly startedAt = Date.now()
  private meta: ReelMeta
  private readonly steps: TimelineStep[] = []
  private readonly shots: TimelineShot[] = []
  private readyAt: number | null = null
  private cursor: { x: number; y: number } | null = null

  constructor(page: Page, info: TestInfo) {
    this.page = page
    this.slug = slugOf(info)
    this.meta = { title: this.slug }
    this.outDir = path.join(runtimeRoot, 'out', this.slug, isFast ? `.fast-${this.variant}` : this.variant)
  }

  async prepare() {
    await rm(this.outDir, { recursive: true, force: true })
    await mkdir(path.join(this.outDir, 'shots'), { recursive: true })
    await this.page.addInitScript(KEEP_NAMES_SHIM)
    await this.page.addInitScript(overlayInitScript, process.env.REEL_HIDE ?? '')
    // A failed data request is the usual reason for an error screen; say so right away
    this.page.on('response', (response) => {
      const request = response.request()
      if (response.status() >= 400 && ['fetch', 'xhr'].includes(request.resourceType())) {
        console.warn(`  ⚠ ${response.status()} ${request.method()} ${new URL(response.url()).pathname} — not mocked or not seeded?`)
      }
    })
    this.page.on('pageerror', (error) => console.warn(`  ⚠ page error: ${error.message}`))
  }

  describe(meta: ReelMeta) {
    this.meta = meta
  }

  async pause(ms: number) {
    if (pace > 0 && ms > 0) await this.page.waitForTimeout(ms * pace)
  }

  async step(caption: string, body: () => Promise<void>, options: { hold?: number } = {}) {
    const entry: TimelineStep = {
      index: this.steps.length + 1,
      caption,
      start: this.now(),
      end: this.now(),
    }
    this.steps.push(entry)
    await base.step(`${entry.index}. ${caption}`, async () => {
      await this.pause(BEAT_MS)
      await body()
      entry.shot = await this.capture(`shots/step-${String(entry.index).padStart(2, '0')}.png`)
      await this.pause(options.hold ?? SETTLE_MS)
    })
    entry.end = this.now()
  }

  async ready(locator: Locator) {
    await expect(locator).toBeVisible()
    if (this.readyAt !== null) return
    this.readyAt = this.now()
    if (this.meta.address === undefined) {
      const url = new URL(this.page.url())
      this.meta.address = `${url.host}${url.pathname === '/' ? '' : url.pathname}`
    }
  }

  async click(locator: Locator) {
    await this.approach(locator)
    await locator.click()
  }

  async hover(locator: Locator) {
    await this.approach(locator)
    await locator.hover()
  }

  // Controlled inputs synced to URL state can drop a keystroke; verify and fall back to a fill
  async type(locator: Locator, text: string, options: { delay?: number } = {}) {
    await this.click(locator)
    const initial = await locator.inputValue().catch(() => null)
    const delay = isFast ? 0 : (options.delay ?? TYPING_DELAY_MS) * pace
    await locator.pressSequentially(text, { delay })
    if (initial === null) return
    const typed = await locator.inputValue().catch(() => null)
    if (typed !== null && !typed.includes(text)) {
      console.warn(`  ⚠ typing "${text}" lost characters ("${typed}"); filling the value instead`)
      await locator.fill(initial + text)
    }
  }

  // Dims everything but the element. With `shot`, takes the clean key shot first (scrolled into view);
  // either way the element's rectangle becomes the highlight of the step's latest shot
  async spotlight(locator: Locator, options: { hold?: number; shot?: string } = {}) {
    await this.bringIntoView(locator)
    await this.warnIfCovered(locator, 'spotlight')
    if (options.shot !== undefined) await this.shot(options.shot, { highlight: locator })
    const box = await locator.boundingBox()
    if (box === null) throw new Error('spotlight target has no bounding box')
    this.attachHighlight(this.toFraction(box))
    if (isFast) return
    await this.page.evaluate(
      (rect: SpotlightRect) => (window as ReelWindow).__reel?.spotlight(rect),
      box
    )
    await this.pause(options.hold ?? SPOTLIGHT_MS)
    await this.page.evaluate(() => (window as ReelWindow).__reel?.clearSpotlight())
    await this.pause(400)
  }

  // A key frame for the before/after page; every step also gets an automatic one
  async shot(name: string, options: { highlight?: Locator } = {}) {
    if (options.highlight) await this.bringIntoView(options.highlight)
    const file = await this.capture(
      `shots/${String(this.shots.length + 1).padStart(2, '0')}-${name}.png`
    )
    const box = options.highlight ? await options.highlight.boundingBox() : null
    this.shots.push({
      name,
      file,
      at: this.now(),
      step: this.steps.length,
      highlight: box === null ? undefined : this.toFraction(box),
    })
  }

  // Screenshots are viewport captures, so anything below the fold has to be scrolled up first
  private async bringIntoView(locator: Locator) {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 800 }
    const box = await locator.boundingBox()
    if (box === null || (box.y >= 0 && box.y + box.height <= viewport.height)) return
    await locator.evaluate(
      (element, smooth) => element.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' }),
      !isFast
    )
    await this.page.waitForTimeout(isFast ? 0 : 700)
  }

  // The element can sit inside the viewport yet under a sticky column or an overlay
  private async warnIfCovered(locator: Locator, label: string) {
    const covered = await locator
      .evaluate((element) => {
        const { left, top, width, height } = element.getBoundingClientRect()
        const hit = document.elementFromPoint(left + width / 2, top + height / 2)
        return hit !== null && !element.contains(hit) && !hit.contains(element) && !hit.closest('#pr-reel-overlay')
      })
      .catch(() => false)
    if (covered) {
      console.warn(
        `  ⚠ ${label}: the element is covered by another element at its centre (sticky column? overlay?) — widen the viewport (REEL_WIDTH) or hide a column`
      )
    }
  }

  private toFraction(box: { x: number; y: number; width: number; height: number }): FractionRect {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 800 }
    const pad = HIGHLIGHT_PADDING_PX
    return {
      x: Math.max(0, box.x - pad) / viewport.width,
      y: Math.max(0, box.y - pad) / viewport.height,
      width: Math.min(viewport.width, box.width + pad * 2) / viewport.width,
      height: Math.min(viewport.height, box.height + pad * 2) / viewport.height,
    }
  }

  private attachHighlight(rect: FractionRect) {
    const last = this.shots.at(-1)
    if (last === undefined || last.step !== this.steps.length) return
    if (last.highlight === undefined) last.highlight = rect
    if (last.highlight.y + last.highlight.height > 1 || last.highlight.x + last.highlight.width > 1) {
      console.warn(
        `  ⚠ key shot "${last.name}" was taken with its highlight off screen — use reel.spotlight(el, { shot }) or shot(name, { highlight })`
      )
    }
  }

  private async capture(file: string) {
    await this.setCursorVisible(false)
    await this.page.screenshot({ path: path.join(this.outDir, file), animations: 'disabled' })
    await this.setCursorVisible(true)
    return file
  }

  async finish() {
    const endedAt = this.now()
    const viewport = this.page.viewportSize() ?? { width: 0, height: 0 }
    const video = this.page.video()
    await this.page.close()
    if (video !== null) await video.saveAs(path.join(this.outDir, 'raw.webm'))
    const timeline: Timeline = {
      ...this.meta,
      slug: this.slug,
      variant: this.variant,
      viewport,
      readyAt: this.readyAt,
      endedAt,
      steps: this.steps,
      shots: this.shots,
    }
    await writeFile(path.join(this.outDir, 'timeline.json'), JSON.stringify(timeline, null, 2))
  }

  private now() {
    return Date.now() - this.startedAt
  }

  private async setCursorVisible(visible: boolean) {
    await this.page
      .evaluate((value) => (window as ReelWindow).__reel?.setCursorVisible(value), visible)
      .catch(() => undefined)
  }

  // Ease the pointer towards the element so viewers can follow where the click lands
  private async approach(locator: Locator) {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (box === null || isFast) return
    const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 800 }
    const from = this.cursor ?? { x: viewport.width / 2, y: viewport.height * 0.6 }
    const distance = Math.hypot(target.x - from.x, target.y - from.y)
    const steps = Math.max(8, Math.min(28, Math.round(distance / 30)))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await this.page.mouse.move(
        from.x + (target.x - from.x) * eased,
        from.y + (target.y - from.y) * eased
      )
      await this.page.waitForTimeout(12)
    }
    this.cursor = target
    await this.pause(140)
  }
}
