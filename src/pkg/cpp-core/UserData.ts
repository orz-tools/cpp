import produce, { Draft } from 'immer'
import { atom, PrimitiveAtom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { Constructor, Inject } from '../container'
import { txatom } from '../txatom'
import { DataManager } from './DataManager'

const UserDataAtoms = class UserDataAtoms {} as Constructor<ReturnType<typeof buildAtoms>> &
  ReturnType<typeof buildAtoms>

export class UserDataAtomHolder extends UserDataAtoms {
  dataManager = Inject(DataManager)
  rootAtom!: PrimitiveAtom<UserData>

  public setAtom(atom: PrimitiveAtom<UserData>) {
    this.rootAtom = atom
    Object.assign(this, buildAtoms(this.rootAtom, this.dataManager))
  }
}

const emptyCharacterStatus = Object.freeze<CharacterStatus>({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: Object.freeze({}),
  modLevel: Object.freeze({}),
})

function buildAtoms(rootAtom: PrimitiveAtom<UserData>, dm: DataManager) {
  const tx = txatom(rootAtom)
  const { dataAtom } = tx

  const unvalidatedCurrentCharacter = atomFamily(
    (charId: string) =>
      atom(
        (get) => get(dataAtom).current[charId] || emptyCharacterStatus,
        (get, set, value: (draft: Draft<CharacterStatus>) => any) => {
          set(dataAtom, 'modify', (data) => {
            data.current[charId] = produce(data.current[charId] || emptyCharacterStatus, value)
          })
        },
      ),
    (a, b) => a === b,
  )

  const unvalidatedGoalCharacter = atomFamily(
    (charId: string) =>
      atom(
        (get) => get(dataAtom).goal[charId] || emptyCharacterStatus,
        (get, set, value: (draft: Draft<CharacterStatus>) => any) => {
          set(dataAtom, 'modify', (data) => {
            data.goal[charId] = produce(data.goal[charId] || emptyCharacterStatus, value)
          })
        },
      ),
    (a, b) => a === b,
  )

  return {
    ...tx,
    unvalidatedCurrentCharacter,
    unvalidatedGoalCharacter,
  }
}

export interface UserData {
  current: Record<string, CharacterStatus>
  goal: Record<string, CharacterStatus>
}

export interface CharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
}

export interface CharacterLevel {
  elite: number
  level: number
}

export function newUserData(): UserData {
  return {
    current: {},
    goal: {},
  }
}
