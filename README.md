# pr-reel

Your agent records a captioned demo and a before/after of every pull request.

Ask for a reel on a branch and the agent frames the change as a user story, writes a Playwright scenario, records it against your app running locally, replays the same flow on the merge base, and attaches the results to the PR:

- **a 10–25 s video**: intro card, one caption per step, a visible cursor with click ripples, a spotlight on the payoff
- **a before/after page**: side by side, zoomed on the change, or a storyboard for a new screen
- **a before/after table** for backend changes: the same request or command against both versions

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

## Use

On a branch with a visible change:

> Record a pr-reel for this branch

The first run installs a small runtime next to the repository, in `<repo>--pr-reel/`, and asks for the command that starts your app. Nothing is added to the repository itself.

## Requirements

- git, Node.js 20 or newer and ffmpeg
- [gh](https://cli.github.com) to attach the files to the PR
- an app that starts locally with one command, and data the agent can mock or seed

Playwright and its Chromium are installed into the runtime on the first run.

## How it works

| Step | What happens |
|---|---|
| Frame | Reads the diff, the PR and the ticket; writes down the page, the 3–6 actions and the payoff |
| Script | Writes `scenarios/<slug>.reel.ts`: Playwright with captioned steps, `reel.click`, `reel.spotlight` |
| Record | Runs it against the working tree (video) and against the merge base in a git worktree (screenshots) |
| Compose | Builds the mp4 with ffmpeg and the before/after pages with headless Chromium |
| Attach | `gh pr edit --attach` uploads both; GitHub plays the video inline |

The skill's instructions are in [skills/pr-reel/SKILL.md](skills/pr-reel/SKILL.md), the scenario API in [references/scenario-api.md](skills/pr-reel/references/scenario-api.md).

## License

[MIT](LICENSE)
