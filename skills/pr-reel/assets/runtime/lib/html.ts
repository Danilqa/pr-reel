export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export interface Corners {
  tl: number
  tr: number
  br: number
  bl: number
}

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
  )

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap">'

// Inter comes from Google Fonts when online; offline, the system UI font takes over.
export const baseCss = `
:root {
  --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --black: #000000; --surface: #0F0F0F; --raised: #161616; --line: rgba(255, 255, 255, .1);
  --white: #FFFFFF; --muted: #A1A1A1; --faint: #6B6B6B; --track: #2A2A2A; --highlight: #FACC15;
  --shadow-window: 0 40px 80px -30px rgba(0, 0, 0, 1), 0 0 0 1px rgba(255, 255, 255, .1);
  --shadow-card: 0 24px 48px -24px rgba(0, 0, 0, 1), 0 0 0 1px rgba(255, 255, 255, .1);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--sans); color: var(--white); -webkit-font-smoothing: antialiased; }
h1, h2, p { margin: 0; }
.chip {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
  font-size: 15px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
}
.chip-before { background: var(--raised); color: var(--muted); box-shadow: inset 0 0 0 1px var(--line); }
.chip-after { background: var(--white); color: var(--black); }
.chip-outline { color: var(--muted); box-shadow: inset 0 0 0 1.5px var(--line); }
`

export const htmlDocument = (body: string, css: string, size?: Size) => {
  const bodyStyle = size ? ` style="width:${size.width}px;height:${size.height}px;overflow:hidden"` : ''
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>${baseCss}${css}</style></head><body${bodyStyle}>${body}</body></html>`
}

// SVG path of a rounded rect; used to punch the video hole out of a stage frame
export const roundedRectPath = ({ x, y, width, height }: Rect, c: Corners) => {
  const arc = (r: number, toX: number, toY: number) => (r > 0 ? `A${r} ${r} 0 0 1 ${toX} ${toY}` : '')
  return [
    `M${x + c.tl} ${y}`,
    `H${x + width - c.tr}`,
    arc(c.tr, x + width, y + c.tr),
    `V${y + height - c.br}`,
    arc(c.br, x + width - c.br, y + height),
    `H${x + c.bl}`,
    arc(c.bl, x, y + height - c.bl),
    `V${y + c.tl}`,
    arc(c.tl, x + c.tl, y),
    'Z',
  ].join(' ')
}

export const holeClip = (canvas: Size, hole: Rect, corners: Corners) =>
  `clip-path: path(evenodd, 'M0 0H${canvas.width}V${canvas.height}H0Z ${roundedRectPath(hole, corners)}');`

export const checkIcon = (color: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

export const arrowIcon = (color: string, size = 28) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
