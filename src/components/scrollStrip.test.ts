import { describe, expect, it } from 'vitest'
import { scrollMore, wheelToScrollLeft } from './scrollStrip'

describe('scrollMore', () => {
  it('is null when everything fits', () => {
    expect(scrollMore(0, 390, 390)).toBeNull()
    expect(scrollMore(0, 300, 390)).toBeNull()
  })

  it('names the side or sides with something still hidden', () => {
    expect(scrollMore(0, 644, 390)).toBe('right')
    expect(scrollMore(100, 644, 390)).toBe('both')
    expect(scrollMore(254, 644, 390)).toBe('left')
  })

  it('counts a fraction of a pixel from either end as the end', () => {
    expect(scrollMore(0.5, 644, 390)).toBe('right')
    expect(scrollMore(253.5, 644, 390)).toBe('left')
  })
})

describe('wheelToScrollLeft', () => {
  const wheel = (deltaY: number, rest: Partial<Parameters<typeof wheelToScrollLeft>[0]> = {}) => ({
    deltaX: 0,
    deltaY,
    deltaMode: 0,
    ctrlKey: false,
    ...rest,
  })

  it('turns a vertical wheel into the same distance sideways', () => {
    expect(wheelToScrollLeft(wheel(100), 390)).toBe(100)
    expect(wheelToScrollLeft(wheel(-53), 390)).toBe(-53)
  })

  it('scales lines and pages to pixels', () => {
    expect(wheelToScrollLeft(wheel(3, { deltaMode: 1 }), 390)).toBe(96)
    expect(wheelToScrollLeft(wheel(-1, { deltaMode: 2 }), 390)).toBe(-390)
  })

  it('leaves sideways scrolling and pinch zoom to the browser', () => {
    expect(wheelToScrollLeft(wheel(0, { deltaX: 100 }), 390)).toBe(0)
    expect(wheelToScrollLeft(wheel(20, { deltaX: -40 }), 390)).toBe(0)
    expect(wheelToScrollLeft(wheel(10, { ctrlKey: true }), 390)).toBe(0)
  })
})
