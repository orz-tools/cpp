import { describe, expect, it } from 'vitest'
import { THEME_SETTINGS, isDark, readThemeSetting } from './theme'

describe('readThemeSetting', () => {
  it('keeps each setting as stored', () => {
    for (const setting of THEME_SETTINGS) expect(readThemeSetting(setting)).toBe(setting)
  })

  it('reads anything else as following the system', () => {
    expect(readThemeSetting(null)).toBe('system')
    expect(readThemeSetting(undefined)).toBe('system')
    expect(readThemeSetting('auto')).toBe('system')
    expect(readThemeSetting('Dark')).toBe('system')
    expect(readThemeSetting(1)).toBe('system')
  })
})

describe('isDark', () => {
  it('follows the system only when set to', () => {
    expect(isDark('system', true)).toBe(true)
    expect(isDark('system', false)).toBe(false)
    expect(isDark('light', true)).toBe(false)
    expect(isDark('light', false)).toBe(false)
    expect(isDark('dark', true)).toBe(true)
    expect(isDark('dark', false)).toBe(true)
  })
})
