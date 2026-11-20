import { describe, expect, it } from 'vitest'
import { defaultRosterImagePrefs, readRosterImagePrefs, rosterScheme } from './prefs'

describe('rosterScheme', () => {
  it('follows the app until a scheme is chosen', () => {
    expect(rosterScheme(undefined, false)).toBe('light')
    expect(rosterScheme(undefined, true)).toBe('dark')
  })

  it('keeps the chosen scheme whatever the app shows', () => {
    expect(rosterScheme('light', true)).toBe('light')
    expect(rosterScheme('dark', false)).toBe('dark')
  })
})

describe('readRosterImagePrefs', () => {
  it('falls back to the defaults for nothing stored or a bad value', () => {
    expect(readRosterImagePrefs(null)).toEqual(defaultRosterImagePrefs)
    expect(readRosterImagePrefs(undefined)).toEqual(defaultRosterImagePrefs)
    expect(readRosterImagePrefs('x')).toEqual(defaultRosterImagePrefs)
    expect(readRosterImagePrefs([1, 2])).toEqual(defaultRosterImagePrefs)
    expect(readRosterImagePrefs({ columns: '3', goal: 'yes', header: 5 })).toEqual(defaultRosterImagePrefs)
  })

  it('keeps what it recognises', () => {
    expect(readRosterImagePrefs({ columns: 3, order: 'columns', goal: true, header: '博士', scheme: 'dark' })).toEqual({
      columns: 3,
      order: 'columns',
      goal: true,
      header: '博士',
      scheme: 'dark',
    })
  })

  it('reads prefs stored before the scheme as not chosen', () => {
    const old = readRosterImagePrefs({ columns: 2, order: 'rows', goal: true, header: '' })
    expect(old.scheme).toBeUndefined()
    expect('scheme' in old).toBe(false)
  })

  it('takes an unknown scheme as not chosen', () => {
    for (const scheme of ['auto', 'Dark', 1, true, null, {}]) {
      expect(readRosterImagePrefs({ scheme }).scheme).toBeUndefined()
    }
    expect(readRosterImagePrefs({ scheme: 'light' }).scheme).toBe('light')
  })

  it('rounds the columns and clamps them to 1–6', () => {
    expect(readRosterImagePrefs({ columns: 0 }).columns).toBe(1)
    expect(readRosterImagePrefs({ columns: -4 }).columns).toBe(1)
    expect(readRosterImagePrefs({ columns: 9 }).columns).toBe(6)
    expect(readRosterImagePrefs({ columns: 2.6 }).columns).toBe(3)
    expect(readRosterImagePrefs({ columns: Number.NaN }).columns).toBe(1)
    expect(readRosterImagePrefs({ columns: Infinity }).columns).toBe(1)
  })

  it('takes an unknown order as rows', () => {
    expect(readRosterImagePrefs({ order: 'diagonal' }).order).toBe('rows')
  })

  it('cuts a long header to 40 characters without splitting a surrogate pair', () => {
    expect(readRosterImagePrefs({ header: 'a'.repeat(50) }).header).toBe('a'.repeat(40))
    const emoji = '😀'.repeat(41)
    expect(readRosterImagePrefs({ header: emoji }).header).toBe('😀'.repeat(40))
  })
})
