---
name: pr-reel
description: Shows a pull request's change on the PR itself, in one of three formats - a captioned walkthrough video for a flow, before/after screenshots on a black page for a single screen, or plain-English bullets with a before/after table when nothing visible changed. Records with Playwright against the app running locally and attaches with gh. Use when a branch needs a demo for its pull request - "record a demo", "make a walkthrough video", "before and after screenshots for the PR", "show what changed", "pr reel" - or when opening a PR with a visible change.
---

# pr-reel

Show a branch's change on its PR: a short captioned walkthrough video, a before/after page, or a before/after table, recorded against the app running locally. `<skill-dir>` below is the base directory printed when this skill loads.

**Announce:** "I'm using pr-reel to show the PR's change."

## Pick the format

| The change | What goes on the PR |
|---|---|
| A flow: several actions, an interaction, an animation | Video + before/after page (the full workflow below) |
| One screen: copy, layout, a new column, a fixed style; nothing to click through | Before/after page only, on the same black surface (`compose --no-video`) |
| Nothing visible: an API, a CLI, a query, a job, a config | Bullets + before/after table (see "Changes without UI"); no recording |

If the user names a format ("just screenshots", "a video", "a table"), use that one and skip the choice. Between a video and a page, pick the page when in doubt: it is quicker to review.

## Outputs

| File | What it is |
|---|---|
| `out/<slug>/<slug>.mp4` | 10–25 s video on a black stage: intro card, one caption per step, visible cursor with click ripples, spotlight on the payoff |
| `out/<slug>/<slug>.page.<layout>.png` | Before/after page: `side-by-side`, `focus` (zoomed on the change), `callout`, `stacked`, `inset`; `storyboard` when there is no "before" |

The runtime lives next to the repository, in `<repo>--pr-reel/` (`run.sh`, `config.sh`, `scenarios/`, `out/`), so nothing is added to the repository, its lint or its type-check.

## Workflow

For a video or a page:

1. **Frame the change as a user story.** Read the diff against the merge base (`git diff --stat $(git merge-base origin/main HEAD)..HEAD`; for work already merged, `git show <sha>`), the PR title and the ticket. Write down: the page, what the user is trying to do, the 3–6 actions, and the payoff — the one thing that is different now. For one screen, it is just the page and the payoff. Look for existing end-to-end tests of the same screens and borrow their data setup.
2. **Bootstrap** from inside the repository (idempotent, seconds after the first run): `bash <skill-dir>/assets/bootstrap.sh`. It prints the runtime folder; `run.sh` below means `<repo>--pr-reel/run.sh`.
3. **Configure once** in `<repo>--pr-reel/config.sh`: `REEL_START` starts the app on `$PORT` from the repository root (`'pnpm --filter web exec vite --port $PORT --strictPort'`, `'PORT=$PORT npm run dev'`, …), `REEL_READY_PATH` is a path that answers once it is up, and `REEL_SETUP` installs dependencies in a fresh worktree (prefilled from the lockfile). Keep commands in single quotes.
4. **Give the app data.** Pick whatever the repo already uses for tests or demos: `page.route` mocks in the scenario, a seed script, fixture files, a demo mode. The repo may be public, so use synthetic data only — never a real account, customer or production database.
5. **Write the scenario** `<repo>--pr-reel/scenarios/<slug>.reel.ts`. Copy `scenarios/example.reel.ts` and follow `references/scenario-api.md`. The slug names every output file.
   For one screen, the scenario is one or two steps: open the page, `reel.ready(...)`, then `reel.spotlight(el, { shot: 'name' })` on the change (or `reel.shot(name, { highlight: el })`).
