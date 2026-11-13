// Builds the PR artefacts from a recording: the mp4(s) and the before/after page PNG(s).
// usage: run.sh compose <slug> [--speed 1,1.15] [--page auto|all|none|a,b] [--shot name] [--note "text"]
//        [--no-intro] [--outro] [--no-video]
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { type Frame, type PageLayout, findLayout, pageLayouts } from './pages'
import { Renderer } from './render'
import { introCard, outroCard, stageCaption, stageFrame, stageLayout } from './style'
import type { FractionRect, Timeline } from './timeline'

const run = promisify(execFile)
const runtimeRoot = path.resolve(import.meta.dirname, '..')

const INTRO_SECONDS = 1.6
const OUTRO_SECONDS = 1.6
const LEAD_SECONDS = 0.3
const FADE_SECONDS = 0.22
const FPS = 30

const { positionals, values: options } = parseArgs({
  allowPositionals: true,
  options: {
    speed: { type: 'string', default: '1' },
    page: { type: 'string', default: 'auto' },
    shot: { type: 'string' },
    note: { type: 'string' },
    'no-intro': { type: 'boolean', default: false },
    outro: { type: 'boolean', default: false },
    'no-video': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

const slug = positionals[0]
if (options.help || slug === undefined) {
  console.log(
    [
      'usage: run.sh compose <slug> [options]',
      '  --speed   playback speed factors, e.g. 1,1.15              (default 1)',
      `  --page    ${pageLayouts.map((l) => l.id).join(', ')}, all, none or auto (default auto)`,
      '  --shot    key screenshot name for the page                 (default: last reel.shot)',
      '  --note    one line shown under "After" / in the callout     (default: caption of that step)',
      '  --no-intro --outro --no-video',
    ].join('\n')
  )
  process.exit(slug === undefined ? 1 : 0)
}

const list = (value: string, all: string[]) =>
  value === 'all' ? all : value.split(',').map((item) => item.trim()).filter(Boolean)

const seconds = (n: number) => n.toFixed(3)
const dataUri = async (file: string): Promise<Frame> => {
  const buffer = await readFile(file)
  return {
    src: `data:image/png;base64,${buffer.toString('base64')}`,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const loadTimeline = async (variant: string): Promise<Timeline | null> => {
  const file = path.join(runtimeRoot, 'out', slug, variant, 'timeline.json')
  if (!existsSync(file)) return null
  return JSON.parse(await readFile(file, 'utf8')) as Timeline
}

const composeVideo = async (renderer: Renderer, timeline: Timeline, speed: number) => {
  const layout = stageLayout(timeline.viewport)
  const ctx = { layout, timeline }
  const variantDir = path.join(runtimeRoot, 'out', slug, timeline.variant)
  const buildDir = path.join(runtimeRoot, 'out', slug, 'build')
  await mkdir(buildDir, { recursive: true })

  const framePng = await renderer.png(stageFrame(ctx), { ...layout.canvas, transparent: true, path: path.join(buildDir, 'frame.png') })
  const captionPngs: string[] = []
  for (const [index] of timeline.steps.entries()) {
    captionPngs.push(
      await renderer.png(stageCaption(ctx, index), {
        width: layout.caption.width,
        height: layout.caption.height,
        transparent: true,
        path: path.join(buildDir, `caption-${String(index + 1).padStart(2, '0')}.png`),
      })
    )
  }
  const withIntro = !options['no-intro']
  const withOutro = options.outro
  const introPng = withIntro ? await renderer.png(introCard(ctx), { ...layout.canvas, path: path.join(buildDir, 'intro.png') }) : null
  const outroPng = withOutro ? await renderer.png(outroCard(ctx), { ...layout.canvas, path: path.join(buildDir, 'outro.png') }) : null

  const firstStart = timeline.steps[0]?.start ?? 0
  const trimStart = Math.max(0, (timeline.readyAt ?? firstStart) / 1000 - LEAD_SECONDS)
  const trimEnd = timeline.endedAt / 1000
  const playDuration = (trimEnd - trimStart) / speed
  const intro = withIntro ? INTRO_SECONDS : 0
  const outro = withOutro ? OUTRO_SECONDS : 0
  const total = intro + playDuration + outro
  const starts = timeline.steps.map((step) => intro + Math.max(0, step.start / 1000 - trimStart) / speed)
  const ends = starts.map((_, i) => (i + 1 < starts.length ? starts[i + 1] : intro + playDuration))

  const inputs: string[] = ['-i', path.join(variantDir, 'raw.webm')]
  let inputCount = 1
  const image = (file: string, duration: number) => {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', seconds(duration), '-i', file)
    return inputCount++
  }
  const frameInput = image(framePng, total)
  const captionInputs = captionPngs.map((file, i) => image(file, Math.max(ends[i] - starts[i], FADE_SECONDS * 2) + 0.05))
  const introInput = introPng ? image(introPng, intro) : null
  const outroInput = outroPng ? image(outroPng, outro) : null

  const { canvas, video, caption } = layout
  const filters: string[] = [
    `color=c=black:s=${canvas.width}x${canvas.height}:r=${FPS}:d=${seconds(total)}[base]`,
    `[0:v]trim=start=${seconds(trimStart)}:end=${seconds(trimEnd)},setpts=(PTS-STARTPTS)/${speed},fps=${FPS},scale=${video.width}:${video.height}:flags=lanczos,tpad=start_duration=${seconds(intro)}:start_mode=clone:stop_duration=${seconds(outro)}:stop_mode=clone,format=rgba[vid]`,
    `[base][vid]overlay=x=${video.x}:y=${video.y}:eof_action=pass[s0]`,
    `[${frameInput}:v]format=rgba[frame]`,
    `[s0][frame]overlay=0:0:eof_action=pass[s1]`,
  ]
  let stage = 1
  const next = () => `s${++stage}`
  captionInputs.forEach((input, i) => {
    const duration = Math.max(ends[i] - starts[i], FADE_SECONDS * 2)
    const label = `c${i}`
    filters.push(
      `[${input}:v]format=rgba,fade=t=in:st=0:d=${FADE_SECONDS}:alpha=1,fade=t=out:st=${seconds(duration - FADE_SECONDS)}:d=${FADE_SECONDS}:alpha=1,setpts=PTS+${seconds(starts[i])}/TB[${label}]`
    )
    const previous = `s${stage}`
    filters.push(`[${previous}][${label}]overlay=x=${caption.x}:y=${caption.y}:eof_action=pass:enable='between(t,${seconds(starts[i])},${seconds(ends[i])})'[${next()}]`)
  })
  if (introInput !== null) {
    filters.push(`[${introInput}:v]format=rgba,fade=t=out:st=${seconds(intro - 0.45)}:d=0.45:alpha=1[intro]`)
    const previous = `s${stage}`
    filters.push(`[${previous}][intro]overlay=0:0:eof_action=pass:enable='between(t,0,${seconds(intro)})'[${next()}]`)
  }
  if (outroInput !== null) {
    const outroStart = intro + playDuration
    filters.push(`[${outroInput}:v]format=rgba,fade=t=in:st=0:d=0.45:alpha=1,setpts=PTS+${seconds(outroStart)}/TB[outro]`)
    const previous = `s${stage}`
    filters.push(`[${previous}][outro]overlay=0:0:eof_action=pass:enable='between(t,${seconds(outroStart)},${seconds(total)})'[${next()}]`)
  }
  filters.push(`[s${stage}]format=yuv420p[out]`)

  const suffix = speed === 1 ? '' : `.x${speed}`
  const output = path.join(runtimeRoot, 'out', slug, `${slug}${suffix}.mp4`)
  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', String(FPS),
    '-t', seconds(total), '-movflags', '+faststart',
    output,
  ], { maxBuffer: 1024 * 1024 * 16 })
  const size = (await stat(output)).size
  console.log(`video  ${path.relative(runtimeRoot, output)}  ${total.toFixed(1)}s  ${(size / 1024 / 1024).toFixed(1)}MB`)
}

// Bounding box of the pixels that differ between two screenshots, as fractions; null when they differ everywhere
const detectHighlight = (renderer: Renderer, before: Frame, after: Frame): Promise<FractionRect | null> =>
  renderer.evaluate(async ([a, b]) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = src
      })
    const [imgA, imgB] = await Promise.all([load(a), load(b)])
    const step = 3
    const width = Math.floor(Math.min(imgA.width, imgB.width) / step)
    const height = Math.floor(Math.min(imgA.height, imgB.height) / step)
    const pixels = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('no 2d context')
      context.drawImage(img, 0, 0, width, height)
      return context.getImageData(0, 0, width, height).data
    }
    const da = pixels(imgA)
    const db = pixels(imgB)
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const distance = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
        if (distance > 60) {
          count++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0 || count / (width * height) > 0.3) return null
    const pad = 0.012
    const box = {
      x: minX / width - pad,
      y: minY / height - pad * (width / height),
      width: (maxX - minX + 1) / width + pad * 2,
      height: (maxY - minY + 1) / height + pad * 2 * (width / height),
    }
    if (box.width * box.height > 0.5) return null
    return {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(1 - Math.max(0, box.x), box.width),
      height: Math.min(1 - Math.max(0, box.y), box.height),
    }
  }, [before.src, after.src] as const)

