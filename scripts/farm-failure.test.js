import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeFarmFailure } from '../src/pkg/cpp-basic/farmFailure'

const script = path.join(import.meta.dirname, 'farm-failure.js')

async function issueBody() {
  const text = await encodeFarmFailure({
    at: '2026-11-20T00:00:00.000Z',
    game: 'arknights',
    region: 'zh_CN',
    build: 'abc',
    solver: { version: '1.0.3', precision: 1e-9 },
    data: { 'arknights-penguin-CN': '2026-11-20T00:00:00.000Z' },
    level: 'goal',
    failed: 'Goal',
    forbiddenStageIds: [],
    forbiddenFormulaTags: [],
    outcome: { feasible: false, bounded: true, result: 0 },
    model: {
      optimize: 'ap',
      opType: 'min',
      constraints: { 'battle:a': { min: 0 }, 'item:x': { min: 3 } },
      variables: { 'battle:a': { ap: 10, 'battle:a': 1, 'item:x': 1 / 3 } },
    },
  })
  return `Planning failed.\n\n<details><summary>data</summary>\n\n\`\`\`\n${text}\n\`\`\`\n\n</details>\n`
}

// Node runs the script as it is, importing farmFailure.ts with its types stripped
describe('scripts/farm-failure.js', () => {
  it('reads an issue body from stdin and solves its model again', async () => {
    const out = execFileSync(process.execPath, [script], { input: await issueBody(), encoding: 'utf-8' })
    expect(out).toContain('goal, failed planning for Goal')
    expect(out).toContain('arknights-penguin-CN 2026-11-20T00:00:00.000Z')
    expect(out).toMatch(/outcome\s+\{"feasible":true,"bounded":true,"result":90\}/)
    expect(out).toMatch(/battle:a 9\b/)
  })

  it('writes the model out', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-farm-failure-'))
    try {
      fs.writeFileSync(path.join(dir, 'issue.md'), await issueBody())
      execFileSync(process.execPath, [script, path.join(dir, 'issue.md'), '--model', path.join(dir, 'model.json')])
      const model = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf-8'))
      expect(model.variables['battle:a']['item:x']).toBe(1 / 3)
    } finally {
      fs.rmSync(dir, { recursive: true })
    }
  })
})
