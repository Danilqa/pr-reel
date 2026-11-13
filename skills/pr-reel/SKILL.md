---
name: pr-reel
description: Records a short captioned walkthrough video and before/after screenshots of a pull request's change with Playwright, and attaches them to the PR. For backend changes it puts a before/after table of real outputs in the PR instead. Use when a branch needs a demo for its pull request — "record a demo", "make a walkthrough video", "before and after screenshots for the PR", "show what changed", "pr reel" — or when opening a PR with a visible change.
---

# pr-reel

Turn a branch's change into a short captioned walkthrough video and a before/after page, recorded with Playwright against the app running locally, and attach both to the PR. `<skill-dir>` below is the base directory printed when this skill loads.

**Announce:** "I'm using pr-reel to record the PR demo."

## Outputs

| File | What it is |
|---|---|
| `out/<slug>/<slug>.mp4` | 10–25 s video on a black stage: intro card, one caption per step, visible cursor with click ripples, spotlight on the payoff |
| `out/<slug>/<slug>.page.<layout>.png` | Before/after page: `side-by-side`, `focus` (zoomed on the change), `callout`, `stacked`, `inset`; `storyboard` when there is no "before" |

The runtime lives next to the repository, in `<repo>--pr-reel/` (`run.sh`, `config.sh`, `scenarios/`, `out/`), so nothing is added to the repository, its lint or its type-check.

## Workflow

1. **Frame the change as a user story.** Read the diff against the merge base (`git diff --stat $(git merge-base origin/main HEAD)..HEAD`; for work already merged, `git show <sha>`), the PR title and the ticket. Write down: the page, what the user is trying to do, the 3–6 actions, and the payoff — the one thing that is different now. Look for existing end-to-end tests of the same screens and borrow their data setup.
2. **Bootstrap** from inside the repository (idempotent, seconds after the first run): `bash <skill-dir>/assets/bootstrap.sh`. It prints the runtime folder; `run.sh` below means `<repo>--pr-reel/run.sh`.
3. **Configure once** in `<repo>--pr-reel/config.sh`: `REEL_START` starts the app on `$PORT` from the repository root (`'pnpm --filter web exec vite --port $PORT --strictPort'`, `'PORT=$PORT npm run dev'`, …), `REEL_READY_PATH` is a path that answers once it is up, and `REEL_SETUP` installs dependencies in a fresh worktree (prefilled from the lockfile). Keep commands in single quotes.
4. **Give the app data.** Pick whatever the repo already uses for tests or demos: `page.route` mocks in the scenario, a seed script, fixture files, a demo mode. The repo may be public, so use synthetic data only — never a real account, customer or production database.
5. **Write the scenario** `<repo>--pr-reel/scenarios/<slug>.reel.ts`. Copy `scenarios/example.reel.ts` and follow `references/scenario-api.md`. The slug names every output file.
6. **Validate fast** — no video, no pauses: `run.sh fast <slug>`. Starts or reuses the app on `REEL_PORT` unless `REEL_URL` points somewhere else. Iterate until green. Fast runs write to `out/<slug>/.fast-<variant>/`, so they never overwrite a recording. Before recording, look at the fast run's `shots/step-NN.png` once: a green run proves the DOM, not what a viewer sees. If the change is clipped, record wider (`REEL_WIDTH=1440 REEL_HEIGHT=900` on every run).
7. **Record after**: `run.sh record <slug>`.
8. **Record before** when the branch changes something that already exists on the default branch (bug fix, copy, layout, behaviour). `run.sh base start` serves the merge base from a sibling worktree on `REEL_BASE_PORT`, then `run.sh record <slug> before` (and `run.sh fast <slug> before` to validate it). On the default branch or a merged branch the merge base is HEAD itself, so point it explicitly: `REEL_BASE_REF=<sha>^ run.sh base start`. For a PR that is already merged, serve the merge commit from a second worktree as "after" (see "Demoing a merged PR" in `references/scenario-api.md`). A different screen at the same point of the flow is still a valid before. New screen or flow → skip this; the page becomes a storyboard.
9. **Compose**: `run.sh compose <slug>` gives the video and the auto page set. `--speed 1,1.15 --page all` gives every variant when the author wants to choose.
10. **Check cheaply.** Look at the page PNG and at `run.sh frames <mp4>` (frames at 10 %, 38 %, 66 % and 94 %, so the payoff is on it). Do not step through the video. Caption wraps to two lines → shorten it. Payoff not obvious → `reel.spotlight(el, { shot: 'name' })` it. Before and after look identical → the key shot is at the wrong moment or the scenario never reaches the changed UI. A warning about a highlight off screen means the changed UI was below the fold: `spotlight` and `shot(…, { highlight })` scroll to it, a bare `shot` does not. A caption still showing while the next screen appears is expected: captions run until the next step starts.
11. **Attach** to the PR (`gh pr view --json number,url` on the branch; create the PR first if needed):
    ```bash
    gh pr edit <number> --attach <repo>--pr-reel/out/<slug>/<slug>.mp4 --attach '<repo>--pr-reel/out/<slug>/<slug>.page.side-by-side.png#Before and after'
    ```
    GitHub uploads them as user attachments, and the video gets an inline player.
