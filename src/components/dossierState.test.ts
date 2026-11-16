import { describe, expect, it } from 'vitest'
import { DossierState, clickCharacter, visibleSections } from './dossierState'

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

describe('visibleSections', () => {
  it('keeps the registration order and drops the unavailable ones', () => {
    const sections = ['status', 'cost', 'building', 'skins', 'modules']
    expect(visibleSections(sections, (s) => s !== 'building' && s !== 'skins')).toEqual(['status', 'cost', 'modules'])
  })
})
