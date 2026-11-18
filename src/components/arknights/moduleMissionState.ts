import { Atom, atom, createStore, useAtomValue } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { useAtoms, useGameAdapter, useGameDataMemo } from '../../Cpp'
import type { ArknightsAdapter } from '../../pkg/cpp-arknights/GameAdapter'
import {
  Board,
  BoardInput,
  CandidateSort,
  EMPTY_HELD,
  MissionNames,
  MissionScope,
  TagAlongRef,
  TagAlongs,
  buildBoard,
  missionScopes,
} from '../../pkg/cpp-arknights/moduleMissions'
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

/** 任务勾选框：改这一条，并让它留在原处，券不因此重新分组 */
export function toggleMission(cpp: UserDataHost, id: string, done: boolean) {
  setMissionsDone(cpp, [id], done)
  const held = cpp.store.get(heldMissionsAtom)
  if (!held.has(id)) cpp.store.set(heldMissionsAtom, new Set([...held, id]))
}

/** 「打完了」那几个按钮：这张券上的不再留在原处 */
export function releaseMissions(cpp: UserDataHost, ids: readonly string[]) {
  const held = cpp.store.get(heldMissionsAtom)
  if (ids.some((x) => held.has(x))) cpp.store.set(heldMissionsAtom, new Set([...held].filter((x) => !ids.includes(x))))
}

/** 「整理」：都不再留在原处，重新分组 */
export function tidyMissions(cpp: UserDataHost) {
  cpp.store.set(heldMissionsAtom, EMPTY_HELD)
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

// 每个档案有自己的 store，所以下面几个按档案分开；面板、大窗口和档案共用
/** 留在原处的任务，见 BoardInput.held。不存盘：刷新、换档案都会整理 */
export const heldMissionsAtom = atom<ReadonlySet<string>>(EMPTY_HELD)

/** 换范围、按星级按钮都会整理 */
export const missionPrefsAtom = atom(
  (get) => readMissionPrefs(get(missionPrefsStorageAtom)),
  (_get, set, prefs: MissionPrefs) => {
    set(missionPrefsStorageAtom, prefs)
    set(heldMissionsAtom, EMPTY_HELD)
  },
)

/** 选中的券的 key */
export const selectedTicketAtom = atom<string | null>(null)

/** 选中的券上带上的人，见 BoardInput.tagAlongs。不存盘，选别的券就清空 */
export const tagAlongsAtom = atom<TagAlongs | null>(null)

/** 候选弹窗的排序，记到刷新为止 */
export const candidateSortAtom = atom<CandidateSort>('recommended')

type StoreHost = Pick<UserDataHost, 'store'>

/** 记的是别的券时，换成这张券的；同一名干员（任何形态）已经带上时不加 */
export function addTagAlong(cpp: StoreHost, ticket: string, ref: TagAlongRef) {
  const cur = cpp.store.get(tagAlongsAtom)
  const chars = cur?.ticket === ticket ? cur.chars : []
  if (chars.some((x) => x.charId === ref.charId)) return
  cpp.store.set(tagAlongsAtom, { ticket, chars: [...chars, ref] })
}

/** 拿空了是 null */
export function dropTagAlong(cpp: StoreHost, ticket: string, charId: string) {
  const cur = cpp.store.get(tagAlongsAtom)
  if (cur?.ticket !== ticket || !cur.chars.some((x) => x.charId === charId)) return
  const chars = cur.chars.filter((x) => x.charId !== charId)
  cpp.store.set(tagAlongsAtom, chars.length > 0 ? { ticket, chars } : null)
}

/** 选了 key 这张券（null 是取消选中）：不是带人的那张就清空 */
export function keepTagAlongsFor(cpp: StoreHost, key: string | null) {
  const cur = cpp.store.get(tagAlongsAtom)
  if (cur && cur.ticket !== key) cpp.store.set(tagAlongsAtom, null)
}

/** 改记到 key 上，只留 refs；refs 空了就清空 */
export function moveTagAlongs(cpp: StoreHost, key: string, refs: readonly TagAlongRef[]) {
  cpp.store.set(tagAlongsAtom, refs.length > 0 ? { ticket: key, chars: refs } : null)
}

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

export function useBoardInput(): BoardInput {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const data = useAtomValue(useAtoms<Arknights>().dataAtom)
  const prefs = useAtomValue(missionPrefsAtom)
  const held = useAtomValue(heldMissionsAtom)
  const tagAlongs = useAtomValue(tagAlongsAtom)
  return {
    catalog: ga.getMissionCatalog(),
    current: data.current,
    goal: data.goal,
    doneMissions: data.doneMissions,
    goalOrder: data.goalOrder,
    scope: prefs.scope,
    rarities: prefs.rarities,
    held,
    tagAlongs,
  }
}

export function useMissionBoard(): Board {
  return buildBoard(useBoardInput())
}

/** 整理以后还剩几次；没有要整理的时候是 null，不去算 */
export function useRunsAfterTidy(board: Board): number | null {
  const input = useBoardInput()
  return board.stale > 0 ? buildBoard({ ...input, held: EMPTY_HELD }).stats.runs : null
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
