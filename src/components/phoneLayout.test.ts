import { describe, expect, it } from 'vitest'
import { PHONE_AREAS, phoneSectionOf, readPhoneArea } from './phoneLayout'

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

describe('phoneSectionOf', () => {
  it('shows the farm section for 合成', () => {
    expect(phoneSectionOf('synthesis')).toBe('farm')
  })

  it('shows every other area in its own section', () => {
    for (const area of PHONE_AREAS) if (area !== 'synthesis') expect(phoneSectionOf(area)).toBe(area)
  })
})
