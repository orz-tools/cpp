import { describe, expect, it } from 'vitest'
import { PHONE_AREAS, readPhoneArea } from './phoneLayout'

describe('readPhoneArea', () => {
  it('keeps each area as stored', () => {
    for (const area of PHONE_AREAS) expect(readPhoneArea(area)).toBe(area)
  })

  it('reads anything else as the character list', () => {
    expect(readPhoneArea(null)).toBe('chars')
    expect(readPhoneArea(undefined)).toBe('chars')
    expect(readPhoneArea(3)).toBe('chars')
    expect(readPhoneArea('foo')).toBe('chars')
    expect(readPhoneArea({ area: 'tasks' })).toBe('chars')
  })
})
