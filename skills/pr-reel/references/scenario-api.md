# Scenario API

A scenario is a Playwright test in `<repo>--pr-reel/scenarios/<slug>.reel.ts` that imports `test` and `expect` from `../lib`. It gets the usual Playwright fixtures (`page`, `context`, `request`) plus `reel`.

```ts
import { expect, test } from '../lib'

test('webhook icon after the schedule', async ({ page, reel }) => {
  reel.describe({
    title: 'Show a webhook icon after the schedule',
    ticket: '#41',
    summary: 'Routines that also run on webhooks stand out in the routines table.',
  })

  const row = page.getByRole('row', { name: /on-call-engineer/ })

  await reel.step('Open the routines', async () => {
    await page.goto('/')
    await reel.ready(page.getByRole('heading', { name: 'Routines' }))
  })

  await reel.step('Its schedule now ends with a webhook icon', async () => {
    if (!reel.isBefore) await expect(row.getByRole('img', { name: 'Also runs on webhook' })).toBeVisible()
    await reel.spotlight(row.getByRole('cell').nth(2), { shot: 'schedule' })
  }, { hold: 1400 })
})
```

## `reel`

| Member | Purpose |
|---|---|
| `describe({ title, ticket?, summary?, address? })` | Text for the intro card and the page header; `address` replaces the host shown in the window's address bar. Call it first. |
| `step(caption, body, { hold? })` | One captioned step. Waits 0.5 s before `body`, takes a clean screenshot after it, then settles 0.9 s (or `hold` ms). Captions are the video subtitles and the storyboard labels. |
| `ready(locator)` | Marks the first meaningful paint; the video is trimmed to start just before it. Call once, right after the first `page.goto`. |
| `click(locator)` | Eases the visible cursor to the element, then clicks (with a ripple). |
| `hover(locator)` | Same movement, no click. |
| `type(locator, text, { delay? })` | Clicks, then types character by character (75 ms each). |
| `spotlight(locator, { shot?, hold? })` | Scrolls the element into view, with `shot` takes the clean key shot, then dims the page except the element for 1.6 s. The element's rectangle becomes the highlight of the step's latest shot; each variant records its own, so a `reel.isBefore` locator here also places the before panel's box. The usual way to mark the payoff. |
| `shot(name, { highlight? })` | Key frame for the before/after page (`out/<slug>/<variant>/shots/NN-<name>.png`) when there is nothing to spotlight. Captures the viewport as it is; pass `highlight` to scroll to an element first. The page uses the last key shot unless `--shot` says otherwise. |
| `pause(ms)` | Explicit wait, scaled by `REEL_PACE`, skipped in fast mode. |
| `isBefore`, `variant` | `true` / `'before'` while recording against the merge base. Guard assertions on new behaviour with it. |
| `page`, `slug`, `outDir` | Escape hatches. |

The recorder prints every fetch or XHR response with status 400 or above and every uncaught page error while the scenario runs; when the app shows an error screen, that log names the request the scenario still has to mock or seed.

Use plain Playwright for things the viewer does not see (assertions, `page.route`, `page.clock`, `page.waitForResponse`). Use `reel.click` / `reel.type` for anything the viewer should follow.

Screenshots are viewport captures (1280×800 by default). `spotlight` and `shot(name, { highlight })` scroll their target into view first; a bare `shot` captures whatever is on screen. The recorder warns when a key shot's highlight ended up off screen, in fast mode too. When the new UI appears only after a request, create the wait before the click: `const loaded = page.waitForResponse('**/api/invoices*', { timeout: 8_000 }).catch(() => undefined); await reel.click(cta); await loaded`.

## Data

The scenario decides what the app shows, and the same scenario runs against both versions, so both get the same data.

- **Mocks:** `page.route('**/api/…', (route) => route.fulfill({ json }))`. Static mocks ignore query parameters, so filter inside the handler when the flow depends on a search. When the payoff depends on a mutation the app follows with a refetch, keep the data in a `Map` that both the GET and the mutation handlers read and write.
- **Seeded backends:** run the repo's seed script or write its fixture files before `page.goto`, and point `REEL_START` at a server that reads them. Start "after" and "before" from the same seed.
- **Dates:** freeze the clock (`page.clock.setFixedTime(new Date('2026-05-16T10:00:00Z'))`) when the data carries fixed dates, or relative dates read "685 days ago". Shoot before and after at the same moment when the screen shows times relative to now.
- **Content:** realistic names ("Acme Studios"), no `test123`, and derived figures that agree with what is on screen. Never real customers, accounts or tokens.

## Environment knobs

`config.sh` sets the defaults; any of them can be overridden for one run.

| Variable | Effect |
|---|---|
| `REEL_START`, `REEL_SETUP`, `REEL_READY_PATH` | Start command (run with `$PORT`), install command for the base worktree, and the path polled until the app answers. |
| `REEL_PORT`, `REEL_BASE_PORT` | Ports of the working tree (4310) and the base worktree (4311). |
| `REEL_URL` | Target server for any `fast` or `record` run; when set, nothing is started. `run.sh … before` sets it to `http://localhost:$REEL_BASE_PORT` unless it is already set. |
| `REEL_HIDE` | CSS selectors of dev-only widgets to hide (React Query and Next.js devtools are hidden already). |
| `REEL_FAST=1` | No video, no pauses, no cursor animation (`run.sh fast`). |
| `REEL_VARIANT=before` | Writes to `out/<slug>/before`, records no video (`run.sh record <slug> before`). |
| `REEL_PACE=1.3` | Multiplies every pause and typing delay. |
| `REEL_WIDTH`, `REEL_HEIGHT` | Viewport, default 1280×800. Pass the same values to every `fast` and `record` run. |
| `REEL_BASE_REF`, `REEL_BASE_DIR` | Override the merge base (needed on the default branch or a merged branch, e.g. `<sha>^`) and the worktree path (`<repo>--pr-reel-base`). |
| `PR_REEL_HOME` | Where `bootstrap.sh` installs the runtime, instead of `<repo>--pr-reel`. |

## Demoing a merged PR

The default branch has moved on since the merge, so the working tree is not a faithful "after". Serve both sides from worktrees at the exact commits and point every run at them:

```bash
REEL_BASE_DIR=../<repo>--pr-reel-after REEL_BASE_PORT=4312 REEL_BASE_REF=<merge-sha> run.sh base start
REEL_BASE_REF=<merge-sha>^ run.sh base start
REEL_URL=http://localhost:4312 run.sh fast <slug>
REEL_URL=http://localhost:4312 run.sh record <slug>
run.sh record <slug> before
```

Remove both afterwards: `REEL_BASE_DIR=../<repo>--pr-reel-after REEL_BASE_PORT=4312 run.sh base remove` and `run.sh base remove`. Several reels can run at the same time: each scenario has its own Playwright output directory, so only the ports and worktree directories need to differ.

## Output tree

```
<repo>--pr-reel/out/<slug>/
  after/  raw.webm  timeline.json  shots/step-NN.png  shots/NN-<name>.png
  before/ timeline.json  shots/…
  build/  frame.png  caption-NN.png  intro.png
  <slug>[.xSPEED].mp4
  <slug>.page.<layout>.png
```

`timeline.json` holds the step captions with start/end offsets, the key shots and their highlights; `compose` reads it, so a scenario never needs to know about ffmpeg.
