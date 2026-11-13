import { type Corners, type Rect, type Size, checkIcon, escapeHtml, holeClip, htmlDocument } from './html'
import type { Timeline } from './timeline'

// The one look of every reel: a black stage, a dark browser window and a pill caption under it

export interface StageLayout {
  canvas: Size
  video: Rect
  caption: Rect
  corners: Corners
}

export interface StageContext {
  layout: StageLayout
  timeline: Timeline
}

const BAR = 44
const RADIUS = 14
const SIDE = 96
const TOP = 64
const CAPTION_HEIGHT = 150
const STAGE_BACKGROUND = 'radial-gradient(1200px 700px at 50% -20%, #1C1C1C 0%, rgba(28,28,28,0) 70%), #000'

const even = (n: number) => Math.ceil(n / 2) * 2

export const stageLayout = (video: Size): StageLayout => ({
  canvas: { width: even(video.width + SIDE * 2), height: even(TOP + BAR + video.height + CAPTION_HEIGHT) },
  video: { x: SIDE, y: TOP + BAR, width: video.width, height: video.height },
  caption: { x: 0, y: TOP + BAR + video.height, width: even(video.width + SIDE * 2), height: CAPTION_HEIGHT },
  corners: { tl: 0, tr: 0, br: RADIUS, bl: RADIUS },
})

const windowChrome = (video: Rect, address: string) => `
  <div style="position:absolute;left:${video.x}px;top:${video.y - BAR}px;width:${video.width}px;height:${video.height + BAR}px;border-radius:${RADIUS}px;background:var(--surface);box-shadow:var(--shadow-window)">
    <div style="position:relative;height:${BAR}px;display:flex;align-items:center;gap:8px;padding:0 16px;background:var(--raised);border-bottom:1px solid var(--line);border-radius:${RADIUS}px ${RADIUS}px 0 0">
      <span style="width:12px;height:12px;border-radius:50%;background:#3A3A3A"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#3A3A3A"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#3A3A3A"></span>
      ${address ? `<div style="position:absolute;left:50%;transform:translateX(-50%);padding:5px 18px;border-radius:8px;background:var(--black);border:1px solid var(--line);font-size:13px;font-weight:500;color:var(--muted)">${escapeHtml(address)}</div>` : ''}
    </div>
  </div>`

export const stageFrame = ({ layout: { canvas, video, corners }, timeline }: StageContext) =>
  htmlDocument(
    `<div style="position:absolute;inset:0;background:${STAGE_BACKGROUND};${holeClip(canvas, video, corners)}">${windowChrome(video, timeline.address ?? '')}</div>`,
    '',
    canvas
  )

const progress = (index: number, total: number) =>
  `<div style="display:flex;gap:8px">${Array.from(
    { length: total },
    (_, i) => `<span style="width:30px;height:4px;border-radius:2px;background:${i <= index ? 'var(--white)' : 'var(--track)'}"></span>`
  ).join('')}</div>`

export const stageCaption = ({ layout: { caption }, timeline }: StageContext, index: number) =>
  htmlDocument(
    `<div style="width:${caption.width}px;height:${caption.height}px;display:flex;flex-direction:column;align-items:center;padding-top:22px;gap:18px">
      <div style="display:flex;align-items:center;gap:16px;padding:12px 28px 12px 12px;border-radius:999px;background:var(--raised);box-shadow:var(--shadow-card);font-size:25px;font-weight:600;line-height:1.2;color:var(--white);max-width:${caption.width - 200}px">
        <span style="flex:none;width:38px;height:38px;border-radius:50%;background:var(--white);color:var(--black);display:grid;place-items:center;font-weight:800;font-size:18px">${index + 1}</span>
        <span>${escapeHtml(timeline.steps[index].caption)}</span>
      </div>
      ${progress(index, timeline.steps.length)}
    </div>`,
    '',
    caption
  )

export const introCard = ({ layout: { canvas }, timeline: { title, ticket, summary, steps } }: StageContext) => {
  const pad = Math.round(canvas.width * 0.1)
  return htmlDocument(
    `<div style="width:100%;height:100%;background:${STAGE_BACKGROUND};display:flex;flex-direction:column;justify-content:center;padding:0 ${pad}px;gap:26px">
      ${ticket ? `<div><span class="chip chip-outline">${escapeHtml(ticket)}</span></div>` : ''}
      <h1 style="font-size:${Math.round(canvas.width * 0.042)}px;line-height:1.08;font-weight:800;letter-spacing:-.02em;color:var(--white);max-width:${Math.round(canvas.width * 0.7)}px">${escapeHtml(title)}</h1>
      ${summary ? `<p style="font-size:${Math.round(canvas.width * 0.018)}px;line-height:1.35;color:var(--muted);max-width:${Math.round(canvas.width * 0.62)}px">${escapeHtml(summary)}</p>` : ''}
      <p style="margin-top:8px;font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)">${steps.length} steps</p>
    </div>`,
    '',
    canvas
  )
}

export const outroCard = ({ layout: { canvas }, timeline: { title, ticket } }: StageContext) =>
  htmlDocument(
    `<div style="width:100%;height:100%;background:${STAGE_BACKGROUND};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:0 10%">
      <div style="width:96px;height:96px;border-radius:50%;background:var(--white);display:grid;place-items:center">${checkIcon('#000', 46)}</div>
      <h1 style="font-size:54px;font-weight:800;letter-spacing:-.02em;color:var(--white)">Done</h1>
      <p style="font-size:22px;color:var(--muted)">${escapeHtml(title)}${ticket ? ` · ${escapeHtml(ticket)}` : ''}</p>
    </div>`,
    '',
    canvas
  )