12. **Clean up**: `run.sh base remove` (stops the base server, deletes the worktree). `out/` can stay.

## Backend changes

When the change has no screen (an API, a CLI, a query, a job), skip the video and show the behaviour instead:

1. Pick 1–3 inputs that show the difference: a request, a command, a query.
2. Run each against the merge base (the same `run.sh base start` worktree, or a plain `git worktree add`) and against the branch, and keep the outputs. Trim them to the lines that matter; keep the rest identical so the difference stands out.
3. Put a two-column table in the PR body. Markdown table cells cannot hold code blocks, so use HTML:
   ```html
   <table>
   <tr><th>Before</th><th>After</th></tr>
   <tr><td><pre>{ "status": "pending" }</pre></td><td><pre>{ "status": "paid", "paidAt": "2026-11-13T10:00:00Z" }</pre></td></tr>
   </table>
   ```
   One row per input, with the input itself as a `<th colspan="2">` row above it when it is not obvious. Escape `<`, `>` and `&` inside `<pre>`.

## Compose options

| Flag | Values | Default |
|---|---|---|
| `--speed` | playback factors, e.g. `1,1.15` | `1` |
| `--page` | layout ids, `all`, `none`, `auto` | `auto` (side-by-side + focus + callout, or storyboard) |
| `--shot` | name of the key `reel.shot` | the last one |
| `--note` | one line under "After" and in the callout | caption of that step |
| `--no-intro`, `--outro`, `--no-video` | toggles | intro on, outro off |

## Captions

One line, at most 60 characters, sentence case, no full stop. Describe what the user does or sees — "Search for a contact that does not exist yet" — never the component or the code. The last caption states the payoff. 3–6 steps, 10–25 s total; if it runs longer, cut steps rather than speeding up. `title` is the PR title without prefixes, `ticket` is the issue or PR id, `summary` is one sentence about the benefit.

## Pacing

Recorded in real time: per step, a 0.5 s beat before the body so the caption lands first and a 0.9 s settle after it (`hold` overrides the settle); 75 ms per typed character; the cursor eases towards each target. Several actions inside one step run back to back. `--speed 1.15` at compose time gives a snappier cut without re-recording; `REEL_PACE=1.3 run.sh record …` slows a recording down.

## Common mistakes

- Asserting the new behaviour without `if (!reel.isBefore)` — the before run then fails on purpose-built expectations. When the element itself changed (new label, link became a button), pick the locator with `reel.isBefore` too.
- A new action that never appears in the `before` run — guard it with `if (reel.isBefore) return` after the last shared step, so the before stops at the screen that did exist rather than failing.
- Clicking before the data the new UI depends on has loaded — set up `page.waitForResponse(pattern, { timeout: 8_000 }).catch(() => undefined)` before the click; a failed `expect` costs 45 s.
- Static mocks ignore filters, so a search shows every row; filter inside the `page.route` handler (see the example scenario).
- Skipping `reel.ready(...)` in the first step — the video keeps the blank frames from before the app rendered.
- Calling `playwright test` or the servers directly — `run.sh` loads `config.sh` and sets the variables the config and the recorder read.
- Editing `<repo>--pr-reel/lib` — the next bootstrap overwrites it. Change `<skill-dir>/assets/runtime` instead.
- Spotlighting the payoff while the app has scrolled elsewhere — the key frame comes out blank. `scrollIntoViewIfNeeded()` and a short `reel.pause` before the spotlight fixes it.
- Recording a real account or production data in a public repository's PR. Seed synthetic data instead.
