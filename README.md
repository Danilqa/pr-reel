# pr-reel

Your agent records a captioned demo and a before/after of every pull request.

Ask for a reel on a branch and the agent frames the change, records it against your app running locally, replays it on the merge base, and attaches the result to the PR in the format that fits:

| The change | On the PR |
|---|---|
| A flow | A 10–25 s video (intro card, one caption per step, a visible cursor with click ripples, a spotlight on the payoff) and a before/after page |
| One screen | Before/after screenshots on the same black page: side by side, or zoomed on the change |
| Nothing visible | Plain-English bullets and a before/after table: the same request or command against both versions |

Name a format ("just screenshots", "a video", "a table") and the agent uses that one.

## Install

With the [skills CLI](https://skills.sh), for Claude Code, Codex, Cursor and other agents:

```bash
npx skills add Danilqa/pr-reel
```

As a Claude Code plugin:

```
/plugin marketplace add Danilqa/pr-reel
/plugin install pr-reel@pr-reel
```

With npm:

```bash
npx pr-reel                        # Claude Code, every project: ~/.claude/skills/pr-reel
npx pr-reel --project              # Claude Code, this repository: .claude/skills/pr-reel
npx pr-reel --dir <skills folder>  # any other agent's skills folder
```

Run it again to update.

## Use

On a branch with a visible change:

> Record a pr-reel for this branch

The first run installs a small runtime next to the repository, in `<repo>--pr-reel/`, and asks for the command that starts your app. Nothing is added to the repository itself.

## Requirements

- git, Node.js 22 or newer and ffmpeg
- [gh](https://cli.github.com) to attach the files to the PR
- an app that starts locally with one command, and data the agent can mock or seed

Playwright and its Chromium are installed into the runtime on the first run.

## How it works

| Step | What happens |
|---|---|
| Frame | Reads the diff, the PR and the ticket; picks the format; writes down the page, the 3–6 actions and the payoff |
| Script | Writes `scenarios/<slug>.reel.ts`: Playwright with captioned steps, `reel.click`, `reel.spotlight` |
| Record | Runs it against the working tree (video) and against the merge base in a git worktree (screenshots) |
| Compose | Builds the mp4 with ffmpeg and the before/after pages with headless Chromium |
| Attach | `gh pr edit --attach` uploads both; GitHub plays the video inline |

The skill's instructions are in [skills/pr-reel/SKILL.md](skills/pr-reel/SKILL.md), the scenario API in [references/scenario-api.md](skills/pr-reel/references/scenario-api.md).

## License

[MIT](LICENSE)
