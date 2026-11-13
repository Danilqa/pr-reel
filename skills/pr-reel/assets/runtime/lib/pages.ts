import { arrowIcon, escapeHtml, htmlDocument } from './html'
import type { FractionRect, Timeline } from './timeline'

export interface Frame {
  src: string
  width: number
  height: number
}

export interface PageInput {
  timeline: Timeline
  before: Frame | null
  after: Frame
  note: string
  highlight: FractionRect | null
  beforeHighlight: FractionRect | null
  storyboard: { frame: Frame; caption: string }[]
}

export interface PageLayout {
  id: string
  label: string
  width: number
  needsBefore: boolean
  render: (input: PageInput) => string
}

const css = `
body { background: var(--black); padding: 56px 64px 64px; }
.header { display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px; }
.header-row { display: flex; align-items: center; gap: 18px; }
.title { font-size: 30px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; }
.subtitle { font-size: 20px; line-height: 1.35; color: var(--muted); max-width: 1100px; }
.label { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.card { position: relative; border-radius: 14px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-card); }
.card img { display: block; width: 100%; height: auto; }
.hl { position: absolute; border: 3px solid var(--highlight); border-radius: 8px; box-shadow: 0 0 0 2px var(--black), inset 0 0 0 2px var(--black), 0 0 0 9999px rgba(0,0,0,.12); }
.hl-ghost { position: absolute; border: 3px dashed var(--muted); border-radius: 8px; box-shadow: 0 0 0 1px rgba(0,0,0,.5); }
.note { margin-top: 18px; display: flex; gap: 12px; align-items: flex-start; font-size: 19px; line-height: 1.35; color: var(--muted); }
.note::before { content: ''; flex: none; width: 4px; align-self: stretch; border-radius: 2px; background: var(--white); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
.thumbs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 28px; }
.thumbs .card { border-radius: 10px; }
.arrow-row { display: flex; justify-content: center; padding: 26px 0; }
.arrow-row span { width: 56px; height: 56px; border-radius: 50%; background: var(--white); display: grid; place-items: center; transform: rotate(90deg); }
.bubble { position: absolute; transform: translateX(-50%); background: var(--white); color: var(--black); padding: 12px 18px; border-radius: 12px; font-size: 18px; font-weight: 600; white-space: nowrap; box-shadow: 0 0 0 1px rgba(0,0,0,.25), 0 12px 30px -12px rgba(0,0,0,.6); }
.bubble::before { content: ''; position: absolute; left: 50%; top: -7px; width: 14px; height: 14px; background: var(--white); transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
.story { display: grid; gap: 36px; }
.story .cap { margin-top: 14px; display: flex; gap: 12px; align-items: flex-start; font-size: 18px; line-height: 1.35; color: var(--muted); }
.story .num { flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--white); display: grid; place-items: center; font-weight: 800; font-size: 14px; color: var(--black); }
`

const pct = (n: number) => `${(n * 100).toFixed(3)}%`

const header = ({ timeline }: PageInput) =>
  `<div class="header"><div class="header-row">${
    timeline.ticket ? `<span class="chip chip-outline">${escapeHtml(timeline.ticket)}</span>` : ''
  }<h1 class="title">${escapeHtml(timeline.title)}</h1></div>${
    timeline.summary ? `<p class="subtitle">${escapeHtml(timeline.summary)}</p>` : ''
  }</div>`

const highlightBox = (rect: FractionRect | null, className = 'hl') =>
  rect
    ? `<div class="${className}" style="left:${pct(rect.x)};top:${pct(rect.y)};width:${pct(rect.width)};height:${pct(rect.height)}"></div>`
    : ''

const frameCard = (frame: Frame, highlight: FractionRect | null, extra = '', className = 'hl') =>
  `<div class="card"><img src="${frame.src}" width="${frame.width}" height="${frame.height}">${highlightBox(highlight, className)}${extra}</div>`

const labelled = (label: string, chip: string, body: string, note = '') =>
  `<div><div class="label"><span class="chip ${chip}">${label}</span></div>${body}${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}</div>`

const page = (input: PageInput, body: string) => htmlDocument(header(input) + body, css)

const beforeOrFail = (input: PageInput) => {
  if (input.before === null) throw new Error('this layout needs a before screenshot')
  return input.before
}

const beforeBox = (input: PageInput) => input.beforeHighlight ?? input.highlight
const beforeBoxClass = (input: PageInput) => (input.beforeHighlight ? 'hl' : 'hl-ghost')

// Crop window around the highlight, as fractions of the screenshot
const cropAround = (highlight: FractionRect, aspect: number, imageAspect: number): FractionRect => {
  let width = Math.min(1, Math.max(highlight.width * 1.6, 0.4))
  let height = (width * imageAspect) / aspect
  if (height < highlight.height * 2.4) {
    height = Math.min(1, highlight.height * 2.4)
    width = Math.min(1, (height * aspect) / imageAspect)
  }
  const x = Math.min(Math.max(highlight.x + highlight.width / 2 - width / 2, 0), 1 - width)
  const y = Math.min(Math.max(highlight.y + highlight.height / 2 - height / 2, 0), 1 - height)
  return { x, y, width, height }
}

