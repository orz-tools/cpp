import { describe, expect, it } from 'vitest'
import { rosterFileName } from './download'

describe('rosterFileName', () => {
  it('names the file by the local time', () => {
    const date = new Date(2026, 10, 20, 9, 5, 42)
    expect(rosterFileName('png', date)).toBe('closure-plus-plus-roster-20261120-0905.png')
    expect(rosterFileName('svg', date)).toBe('closure-plus-plus-roster-20261120-0905.svg')
  })
})
