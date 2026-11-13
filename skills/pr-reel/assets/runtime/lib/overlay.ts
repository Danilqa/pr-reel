export interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReelWindow extends Window {
  __reel?: {
    spotlight: (rect: SpotlightRect) => void
    clearSpotlight: () => void
    setCursorVisible: (visible: boolean) => void
  }
}

// Runs inside the page on every navigation: a visible cursor that follows the
// mouse, a ripple on every click, and a spotlight that dims everything but one rect.
// `hidden` is a CSS selector list of dev-only widgets to keep out of the recording.
export function overlayInitScript(hidden: string) {
  const Z = '2147483000'
  const CURSOR_SVG =
    '<svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 1.5 L2 24 L8.2 18.4 L12.4 28 L16.6 26.2 L12.5 16.8 L20.5 16.5 Z" fill="#000" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>' +
    '</svg>'

  // Devtools toggles of common libraries are noise in a demo
  const DEV_UI = ['.tsqd-open-btn-container', 'aside.ReactQueryDevtools', '[aria-label="Open React Query Devtools"]', 'nextjs-portal', hidden]
    .filter(Boolean)
    .join(', ')
  const hideDevUi = () => {
    if (document.getElementById('pr-reel-hide-dev-ui')) return
    const style = document.createElement('style')
    style.id = 'pr-reel-hide-dev-ui'
    style.textContent = `${DEV_UI} { display: none !important; }`
    ;(document.head ?? document.documentElement).appendChild(style)
  }
  if (document.documentElement) hideDevUi()
  addEventListener('DOMContentLoaded', hideDevUi)

  const ensureRoot = () => {
    hideDevUi()
    let root = document.getElementById('pr-reel-overlay')
    if (root) return root
    root = document.createElement('div')
    root.id = 'pr-reel-overlay'
    root.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${Z};`
    const cursor = document.createElement('div')
    cursor.id = 'pr-reel-cursor'
    cursor.innerHTML = CURSOR_SVG
    cursor.style.cssText =
      'position:fixed;left:0;top:0;width:24px;height:30px;transform:translate3d(-100px,-100px,0);' +
      'transition:transform 45ms linear;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));will-change:transform;'
    root.appendChild(cursor)
    const attach = () => document.documentElement.appendChild(root as HTMLElement)
    if (document.documentElement) attach()
    else addEventListener('DOMContentLoaded', attach)
    return root
  }

  let cursorVisible = true
  let lastPoint = { x: -100, y: -100 }
  const placeCursor = () => {
    const cursor = document.getElementById('pr-reel-cursor')
    if (!cursor) return
    cursor.style.opacity = cursorVisible ? '1' : '0'
    cursor.style.transform = `translate3d(${lastPoint.x - 2}px, ${lastPoint.y - 1}px, 0)`
  }

  addEventListener(
    'mousemove',
    (event) => {
      ensureRoot()
      lastPoint = { x: event.clientX, y: event.clientY }
      placeCursor()
    },
    true
  )

  addEventListener(
    'pointerdown',
    (event) => {
      const root = ensureRoot()
      const ring = document.createElement('div')
      ring.style.cssText =
        `position:fixed;left:${event.clientX}px;top:${event.clientY}px;width:18px;height:18px;margin:-9px 0 0 -9px;` +
        'border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.6) inset,0 0 0 1.5px rgba(0,0,0,.6);'
      const dot = document.createElement('div')
      dot.style.cssText =
        `position:fixed;left:${event.clientX}px;top:${event.clientY}px;width:12px;height:12px;margin:-6px 0 0 -6px;` +
        'border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.75);'
      root.append(ring, dot)
      const options: KeyframeAnimationOptions = { duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)' }
      ring.animate(
        [
          { transform: 'scale(.6)', opacity: 1 },
          { transform: 'scale(3.2)', opacity: 0 },
        ],
        options
      )
      dot.animate(
        [
          { transform: 'scale(.4)', opacity: 1, offset: 0 },
          { transform: 'scale(1)', opacity: 1, offset: 0.35 },
          { transform: 'scale(1)', opacity: 0, offset: 1 },
        ],
        options
      ).onfinish = () => {
        ring.remove()
        dot.remove()
      }
    },
    true
  )

  const api: NonNullable<ReelWindow['__reel']> = {
    spotlight: (rect) => {
      const root = ensureRoot()
      let hole = document.getElementById('pr-reel-spotlight')
      if (!hole) {
        hole = document.createElement('div')
        hole.id = 'pr-reel-spotlight'
        hole.style.cssText =
          'position:fixed;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.55);' +
          'outline:3px solid #fff;outline-offset:2px;opacity:0;transition:opacity .35s ease, left .35s ease, top .35s ease, width .35s ease, height .35s ease;'
        root.appendChild(hole)
      }
      const pad = 8
      hole.style.left = `${rect.x - pad}px`
      hole.style.top = `${rect.y - pad}px`
      hole.style.width = `${rect.width + pad * 2}px`
      hole.style.height = `${rect.height + pad * 2}px`
      requestAnimationFrame(() => {
        if (hole) hole.style.opacity = '1'
      })
    },
    clearSpotlight: () => {
      const hole = document.getElementById('pr-reel-spotlight')
      if (!hole) return
      hole.style.opacity = '0'
      setTimeout(() => hole.remove(), 400)
    },
    setCursorVisible: (visible) => {
      cursorVisible = visible
      placeCursor()
    },
  }
  ;(window as ReelWindow).__reel = api
}