const cropped = (frame: Frame, crop: FractionRect, highlight: FractionRect, displayWidth: number, className = 'hl') => {
  const imageWidth = displayWidth / crop.width
  const imageHeight = (imageWidth * frame.height) / frame.width
  const displayHeight = imageHeight * crop.height
  const inner: FractionRect = {
    x: (highlight.x - crop.x) / crop.width,
    y: (highlight.y - crop.y) / crop.height,
    width: highlight.width / crop.width,
    height: highlight.height / crop.height,
  }
  return `<div class="card" style="width:${displayWidth}px;height:${displayHeight}px">
    <img src="${frame.src}" style="position:absolute;width:${imageWidth}px;height:${imageHeight}px;left:${-crop.x * imageWidth}px;top:${-crop.y * imageHeight}px;max-width:none">
    ${highlightBox(inner, className)}
  </div>`
}

const sideBySide: PageLayout = {
  id: 'side-by-side',
  label: 'Before and after next to each other',
  width: 1600,
  needsBefore: true,
  render: (input) =>
    page(
      input,
      `<div class="grid-2">
        ${labelled('Before', 'chip-before', frameCard(beforeOrFail(input), beforeBox(input), '', beforeBoxClass(input)))}
        ${labelled('After', 'chip-after', frameCard(input.after, input.highlight), input.note)}
      </div>`
    ),
}

const stacked: PageLayout = {
  id: 'stacked',
  label: 'Before above after with an arrow',
  width: 1120,
  needsBefore: true,
  render: (input) =>
    page(
      input,
      `${labelled('Before', 'chip-before', frameCard(beforeOrFail(input), beforeBox(input), '', beforeBoxClass(input)))}
      <div class="arrow-row"><span>${arrowIcon('#000', 30)}</span></div>
      ${labelled('After', 'chip-after', frameCard(input.after, input.highlight), input.note)}`
    ),
}

const focus: PageLayout = {
  id: 'focus',
  label: 'Zoomed on the changed area, full frames below',
  width: 1600,
  needsBefore: true,
  render: (input) => {
    const before = beforeOrFail(input)
    if (input.highlight === null) return sideBySide.render(input)
    const columnWidth = (1600 - 128 - 40) / 2
    const crop = cropAround(input.highlight, 16 / 10, input.after.width / input.after.height)
    return page(
      input,
      `<div class="grid-2">
        ${labelled('Before', 'chip-before', cropped(before, crop, beforeBox(input) ?? input.highlight, columnWidth, beforeBoxClass(input)))}
        ${labelled('After', 'chip-after', cropped(input.after, crop, input.highlight, columnWidth), input.note)}
      </div>
      <div class="thumbs">
        ${frameCard(before, null, highlightBox(crop, 'hl-ghost'))}
        ${frameCard(input.after, null, highlightBox(crop, 'hl-ghost'))}
      </div>`
    )
  },
}

const inset: PageLayout = {
  id: 'inset',
  label: 'Large after, small before in the corner',
  width: 1400,
  needsBefore: true,
  render: (input) => {
    const before = beforeOrFail(input)
    const insetHtml = `<div style="position:absolute;left:28px;bottom:28px;width:380px;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px -20px rgba(0,0,0,.9), 0 0 0 5px var(--black), 0 0 0 6px var(--line)">
        <img src="${before.src}" style="display:block;width:100%">
        ${highlightBox(beforeBox(input), 'hl-ghost')}
        <span class="chip chip-before" style="position:absolute;left:12px;top:12px;font-size:12px;padding:4px 10px">Before</span>
      </div>`
    return page(input, labelled('After', 'chip-after', frameCard(input.after, input.highlight, insetHtml), input.note))
  },
}

const callout: PageLayout = {
  id: 'callout',
  label: 'Side by side with a note pinned to the change',
  width: 1600,
  needsBefore: true,
  render: (input) => {
    const highlight = input.highlight
    const anchorX = highlight ? highlight.x + highlight.width / 2 : 0.5
    const anchorY = highlight ? highlight.y + highlight.height : 0.9
    const bubble = `<div class="bubble" style="left:${pct(anchorX)};top:calc(${pct(anchorY)} + 18px)">${escapeHtml(input.note)}</div>`
    return page(
      input,
      `<div class="grid-2">
        ${labelled('Before', 'chip-before', frameCard(beforeOrFail(input), beforeBox(input), '', beforeBoxClass(input)))}
        ${labelled('After', 'chip-after', frameCard(input.after, input.highlight, bubble))}
      </div>`
    )
  },
}

const storyboard: PageLayout = {
  id: 'storyboard',
  label: 'Key frames of the flow in order',
  width: 1600,
  needsBefore: false,
  render: (input) => {
    const frames = input.storyboard
    const columns = Math.min(frames.length, frames.length <= 4 ? frames.length : 3)
    return page(
      input,
      `<div class="story" style="grid-template-columns:repeat(${columns}, 1fr)">
        ${frames
          .map(
            ({ frame, caption }, i) =>
              `<div>${frameCard(frame, null)}<p class="cap"><span class="num">${i + 1}</span><span>${escapeHtml(caption)}</span></p></div>`
          )
          .join('')}
      </div>`
    )
  },
}

export const pageLayouts: PageLayout[] = [sideBySide, focus, callout, stacked, inset, storyboard]

export const findLayout = (id: string) => {
  const layout = pageLayouts.find((candidate) => candidate.id === id)
  if (layout === undefined) {
    throw new Error(`unknown page layout "${id}"; available: ${pageLayouts.map((candidate) => candidate.id).join(', ')}`)
  }
  return layout
}
