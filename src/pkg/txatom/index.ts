import deepEqual from 'deep-equal'
import { Draft, Patch, applyPatches, enablePatches, produce, produceWithPatches } from 'immer'
import { PrimitiveAtom, atom } from 'jotai'

enablePatches()

interface TxStorage<T extends object> {
  head?: T
  startHead?: T
  undos: { directPatches: Patch[]; inversePatches: Patch[] }[]
  redos: { directPatches: Patch[]; inversePatches: Patch[] }[]
  level: number
  directPatches: Patch[]
  inversePatches: Patch[]
}

type TxStorageAction<T extends object> =
  | [action: 'update', doc: T, directPatches: Patch[], inversePatches: Patch[]]
  | [action: 'begin']
  | [action: 'commit']
  | [action: 'undo']
  | [action: 'redo']

export type TxDataAction<T extends object> =
  | [action: 'modify', draft: (draft: Draft<T>) => void]
  | [action: 'transact', task: () => any]
  | [action: 'undo']
  | [action: 'redo']

function emptyStorage<T extends object>(): TxStorage<T> {
  return { undos: [], redos: [], level: 0, directPatches: [], inversePatches: [] }
}

export function txatom<T extends object>(baseAtom: PrimitiveAtom<T>, history = 10) {
  const txStorageAtom = atom(emptyStorage<T>())

  const txAtom = atom<TxStorage<T>, TxStorageAction<T>, void>(
    (get) => get(txStorageAtom),
    (get, set, ...action: TxStorageAction<T>) => {
      let storage = get(txStorageAtom)
      switch (action[0]) {
        case 'update':
          set(
            txStorageAtom,
            (storage = produce(storage, (draft) => {
              draft.head = action[1] as Draft<T>
              draft.directPatches.push(...action[2])
              draft.inversePatches.splice(0, 0, ...action[3])
            })),
          )
          break

        case 'commit': {
          let conflicts = false
          set(
            txStorageAtom,
            (storage = produce(storage, (draft) => {
              if (draft.level > 0) {
                draft.level -= 1
              }

              if (draft.level === 0) {
                if (storage.startHead! !== get(baseAtom)) {
                  conflicts = true
                  draft.undos = []
                  draft.redos = []
                  draft.directPatches = []
                  draft.inversePatches = []
                  draft.startHead = undefined
                  draft.head = get(baseAtom) as Draft<T>
                  return
                }
                if (draft.directPatches.length > 0 || draft.inversePatches.length > 0) {
                  const [y, directPatches, inversePatches] = produceWithPatches(storage.startHead, (x) =>
                    applyPatches(x, draft.directPatches),
                  )
                  // FIXME: get rid of this deepEqual, or better patches
                  if (!deepEqual(y, storage.startHead) && (directPatches.length > 0 || inversePatches.length > 0)) {
                    draft.undos.push({ directPatches: directPatches, inversePatches: inversePatches })
                    // console.log('new patch', { directPatches: directPatches, inversePatches: inversePatches })
                    if (draft.undos.length > history) {
                      draft.undos.splice(0, draft.undos.length - history)
                    }
                    draft.redos = []
                  }
                  draft.directPatches = []
                  draft.inversePatches = []
                }
                draft.startHead = undefined
              }
            })),
          )
          if (conflicts) {
            throw new Error('Data changed externally durning transaction!')
          }
          if (storage.level === 0 && 'head' in storage) {
            set(baseAtom, storage.head!)
          }
          break
        }

        case 'begin':
          set(
            txStorageAtom,
            (storage = produce(storage, (draft) => {
              if (draft.level === 0) {
                console.assert(draft.directPatches.length === 0)
                console.assert(draft.inversePatches.length === 0)

                const ext = get(baseAtom)
                if ('head' in storage && storage.head !== ext) {
                  draft.redos = []
                  draft.undos = []
                }
                draft.startHead = ext as Draft<T>
                draft.head = draft.startHead
              }
              draft.level += 1
            })),
          )
          break

        case 'undo':
          {
            const base = get(baseAtom)
            if (storage.level !== 0) throw new Error('Cannot undo in transaction!')
            if (storage.undos.length === 0) throw new Error('Cannot undo since there is no undo history!')
            if (storage.head !== base) throw new Error('Cannot undo since head changed!')
            if (!('head' in storage)) throw new Error("Cannot undo since head doesn't exist!")
            const patches = storage.undos[storage.undos.length - 1]
            const patched = applyPatches(base, patches.inversePatches)
            set(baseAtom, patched)
            set(
              txStorageAtom,
              (storage = produce(storage, (draft) => {
                draft.head = get(baseAtom) as Draft<T>
                draft.undos.pop()
                draft.redos.splice(0, 0, patches)
              })),
            )
          }
          break
        case 'redo':
          {
            const base = get(baseAtom)
            if (storage.level !== 0) throw new Error('Cannot redo in transaction!')
            if (storage.redos.length === 0) throw new Error('Cannot redo since there is no redo history!')
            if (storage.head !== base) throw new Error('Cannot redo since head changed!')
            if (!('head' in storage)) throw new Error("Cannot redo since head doesn't exist!")
            const patches = storage.redos[0]
            const patched = applyPatches(base, patches.directPatches)
            set(baseAtom, patched)
            set(
              txStorageAtom,
              (storage = produce(storage, (draft) => {
                draft.head = get(baseAtom) as Draft<T>
                draft.redos.shift()
                draft.undos.push(patches)
              })),
            )
          }
          break
      }
      return get(txStorageAtom)
    },
  )

  const dataAtom = atom<T, TxDataAction<T>, void>(
    (get) => {
      const data = get(txStorageAtom)
      if ('head' in data) return data.head!
      return get(baseAtom)
    },
    (get, set, ...action: TxDataAction<T>) => {
      switch (action[0]) {
        case 'modify': {
          const level = get(txAtom).level
          if (level === 0) {
            set(txAtom, 'begin')
          }
          try {
            const base = get(dataAtom)
            const [result, directPatches, inversePatches] = produceWithPatches(base, action[1])
            set(txAtom, 'update', result, directPatches, inversePatches)
          } finally {
            if (level === 0) {
              set(txAtom, 'commit')
            }
          }
          break
        }

        case 'transact': {
          set(txAtom, 'begin')
          try {
            action[1]()
          } finally {
            set(txAtom, 'commit')
          }
          break
        }

        case 'undo': {
          set(txAtom, 'undo')
          break
        }

        case 'redo': {
          set(txAtom, 'redo')
          break
        }
      }
    },
  )

  const undoCounterAtom = atom((get) => {
    const storage = get(txStorageAtom)
    const base = get(baseAtom)
    if (!('head' in storage)) return 0
    if (storage.head !== base) return 0
    return storage.undos.length
  })

  const redoCounterAtom = atom((get) => {
    const storage = get(txStorageAtom)
    const base = get(baseAtom)
    if (!('head' in storage)) return 0
    if (storage.head !== base) return 0
    return storage.redos.length
  })

  return { dataAtom, undoCounterAtom, redoCounterAtom }
}
