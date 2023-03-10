import { atom, getDefaultStore } from 'jotai'
import { describe, expect, it, assert } from 'vitest'
import { txatom } from '.'

interface UserData {
  status: Record<string, CharacterStatus>
}

interface CharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
}

function newUserData(): UserData {
  return {
    status: {},
  }
}

describe('user data test', () => {
  function env() {
    const base = atom(newUserData())
    const t = txatom(base)
    const store = getDefaultStore()
    return { base, ...t, store }
  }

  function myit(name: string, runner: (ctx: ReturnType<typeof env>) => any) {
    it(name, () => {
      return runner(env())
    })
  }

  myit('should init', ({ base, redoCounterAtom, undoCounterAtom, store }) => {
    assert.deepEqual(store.get(base), newUserData())
    assert.deepEqual(store.get(undoCounterAtom), 0)
    assert.deepEqual(store.get(redoCounterAtom), 0)
  })

  myit('can modify, undo and redo', ({ base, dataAtom, redoCounterAtom, undoCounterAtom, store }) => {
    assert.deepEqual(store.get(base), newUserData())

    store.set(dataAtom, 'modify', (x) => {
      x.status.amiya = {
        elite: 2,
        level: 80,
        skillLevel: 7,
        skillMaster: {},
        modLevel: {},
      }
    })

    const target = {
      status: {
        amiya: {
          elite: 2,
          level: 80,
          skillLevel: 7,
          skillMaster: {},
          modLevel: {},
        },
      },
    }
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(base), store.get(dataAtom))
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 0)

    store.set(dataAtom, 'undo')
    assert.deepEqual(store.get(base), newUserData())
    assert.deepEqual(store.get(undoCounterAtom), 0)
    assert.deepEqual(store.get(redoCounterAtom), 1)

    store.set(dataAtom, 'redo')
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 0)
  })

  myit('can respond to external changes', ({ base, dataAtom, redoCounterAtom, undoCounterAtom, store }) => {
    assert.deepEqual(store.get(base), newUserData())

    store.set(dataAtom, 'modify', (x) => {
      x.status.amiya = {
        elite: 2,
        level: 80,
        skillLevel: 7,
        skillMaster: {},
        modLevel: {},
      }
    })

    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 0)

    store.set(base, newUserData())

    assert.deepEqual(store.get(undoCounterAtom), 0)
    assert.deepEqual(store.get(redoCounterAtom), 0)
  })

  myit('can do transaction', ({ base, dataAtom, redoCounterAtom, undoCounterAtom, store }) => {
    assert.deepEqual(store.get(base), newUserData())

    store.set(dataAtom, 'modify', (x) => {
      x.status.amiya = {
        elite: 2,
        level: 80,
        skillLevel: 7,
        skillMaster: {},
        modLevel: {},
      }
    })

    const target = {
      status: {
        amiya: {
          elite: 2,
          level: 80,
          skillLevel: 7,
          skillMaster: {},
          modLevel: {},
        },
      },
    }
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 0)

    store.set(dataAtom, 'transact', () => {
      store.set(dataAtom, 'modify', (x) => {
        x.status.amiya.skillMaster.fire = 3
      })
      store.set(dataAtom, 'transact', () => {
        store.set(dataAtom, 'modify', (x) => {
          x.status.amiya.modLevel.x = 3
        })
      })
    })

    const target2 = {
      status: {
        amiya: {
          elite: 2,
          level: 80,
          skillLevel: 7,
          skillMaster: { fire: 3 },
          modLevel: { x: 3 },
        },
      },
    }
    assert.deepEqual(store.get(base), target2)
    assert.deepEqual(store.get(undoCounterAtom), 2)
    assert.deepEqual(store.get(redoCounterAtom), 0)

    store.set(dataAtom, 'undo')
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 1)

    store.set(dataAtom, 'redo')
    assert.deepEqual(store.get(base), target2)
    assert.deepEqual(store.get(undoCounterAtom), 2)
    assert.deepEqual(store.get(redoCounterAtom), 0)

    store.set(dataAtom, 'undo')
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 1)

    store.set(dataAtom, 'undo')
    assert.deepEqual(store.get(base), newUserData())
    assert.deepEqual(store.get(undoCounterAtom), 0)
    assert.deepEqual(store.get(redoCounterAtom), 2)

    store.set(dataAtom, 'redo')
    assert.deepEqual(store.get(base), target)
    assert.deepEqual(store.get(undoCounterAtom), 1)
    assert.deepEqual(store.get(redoCounterAtom), 1)

    store.set(dataAtom, 'redo')
    assert.deepEqual(store.get(base), target2)
    assert.deepEqual(store.get(undoCounterAtom), 2)
    assert.deepEqual(store.get(redoCounterAtom), 0)
  })

  myit(
    'can respond to external changes durning transaction',
    ({ base, dataAtom, redoCounterAtom, undoCounterAtom, store }) => {
      assert.deepEqual(store.get(base), newUserData())

      store.set(dataAtom, 'modify', (x) => {
        x.status.amiya = {
          elite: 2,
          level: 80,
          skillLevel: 7,
          skillMaster: {},
          modLevel: {},
        }
      })

      const target = {
        status: {
          amiya: {
            elite: 2,
            level: 80,
            skillLevel: 7,
            skillMaster: {},
            modLevel: {},
          },
        },
      }
      assert.deepEqual(store.get(base), target)
      assert.deepEqual(store.get(undoCounterAtom), 1)
      assert.deepEqual(store.get(redoCounterAtom), 0)

      expect(() => {
        store.set(dataAtom, 'transact', () => {
          store.set(dataAtom, 'modify', (x) => {
            x.status.amiya.skillMaster.fire = 3
          })
          store.set(dataAtom, 'transact', () => {
            store.set(base, newUserData())
            store.set(dataAtom, 'modify', (x) => {
              x.status.amiya.modLevel.x = 3
            })
          })
        })
      }).toThrowError()

      assert.deepEqual(store.get(base), newUserData())
      assert.deepEqual(store.get(undoCounterAtom), 0)
      assert.deepEqual(store.get(redoCounterAtom), 0)

      store.set(dataAtom, 'modify', (x) => {
        x.status.amiya = {
          elite: 1,
          level: 50,
          skillLevel: 7,
          skillMaster: {},
          modLevel: {},
        }
      })

      const target2 = {
        status: {
          amiya: {
            elite: 1,
            level: 50,
            skillLevel: 7,
            skillMaster: {},
            modLevel: {},
          },
        },
      }
      assert.deepEqual(store.get(base), target2)
      assert.deepEqual(store.get(undoCounterAtom), 1)
      assert.deepEqual(store.get(redoCounterAtom), 0)
    },
  )
})
