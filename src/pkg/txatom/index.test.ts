import { SetStateAction, atom, createStore, getDefaultStore } from 'jotai'
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

  myit('can compress transaction', ({ base, dataAtom, redoCounterAtom, undoCounterAtom, store }) => {
    assert.deepEqual(store.get(base), newUserData())

    store.set(dataAtom, 'transact', () => {
      store.set(dataAtom, 'modify', (x) => {
        x.status.amiya = {
          elite: 2,
          level: 80,
          skillLevel: 7,
          skillMaster: {},
          modLevel: {},
        }
      })
      store.set(dataAtom, 'modify', (x) => {
        delete x.status.amiya
      })
    })

    assert.deepEqual(store.get(base), newUserData())
    assert.deepEqual(store.get(undoCounterAtom), 0)
    assert.deepEqual(store.get(redoCounterAtom), 0)
  })
})

describe('user data test with mounted derived base', () => {
  // 应用里的 base 是存储之上的派生 atom，界面又把它们全挂载着。txatom 依赖同一次 write 里
  // set() 之后的 get() 读到新值；jotai 2.4.0–2.4.1 在这种情况下返回旧值，undo 记下旧 head，
  // 界面停在撤销前的数据（CPP-3）。只用原始 atom、不挂载的测试覆盖不到这一点。
  function env() {
    const storage = atom(newUserData())
    const base = atom(
      (get) => get(storage),
      (_get, set, value: SetStateAction<UserData>) => set(storage, value),
    )
    const t = txatom(base)
    const store = createStore()
    for (const a of [base, t.dataAtom, t.undoCounterAtom, t.redoCounterAtom]) store.sub(a, () => {})
    return { base, ...t, store }
  }

  it('keeps data, base and counters in step across undo and redo', () => {
    const { base, dataAtom, undoCounterAtom, redoCounterAtom, store } = env()
    const level = () => store.get(dataAtom).status.amiya?.level

    store.set(dataAtom, 'modify', (x) => {
      x.status.amiya = { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {} }
    })
    store.set(dataAtom, 'modify', (x) => {
      x.status.amiya.level = 2
    })
    assert.equal(level(), 2)
    assert.equal(store.get(undoCounterAtom), 2)

    store.set(dataAtom, 'undo')
    assert.equal(level(), 1)
    assert.strictEqual(store.get(dataAtom), store.get(base))
    assert.equal(store.get(undoCounterAtom), 1)
    assert.equal(store.get(redoCounterAtom), 1)

    store.set(dataAtom, 'redo')
    assert.equal(level(), 2)
    assert.strictEqual(store.get(dataAtom), store.get(base))
    assert.equal(store.get(undoCounterAtom), 2)
    assert.equal(store.get(redoCounterAtom), 0)
  })

  it('sees earlier modifications inside a transaction', () => {
    const { base, dataAtom, undoCounterAtom, store } = env()
    // 和 UserData 里 currentCharacter 的写法一样：transact 和 modify 都走同一次 write 的 set
    const writer = atom(null, (_get, set) => {
      set(dataAtom, 'transact', () => {
        set(dataAtom, 'modify', (x) => {
          x.status.amiya = { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {} }
        })
        set(dataAtom, 'modify', (x) => {
          x.status.amiya.level = 2
        })
      })
    })

    store.set(writer)

    assert.equal(store.get(base).status.amiya.level, 2)
    assert.strictEqual(store.get(dataAtom), store.get(base))
    assert.equal(store.get(undoCounterAtom), 1)
  })
})
