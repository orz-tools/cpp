import { describe, expect, it } from 'vitest'
import { SITE_QR, qrPath } from './siteQr'

const FINDER = ['#######', '#     #', '# ### #', '# ### #', '# ### #', '#     #', '#######']

function block(rows: readonly string[], top: number, left: number, size: number): string[] {
  return rows.slice(top, top + size).map((r) => r.slice(left, left + size))
}

describe('SITE_QR', () => {
  it('is 25 by 25 cells of # and space', () => {
    expect(SITE_QR).toHaveLength(25)
    for (const row of SITE_QR) expect(row).toMatch(/^[# ]{25}$/)
  })

  it('has a finder pattern in three corners', () => {
    expect(block(SITE_QR, 0, 0, 7)).toEqual(FINDER)
    expect(block(SITE_QR, 0, 18, 7)).toEqual(FINDER)
    expect(block(SITE_QR, 18, 0, 7)).toEqual(FINDER)
  })
})

describe('qrPath', () => {
  it('merges the dark cells of a row into runs', () => {
    expect(qrPath(['## #'], 1)).toBe('M0 0h2v1h-2zM3 0h1v1h-1z')
  })

  it('draws nothing for an empty row', () => {
    expect(qrPath(['    ', '#   '], 1)).toBe('M0 1h1v1h-1z')
  })

  it('scales by the module size', () => {
    expect(qrPath([' ##'], 2.24)).toBe('M2.24 0h4.48v2.24h-4.48z')
  })
})
