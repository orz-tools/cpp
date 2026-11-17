import { describe, expect, it } from 'vitest'
import {
  DossierState,
  clickCharacter,
  defaultDossierPrefs,
  readDossierPrefs,
  showCharacter,
  shownSection,
  visibleSections,
} from './dossierState'

const outside = (epoch: number) => ({ epoch, inWindow: false })
const inWindow = (epoch: number) => ({ epoch, inWindow: true })

describe('clickCharacter', () => {
  it('opens on the clicked character when closed', () => {
    expect(clickCharacter(null, 'a', outside(2))).toEqual({ charId: 'a', generation: 0, epoch: 2 })
  })

  it('switches to another character in place', () => {
    const state: DossierState = { charId: 'a', generation: 3, epoch: 1 }
    expect(clickCharacter(state, 'b', outside(2))).toEqual({ charId: 'b', generation: 3, epoch: 1 })
  })

  it('closes on a second click on the shown character', () => {
    expect(clickCharacter({ charId: 'a', generation: 0, epoch: 0 }, 'a', outside(0))).toBeNull()
  })

  it('reopens above a window that opened after it', () => {
    const state: DossierState = { charId: 'a', generation: 1, epoch: 2 }
    expect(clickCharacter(state, 'b', inWindow(3))).toEqual({ charId: 'b', generation: 2, epoch: 3 })
    // The same character reopens too, rather than closing
    expect(clickCharacter(state, 'a', inWindow(3))).toEqual({ charId: 'a', generation: 2, epoch: 3 })
  })

  it('switches and closes as usual inside the window it was opened from', () => {
    const state: DossierState = { charId: 'a', generation: 2, epoch: 3 }
    expect(clickCharacter(state, 'b', inWindow(3))).toEqual({ charId: 'b', generation: 2, epoch: 3 })
    expect(clickCharacter(state, 'a', inWindow(3))).toBeNull()
  })

  it('opens from a window when closed', () => {
    expect(clickCharacter(null, 'a', inWindow(4))).toEqual({ charId: 'a', generation: 0, epoch: 4 })
  })
})

describe('showCharacter', () => {
  it('keeps the dossier open on the character it already shows', () => {
    const state: DossierState = { charId: 'a', generation: 1, epoch: 2 }
    expect(showCharacter(state, 'a', outside(2))).toBe(state)
    expect(showCharacter(state, 'b', outside(2))).toEqual({ charId: 'b', generation: 1, epoch: 2 })
    expect(showCharacter(null, 'a', outside(2))).toEqual({ charId: 'a', generation: 0, epoch: 2 })
  })

  it('reopens above a window that covers it', () => {
    const state: DossierState = { charId: 'a', generation: 1, epoch: 2 }
    expect(showCharacter(state, 'a', inWindow(3))).toEqual({ charId: 'a', generation: 2, epoch: 3 })
    expect(showCharacter(state, 'a', inWindow(2))).toBe(state)
  })
})

describe('visibleSections', () => {
  it('keeps the registration order and drops the unavailable ones', () => {
    const sections = ['status', 'cost', 'building', 'skins', 'modules']
    expect(visibleSections(sections, (s) => s !== 'building' && s !== 'skins')).toEqual(['status', 'cost', 'modules'])
  })
})

describe('readDossierPrefs', () => {
  it('returns a complete record as it is', () => {
    expect(readDossierPrefs({ section: 'skins', statusMode: 'current' })).toEqual({
      section: 'skins',
      statusMode: 'current',
    })
  })

  it('falls back to the 练度 page and the goal when nothing readable is stored', () => {
    expect(defaultDossierPrefs).toEqual({ section: 'status', statusMode: 'goal' })
    for (const stored of [null, undefined, 'skins', ['skins', 'current'], 42]) {
      expect(readDossierPrefs(stored)).toEqual(defaultDossierPrefs)
    }
  })

  it('replaces only the field that is broken', () => {
    expect(readDossierPrefs({ section: '', statusMode: 'current' })).toEqual({
      section: 'status',
      statusMode: 'current',
    })
    expect(readDossierPrefs({ section: 3, statusMode: 'current' })).toEqual({
      section: 'status',
      statusMode: 'current',
    })
    expect(readDossierPrefs({ section: 'skins', statusMode: 'both' })).toEqual({ section: 'skins', statusMode: 'goal' })
    expect(readDossierPrefs({ section: 'skins' })).toEqual({ section: 'skins', statusMode: 'goal' })
  })
})

describe('shownSection', () => {
  const ids = ['status', 'cost', 'skins', 'moduleMissions']

  it('shows the remembered page when this character has it', () => {
    expect(shownSection('skins', ids)).toBe('skins')
  })

  it('shows the first page when this character lacks the remembered one', () => {
    expect(shownSection('moduleMissions', ['status', 'cost', 'skins'])).toBe('status')
    expect(shownSection('gone', ids)).toBe('status')
  })
})
