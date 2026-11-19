import { describe, expect, it } from 'vitest'
import { intBetween, z } from '.'

describe('z', () => {
  it('says what was wrong with the input', () => {
    expect(() => z.object({ level: z.number() }).parse({ level: '90' })).toThrow(
      'Invalid input: expected number, received string',
    )
  })
})

describe('intBetween', () => {
  it('takes whole numbers within both bounds', () => {
    const elite = intBetween(0, 2)
    expect([0, 2].map((x) => elite.safeParse(x).success)).toEqual([true, true])
    expect([-1, 3, 1.5].map((x) => elite.safeParse(x).success)).toEqual([false, false, false])
  })
})
