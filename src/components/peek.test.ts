import { describe, expect, it } from 'vitest'
import {
  BoardLayer,
  PeekStack,
  findPinned,
  peekKey,
  pinPeek,
  popPeek,
  pushPeek,
  raiseBoard,
  replacePinned,
  topOf,
  unpinPeek,
} from './peek'

const item = (id: string) => ({ kind: 'item', id })
const stage = (id: string) => ({ kind: 'stage', id })

describe('pushPeek', () => {
  it('adds what the card moves to after what it showed', () => {
    const stack: PeekStack = [item('30145')]
    expect(pushPeek(stack, item('30135'))).toEqual([item('30145'), item('30135')])
    expect(topOf(pushPeek(stack, item('30135')))).toEqual(item('30135'))
  })

  it('leaves the stack as it is for what the card already shows', () => {
    const stack: PeekStack = [stage('main_01-07'), item('30012')]
    expect(pushPeek(stack, item('30012'))).toBe(stack)
  })
})

describe('popPeek', () => {
  it('goes back one step', () => {
    expect(popPeek([item('30145'), item('30135')])).toEqual([item('30145')])
  })

  it('leaves a stack of one as it is', () => {
    const stack: PeekStack = [item('30145')]
    expect(popPeek(stack)).toBe(stack)
  })
})

describe('pinPeek', () => {
  it('adds the card at the bottom of the board', () => {
    const pins: PeekStack[] = [[item('30145')]]
    expect(pinPeek(pins, [stage('main_01-07')])).toEqual([[item('30145')], [stage('main_01-07')]])
  })

  it('pins nothing twice, judged by what each card shows', () => {
    const pins: PeekStack[] = [[stage('main_01-07'), item('30012')]]
    expect(pinPeek(pins, [item('30012')])).toBe(pins)
    // The same card one step back shows another thing, so it pins
    expect(pinPeek(pins, [stage('main_01-07')])).toHaveLength(2)
  })
})

describe('findPinned', () => {
  it('finds the pinned card that shows the thing', () => {
    const pins: PeekStack[] = [[item('30145')], [stage('main_01-07'), item('30012')]]
    expect(findPinned(pins, item('30012'))).toBe(1)
    expect(findPinned(pins, stage('main_01-07'))).toBe(-1)
    expect(findPinned([], item('30145'))).toBe(-1)
  })
})

describe('unpinPeek and replacePinned', () => {
  const pins: PeekStack[] = [[item('a')], [item('b')], [item('c')]]

  it('removes one card and keeps the order of the rest', () => {
    expect(unpinPeek(pins, 1)).toEqual([[item('a')], [item('c')]])
  })

  it('replaces one card in place', () => {
    expect(replacePinned(pins, 2, [item('c'), item('d')])).toEqual([[item('a')], [item('b')], [item('c'), item('d')]])
  })
})

describe('peekKey', () => {
  it('keeps kinds apart even when their ids match', () => {
    const keys = [item('1-7'), stage('1-7'), { kind: 'skill', id: '1-7' }].map(peekKey)
    expect(new Set(keys).size).toBe(3)
    expect(peekKey({ kind: 'skill', id: 'char_002_amiya/skcom_magic_rage[3]' })).toBe(
      'skill:char_002_amiya/skcom_magic_rage[3]',
    )
  })
})

describe('raiseBoard', () => {
  it('stays put when no window opened since the board last mounted', () => {
    const layer: BoardLayer = { generation: 2, epoch: 3 }
    expect(raiseBoard(layer, 3)).toBe(layer)
    expect(raiseBoard(layer, 1)).toBe(layer)
  })

  it('remounts above a window that opened since', () => {
    expect(raiseBoard({ generation: 2, epoch: 3 }, 4)).toEqual({ generation: 3, epoch: 4 })
    expect(raiseBoard({ generation: 0, epoch: 0 }, 1)).toEqual({ generation: 1, epoch: 1 })
  })
})