6. **Validate fast** — no video, no pauses: `run.sh fast <slug>`. Starts or reuses the app on `REEL_PORT` unless `REEL_URL` points somewhere else. Iterate until green. Fast runs write to `out/<slug>/.fast-<variant>/`, so they never overwrite a recording. Before recording, look at the fast run's `shots/step-NN.png` once: a green run proves the DOM, not what a viewer sees. If the change is clipped, record wider (`REEL_WIDTH=1440 REEL_HEIGHT=900` on every run).
7. **Record after**: `run.sh record <slug>`.
8. **Record before** when the branch changes something that already exists on the default branch (bug fix, copy, layout, behaviour). `run.sh base start` serves the merge base from a sibling worktree on `REEL_BASE_PORT`, then `run.sh record <slug> before` (and `run.sh fast <slug> before` to validate it). On the default branch or a merged branch the merge base is HEAD itself, so point it explicitly: `REEL_BASE_REF=<sha>^ run.sh base start`. For a PR that is already merged, serve the merge commit from a second worktree as "after" (see "Demoing a merged PR" in `references/scenario-api.md`). A different screen at the same point of the flow is still a valid before. New screen or flow → skip this; the page becomes a storyboard.
9. **Compose**: `run.sh compose <slug>` gives the video and the auto page set. `--speed 1,1.15 --page all` gives every variant when the author wants to choose. For one screen: `run.sh compose <slug> --no-video --page side-by-side` (`--page focus` when the change is small on a large screen).
10. **Check cheaply.** Look at the page PNG and at `run.sh frames <mp4>` (frames at 10 %, 38 %, 66 % and 94 %, so the payoff is on it). Do not step through the video. Caption wraps to two lines → shorten it. Payoff not obvious → `reel.spotlight(el, { shot: 'name' })` it. Before and after look identical → the key shot is at the wrong moment or the scenario never reaches the changed UI. A warning about a highlight off screen means the changed UI was below the fold: `spotlight` and `shot(…, { highlight })` scroll to it, a bare `shot` does not. A caption still showing while the next screen appears is expected: captions run until the next step starts.
11. **Attach** to the PR (`gh pr view --json number,url` on the branch; create the PR first if needed):
    ```bash
    gh pr edit <number> --attach <repo>--pr-reel/out/<slug>/<slug>.mp4 --attach '<repo>--pr-reel/out/<slug>/<slug>.page.side-by-side.png#Before and after'
    ```
    GitHub uploads them as user attachments, and the video gets an inline player. For one screen, attach only the page.
12. **Clean up**: `run.sh base remove` (stops the base server, deletes the worktree). `out/` can stay.

## Changes without UI

When nothing visible changed (an API, a CLI, a query, a job, a config), skip the runtime and show the behaviour in words and outputs:

1. **Bullets.** 2–5 bullets in simple English about what changed for whoever uses it: one change per bullet, short sentences, everyday words, present tense. Say what someone notices ("Paid invoices now say when they were paid"), not how the code does it; name a function or a file only when the reader calls it directly.
2. **Inputs.** Pick 1–3 inputs that show the difference: a request, a command, a query.
3. **Outputs.** Run each against the merge base (`git worktree add --detach ../<repo>--before $(git merge-base origin/main HEAD)`, then install and start it) and against the branch, and keep the outputs. Trim them to the lines that matter; keep the rest identical so the difference stands out. Remove the worktree afterwards.
4. **Table.** Markdown table cells cannot hold code blocks, so use HTML: a Before/After header, then for each input a `<th colspan="2">` row naming it and a row with the two outputs. Escape `<`, `>` and `&` inside `<pre>`.
   ```markdown
   - Paid invoices now say when they were paid.
   - Pending invoices look the same as before.

   <table>
   <tr><th>Before</th><th>After</th></tr>
   <tr><th colspan="2"><code>GET /api/invoices/inv-1</code></th></tr>
   <tr><td><pre>{ "status": "paid" }</pre></td><td><pre>{ "status": "paid", "paidAt": "2026-11-13T10:00:00Z" }</pre></td></tr>
   </table>
   ```
5. **Attach** by adding it to the end of the PR body, keeping what is already there:
   ```bash
   { gh pr view <number> --json body --jq .body; echo; cat changes.md; } > /tmp/pr-body.md
   gh pr edit <number> --body-file /tmp/pr-body.md
   ```

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
