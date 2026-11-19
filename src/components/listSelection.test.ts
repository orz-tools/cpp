import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELECTION,
  clickHandled,
  clickKind,
  clickSelection,
  extendSelection,
  plainSelection,
  rangeKeys,
  sameScope,
  selectAllSelection,
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

describe('clickHandled', () => {
  it('leaves a plain click to the row only while nothing is selected', () => {
    expect(clickHandled('plain', false)).toBe(false)
    expect(clickHandled('plain', true)).toBe(true)
  })

  it('handles Ctrl and Shift clicks either way', () => {
    for (const selecting of [false, true]) {
      expect(clickHandled('toggle', selecting)).toBe(true)
      expect(clickHandled('extend', selecting)).toBe(true)
    }
  })
})

describe('clickSelection', () => {
  const list = ['a', 'b', 'c', 'd', 'e']
  const extent = (key: string) => (anchor: string) => rangeKeys(list, anchor, key)
  const none = () => undefined

  describe('a plain click while nothing is selected', () => {
    it('is plainSelection', () => {
      expect(clickSelection({ keys: keys(), anchor: 'a' }, 'plain', 'c', false, extent('c'))).toEqual(
        plainSelection('c'),
      )
    })

    it('returns the state itself when it is already empty and anchored on the key', () => {
      const s = { keys: keys(), anchor: 'c' }
      expect(clickSelection(s, 'plain', 'c', false, extent('c'))).toBe(s)
    })

    it('clears keys left over from rows no longer in the list', () => {
      expect(clickSelection({ keys: keys('x'), anchor: 'x' }, 'plain', 'c', false, extent('c'))).toEqual({
        keys: keys(),
        anchor: 'c',
      })
    })
  })

  describe('a plain click while selecting', () => {
    it('selects an unselected key and anchors on it', () => {
      expect(clickSelection({ keys: keys('a'), anchor: 'a' }, 'plain', 'c', true, extent('c'))).toEqual({
        keys: keys('a', 'c'),
        anchor: 'c',
      })
    })

    it('deselects a selected key and anchors on it', () => {
      expect(clickSelection({ keys: keys('a', 'c'), anchor: 'a' }, 'plain', 'c', true, extent('c'))).toEqual({
        keys: keys('a'),
        anchor: 'c',
      })
    })

    it('leaves nothing selected after the last one', () => {
      expect(clickSelection({ keys: keys('c'), anchor: 'c' }, 'plain', 'c', true, extent('c')).keys).toEqual(keys())
    })
  })

  it('toggles with Ctrl either way', () => {
    const s = { keys: keys('a'), anchor: 'a' }
    for (const selecting of [false, true]) {
      expect(clickSelection(s, 'toggle', 'c', selecting, extent('c'))).toEqual(toggleSelection(s, 'c'))
      expect(clickSelection(s, 'toggle', 'a', selecting, extent('a'))).toEqual(toggleSelection(s, 'a'))
    }
  })

  describe('a Shift click', () => {
    it('adds the range from the anchor and keeps the anchor', () => {
      for (const selecting of [false, true]) {
        expect(clickSelection({ keys: keys('a'), anchor: 'b' }, 'extend', 'd', selecting, extent('d'))).toEqual({
          keys: keys('a', 'b', 'c', 'd'),
          anchor: 'b',
        })
      }
    })

    it('toggles without an anchor', () => {
      const s = { keys: keys('a') }
      expect(clickSelection(s, 'extend', 'c', true, extent('c'))).toEqual(toggleSelection(s, 'c'))
      expect(clickSelection(EMPTY_SELECTION, 'extend', 'c', false, extent('c'))).toEqual(
        toggleSelection(EMPTY_SELECTION, 'c'),
      )
    })

    it('toggles when there is no range from the anchor', () => {
      const s = { keys: keys(), anchor: 'x' }
      expect(clickSelection(s, 'extend', 'c', false, none)).toEqual(toggleSelection(s, 'c'))
    })
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

describe('selectAllSelection', () => {
  it('adds every key, keeps the selected ones off the list and the anchor', () => {
    expect(selectAllSelection({ keys: keys('x', 'b'), anchor: 'b' }, ['a', 'b', 'c'])).toEqual({
      keys: keys('x', 'b', 'a', 'c'),
      anchor: 'b',
    })
  })

  it('returns the same state when every key is selected already', () => {
    const s = { keys: keys('a', 'b', 'c'), anchor: 'a' }
    expect(selectAllSelection(s, ['a', 'b'])).toBe(s)
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