const composePages = async (renderer: Renderer, after: Timeline, before: Timeline | null) => {
  const shotName = options.shot ?? after.shots.at(-1)?.name
  const afterShot = after.shots.find((shot) => shot.name === shotName)
  const afterFile = afterShot?.file ?? after.steps.at(-1)?.shot
  if (afterFile === undefined) throw new Error('no screenshots in the after recording')
  const beforeShot = before?.shots.find((shot) => shot.name === shotName)
  const beforeFile = beforeShot?.file ?? before?.steps.at(-1)?.shot
  const afterFrame = await dataUri(path.join(runtimeRoot, 'out', slug, after.variant, afterFile))
  const beforeFrame = before && beforeFile ? await dataUri(path.join(runtimeRoot, 'out', slug, before.variant, beforeFile)) : null
  const highlight = afterShot?.highlight ?? (beforeFrame ? await detectHighlight(renderer, beforeFrame, afterFrame) : null)
  const beforeHighlight = beforeShot?.highlight ?? null
  const stepIndex = afterShot?.step ?? after.steps.length
  const note = options.note ?? after.steps[stepIndex - 1]?.caption ?? after.title
  const storyboard: { frame: Frame; caption: string }[] = []
  for (const step of after.steps) {
    if (step.shot) storyboard.push({ frame: await dataUri(path.join(runtimeRoot, 'out', slug, after.variant, step.shot)), caption: step.caption })
  }

  const requested = options.page === 'auto'
    ? beforeFrame ? ['side-by-side', 'focus', 'callout'] : ['storyboard']
    : options.page === 'all'
      ? pageLayouts.filter((layout) => beforeFrame || !layout.needsBefore).map((layout) => layout.id)
      : list(options.page, [])
  const layouts: PageLayout[] = requested.map(findLayout)

  if (highlight) console.log(`highlight  x ${(highlight.x * 100).toFixed(1)}%  y ${(highlight.y * 100).toFixed(1)}%  w ${(highlight.width * 100).toFixed(1)}%  h ${(highlight.height * 100).toFixed(1)}%`)
  if (highlight && (highlight.y + highlight.height > 1 || highlight.x + highlight.width > 1)) {
    console.log('warning: the highlight lies outside the viewport — the changed UI was below the fold when the key shot was taken')
  }
  for (const layout of layouts) {
    if (layout.needsBefore && beforeFrame === null) {
      console.log(`skip   ${layout.id} (no before recording)`)
      continue
    }
    const html = layout.render({ timeline: after, before: beforeFrame, after: afterFrame, note, highlight, beforeHighlight, storyboard })
    const output = path.join(runtimeRoot, 'out', slug, `${slug}.page.${layout.id}.png`)
    await renderer.png(html, { width: layout.width, scale: 2, path: output })
    const size = (await stat(output)).size
    console.log(`page   ${path.relative(runtimeRoot, output)}  ${(size / 1024 / 1024).toFixed(1)}MB`)
  }
}

const main = async () => {
  const after = await loadTimeline('after')
  if (after === null) throw new Error(`no recording found at out/${slug}/after — run "run.sh record ${slug}" first`)
  const before = await loadTimeline('before')
  const renderer = new Renderer()
  await renderer.open()
  try {
    if (!options['no-video']) {
      const speeds = list(options.speed, []).map(Number)
      for (const speed of speeds) await composeVideo(renderer, after, speed)
    }
    if (options.page !== 'none') await composePages(renderer, after, before)
  } finally {
    await renderer.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
