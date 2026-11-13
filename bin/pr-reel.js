#!/usr/bin/env node
// Copies the pr-reel skill into an agent's skills folder.
// usage: npx pr-reel [--project | --dir <skills folder>]
import { cp, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const source = path.resolve(import.meta.dirname, '..', 'skills', 'pr-reel')

const { values: options } = parseArgs({
  options: {
    project: { type: 'boolean', default: false },
    dir: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (options.help) {
  console.log(
    [
      'usage: npx pr-reel [--project | --dir <skills folder>]',
      '',
      '  (no flag)   install for Claude Code in every project: ~/.claude/skills/pr-reel',
      '  --project   install for Claude Code in the current repository: .claude/skills/pr-reel',
      '  --dir       install into another agent\'s skills folder: <dir>/pr-reel',
    ].join('\n')
  )
  process.exit(0)
}

if (options.project && options.dir !== undefined) {
  console.error('use either --project or --dir, not both')
  process.exit(1)
}

const toSkillsDir = () => {
  if (options.dir !== undefined) return path.resolve(options.dir)
  if (options.project) return path.resolve('.claude', 'skills')
  return path.join(homedir(), '.claude', 'skills')
}

const target = path.join(toSkillsDir(), 'pr-reel')
// A clean copy, so files removed in a newer version do not linger
await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
console.log(`pr-reel installed at ${target}`)
console.log('Ask your agent on a branch with a change: "Record a pr-reel for this branch"')
