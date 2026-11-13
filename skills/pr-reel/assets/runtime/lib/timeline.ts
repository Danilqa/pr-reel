export interface ReelMeta {
  title: string
  ticket?: string
  summary?: string
  // Shown in the address bar of the window; defaults to the page's host and path at reel.ready()
  address?: string
}

export interface TimelineStep {
  index: number
  caption: string
  start: number
  end: number
  shot?: string
}

// Fractions (0..1) of the viewport, so they survive any display size
export interface FractionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TimelineShot {
  name: string
  file: string
  at: number
  step: number
  highlight?: FractionRect
}

export interface Timeline extends ReelMeta {
  slug: string
  variant: string
  viewport: { width: number; height: number }
  readyAt: number | null
  endedAt: number
  steps: TimelineStep[]
  shots: TimelineShot[]
}
