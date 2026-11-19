import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELECTION,
  clickKind,
  extendSelection,
  plainSelection,
  rangeKeys,
  sameScope,
  toggleSelection,
  visibleSelection,
} from './listSelection'

const keys = (...xs: string[]) => new Set(xs)

describe('clickKind', () => {
  const click = (mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) =>
    clickKind({ shiftKey: false, ctrlKey: false, metaKey: false, ...mods })

  it('tells a plain click from Ctrl, ⌘ and Shift', () => {
    expect(click({})).toBe('plain')
    expect(click({ ctrlKey: true })).toBe('toggle')
    expect(click({ metaKey: true })).toBe('toggle')
    expect(click({ shiftKey: true })).toBe('extend')
  })

  it('extends with Shift held along with Ctrl', () => {
    expect(click({ ctrlKey: true, shiftKey: true })).toBe('extend')
  })
})

describe('toggleSelection', () => {
  it('selects a key and anchors on it', () => {
    expect(toggleSelection(EMPTY_SELECTION, 'b')).toEqual({ keys: keys('b'), anchor: 'b' })
  })

  it('deselects a selected key and still anchors on it', () => {
    expect(toggleSelection({ keys: keys('b', 'c') }, 'b')).toEqual({ keys: keys('c'), anchor: 'b' })
  })
})

describe('extendSelection', () => {
  it('adds the range and keeps the anchor', () => {
    expect(extendSelection({ keys: keys('a'), anchor: 'a' }, ['b', 'c'])).toEqual({
      keys: keys('a', 'b', 'c'),
      anchor: 'a',
    })
  })
})

describe('plainSelection', () => {
  it('clears the selection and anchors on the key', () => {
    expect(plainSelection('c')).toEqual({ keys: keys(), anchor: 'c' })
  })
})

describe('rangeKeys', () => {
  const list = ['a', 'b', 'c', 'd', 'e']

  it('takes both ends and what lies between, either way round', () => {
    expect(rangeKeys(list, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(rangeKeys(list, 'b', 'd')).toEqual(['b', 'c', 'd'])
  })

  it('has no range from an anchor not in the list', () => {
    expect(rangeKeys(list, 'x', 'b')).toBeUndefined()
  })
})

describe('visibleSelection', () => {
  it('returns the selected set itself when every key is in the list', () => {
    const s = { keys: keys('a', 'b') }
    expect(visibleSelection(s, ['a', 'b', 'c'])).toBe(s.keys)
  })

  it('leaves out keys that are not in the list', () => {
    expect(visibleSelection({ keys: keys('a', 'x') }, ['a', 'b'])).toEqual(keys('a'))
  })
})

describe('sameScope', () => {
  const p = {}
  const q = {}

  it('compares item by item by reference', () => {
    expect(sameScope([p, q], [p, q])).toBe(true)
    expect(sameScope([p, q], [p, {}])).toBe(false)
    expect(sameScope([p, q], [p])).toBe(false)
  })

  it('takes two missing scopes as the same', () => {
    expect(sameScope(undefined, undefined)).toBe(true)
    expect(sameScope(undefined, [p])).toBe(false)
  })
})
