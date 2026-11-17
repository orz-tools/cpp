import { Atom, atom, createStore, useAtomValue } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { useAtoms, useGameAdapter, useGameDataMemo } from '../../Cpp'
import type { ArknightsAdapter } from '../../pkg/cpp-arknights/GameAdapter'
import { Board, MissionNames, MissionScope, buildBoard, missionScopes } from '../../pkg/cpp-arknights/moduleMissions'
import type { Arknights } from '../../pkg/cpp-arknights/types'
import type { UserData, UserDataAtomHolder } from '../../pkg/cpp-core/UserData'

/** 只要用户数据：测试里不用整个 Cpp */
interface UserDataHost {
  store: ReturnType<typeof createStore>
  atoms: UserDataAtomHolder<Arknights>
}

/** 一次调用是一步撤销 */
export function setMissionsDone(cpp: UserDataHost, ids: readonly string[], done: boolean) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (d) => {
    if (done) {
      for (const id of ids) if (!d.doneMissions.includes(id)) d.doneMissions.push(id)
    } else {
      d.doneMissions = d.doneMissions.filter((x) => !ids.includes(x))
    }
  })
}

/**
 * 「打完了」：把还没标的标上，返回这次真正加进去的 id。提示里的「撤销」只拿掉这些，而不是全局撤销，
 * 这样中间改过别的也不会撤错。
 */
export function markRunDone(cpp: UserDataHost, ids: readonly string[]): string[] {
  const before = new Set(cpp.store.get(cpp.atoms.atoms.dataAtom).doneMissions)
  const added = ids.filter((x) => !before.has(x))
  if (added.length > 0) setMissionsDone(cpp, added, true)
  return added
}

export interface MissionPrefs {
  scope: MissionScope
  /** 空的时候不按星级筛 */
  rarities: number[]
}

const defaultPrefs: MissionPrefs = { scope: 'plan', rarities: [] }

export function readMissionPrefs(stored: unknown): MissionPrefs {
  if (typeof stored !== 'object' || stored == null) return defaultPrefs
  const { scope, rarities } = stored as Partial<Record<keyof MissionPrefs, unknown>>
  if (!missionScopes.includes(scope as MissionScope)) return defaultPrefs
  if (!Array.isArray(rarities) || !rarities.every((x) => x === 4 || x === 5 || x === 6)) return defaultPrefs
  return { scope: scope as MissionScope, rarities }
}

// 和 cpp_sidebar 一样记在本机、不分档案
const missionPrefsStorageAtom = atomWithStorage<unknown>('cpp_module_missions', null, undefined, { getOnInit: true })

export const missionPrefsAtom = atom(
  (get) => readMissionPrefs(get(missionPrefsStorageAtom)),
  (_get, set, prefs: MissionPrefs) => set(missionPrefsStorageAtom, prefs),
)

// 每个档案有自己的 store，所以下面两个按档案分开；面板和大窗口共用
/** 选中的券的 key */
export const selectedTicketAtom = atom<string | null>(null)

export type MissionGroup = 'anyStage' | 'blocked' | 'used'
export const openGroupsAtom = atom<Partial<Record<MissionGroup, boolean>>>({})

const doneMissionsAtoms = new WeakMap<object, Atom<string[]>>()
const doneSets = new WeakMap<readonly string[], ReadonlySet<string>>()

/** 只订阅 doneMissions：任务栏每一行都用它，别的用户数据变了不重画 */
export function useDoneMissions(): ReadonlySet<string> {
  const { dataAtom } = useAtoms<Arknights>()
  let a = doneMissionsAtoms.get(dataAtom)
  if (!a) doneMissionsAtoms.set(dataAtom, (a = selectAtom(dataAtom, (d: UserData<Arknights>) => d.doneMissions)))
  const list = useAtomValue(a)
  let set = doneSets.get(list)
  if (!set) doneSets.set(list, (set = new Set(list)))
  return set
}

export function useMissionBoard(): Board {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const data = useAtomValue(useAtoms<Arknights>().dataAtom)
  const prefs = useAtomValue(missionPrefsAtom)
  return buildBoard({
    catalog: ga.getMissionCatalog(),
    current: data.current,
    goal: data.goal,
    doneMissions: data.doneMissions,
    goalOrder: data.goalOrder,
    scope: prefs.scope,
    rarities: prefs.rarities,
  })
}

export function useMissionNames(): MissionNames {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  return useGameDataMemo(
    () => ({
      character: (charId: string) => ga.getCharacter(charId)?.name ?? charId,
      enemy: (id: string) => ga.getEnemy(id)?.name,
      skill: (id: string) => ga.getDataManager().data.skills[id]?.name,
    }),
    [ga],
  )
}
