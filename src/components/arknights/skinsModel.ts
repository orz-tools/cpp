import { Atom, atom, createStore, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter, useGameDataMemo } from '../../Cpp'
import type { ArknightsAdapter } from '../../pkg/cpp-arknights/GameAdapter'
import type { PrtsSkinsData } from '../../pkg/cpp-arknights/prtsSkins'
import {
  Skin,
  SkinCatalog,
  SkinPeriod,
  SkinWindow,
  availableWindows,
  canUseVoucher,
  groupWindows,
  matchesQuery,
  mergeWindows,
  periodsOf,
  setSkinsOwned,
  shopWindowsFromGame,
  windowsFromPrts,
} from '../../pkg/cpp-arknights/skins'
import type { Arknights, ArknightsCharacterStatus } from '../../pkg/cpp-arknights/types'
import type { UserData, UserDataAtomHolder } from '../../pkg/cpp-core/UserData'
import { useShowCharacterDossier } from '../dossierHooks'

/** 只要用户数据：测试里不用整个 Cpp */
interface UserDataHost {
  store: ReturnType<typeof createStore>
  atoms: UserDataAtomHolder<Arknights>
}

/** 一次调用是一步撤销 */
export function setSkinOwned(cpp: UserDataHost, ids: readonly string[], owned: boolean) {
  cpp.store.set(cpp.atoms.atoms.dataAtom, 'modify', (d) => setSkinsOwned(d, ids, owned))
}

export interface SkinPrefs {
  /** 档期那一块收起来了 */
  timelineCollapsed: boolean
}

const defaultPrefs: SkinPrefs = { timelineCollapsed: false }

export function readSkinPrefs(stored: unknown): SkinPrefs {
  if (typeof stored !== 'object' || stored == null) return defaultPrefs
  const { timelineCollapsed } = stored as Partial<Record<keyof SkinPrefs, unknown>>
  if (typeof timelineCollapsed !== 'boolean') return defaultPrefs
  return { timelineCollapsed }
}

// 和 cpp_sidebar 一样记在本机、不分档案
const skinPrefsStorageAtom = atomWithStorage<unknown>('cpp_skins', null, undefined, { getOnInit: true })

export const skinPrefsAtom = atom(
  (get) => readSkinPrefs(get(skinPrefsStorageAtom)),
  (_get, set, prefs: SkinPrefs) => set(skinPrefsStorageAtom, prefs),
)

// 每个档案有自己的 store，所以下面这些按档案分开；面板和大窗口共用，刷新后回到默认
export type OwnFilter = 'all' | 'missing' | 'owned'
export const skinOwnFilterAtom = atom<OwnFilter>('all')
export const skinQueryAtom = atom('')
/** 只留现在能用时装自选凭证换的 */
export const skinVoucherOnlyAtom = atom(false)
/** 只留有时装、没干员的 */
export const skinOrphanOnlyAtom = atom(false)
/** 选中的一期（SkinPeriod.key） */
export const selectedPeriodAtom = atom<string | null>(null)
export const openBrandsAtom = atom<Partial<Record<string, boolean>>>({})
/** 手动标记中：点时装是在已有和缺之间切换 */
export const markingAtom = atom(false)
export type WideSort = 'brand' | 'release' | 'acquired'
export const wideSortAtom = atom<WideSort>('brand')
/** 从侧栏点了一件时装：档案一节把它框出来；nonce 让同一件再点一次也重新滚过去 */
export const focusedSkinAtom = atom<{ skinId: string; nonce: number } | null>(null)

const ownedSkinsAtoms = new WeakMap<object, Atom<Record<string, number>>>()
const currentAtoms = new WeakMap<object, Atom<Record<string, ArknightsCharacterStatus>>>()

/** 只订阅 skins：别的用户数据变了不重画 */
export function useOwnedSkins(): Record<string, number> {
  const { dataAtom } = useAtoms<Arknights>()
  let a = ownedSkinsAtoms.get(dataAtom)
  if (!a) ownedSkinsAtoms.set(dataAtom, (a = selectAtom(dataAtom, (d: UserData<Arknights>) => d.skins)))
  return useAtomValue(a)
}

function useCurrentStatuses(): Record<string, ArknightsCharacterStatus> {
  const { dataAtom } = useAtoms<Arknights>()
  let a = currentAtoms.get(dataAtom)
  if (!a) currentAtoms.set(dataAtom, (a = selectAtom(dataAtom, (d: UserData<Arknights>) => d.current)))
  return useAtomValue(a)
}

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

/** 「重试」加一：每个用到 PRTS 数据的地方都重新要一次，下载器那边失败的已经忘掉了 */
const prtsAttemptAtom = atom(0)

export type PrtsStatus = 'none' | 'loading' | 'ok' | 'error'

/** 国服才下载；none 是这个区服没有 PRTS 的数据 */
export function usePrtsSkins(): { status: PrtsStatus; data: PrtsSkinsData | null; retry: () => void } {
  const ga = useArknights()
  const attempt = useAtomValue(prtsAttemptAtom)
  const setAttempt = useSetAtom(prtsAttemptAtom)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const promise = useGameDataMemo(() => ga.getDataManager().loadPrtsSkins(), [ga, attempt])
  const [result, setResult] = useState<{ promise: Promise<PrtsSkinsData>; data: PrtsSkinsData | null }>()
  useEffect(() => {
    if (!promise) return
    let alive = true
    promise.then(
      (data) => alive && setResult({ promise, data }),
      (e) => {
        console.error(e)
        if (alive) setResult({ promise, data: null })
      },
    )
    return () => {
      alive = false
    }
  }, [promise])
  const retry = useEvent(() => setAttempt((x) => x + 1))
  if (!promise) return { status: 'none', data: null, retry }
  if (result?.promise !== promise) return { status: 'loading', data: null, retry }
  return { status: result.data ? 'ok' : 'error', data: result.data, retry }
}

const MINUTE = 60_000

/** 按分钟走，「还剩几天」和哪一期在卖跟着变 */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / MINUTE) * MINUTE)
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / MINUTE) * MINUTE), MINUTE)
    return () => clearInterval(timer)
  }, [])
  return now
}

export interface SkinState {
  skin: Skin
  owned: boolean
  /** 获得时间（Unix 秒），不知道时是 0；没有时是 null */
  acquiredAt: number | null
  windows: SkinWindow[]
  /** 现在能拿的档期，时装商店、风尚回顾在前，再按截止先后 */
  available: SkinWindow[]
  /** 缺的时候能用时装自选凭证换 */
  voucher: boolean
  /** 已有，干员却没有 */
  orphan: boolean
}

export interface SkinModel {
  catalog: SkinCatalog
  now: number
  states: ReadonlyMap<string, SkinState>
  periods: SkinPeriod[]
  owned: number
  voucherCount: number
  orphanCount: number
  prts: { status: PrtsStatus; retry: () => void }
  /** 森空岛只有国服 */
  canImportSkland: boolean
}

const channelRank: Partial<Record<SkinWindow['channel'], number>> = { shop: 0, retro: 0, certificate: 1 }
const byWay = (a: SkinWindow, b: SkinWindow) =>
  (channelRank[a.channel] ?? 2) - (channelRank[b.channel] ?? 2) || (a.end ?? Infinity) - (b.end ?? Infinity)

const emptyShop = { recommendList: [], carousels: [] }

/** 目录、档期、拥有情况和现在的时刻拼在一起；面板、大窗口和档案一节只读这里算好的 */
export function useSkinModel(): SkinModel {
  const ga = useArknights()
  const prts = usePrtsSkins()
  const now = useNow()
  const ownedSkins = useOwnedSkins()
  const current = useCurrentStatuses()

  const game = useGameDataMemo(() => {
    const catalog = ga.getSkinCatalog()
    const raw = ga.getDataManager().raw
    // 每个区服的时装商店各卖各的
    const exShop = raw.local ? (raw.local.exShop ?? emptyShop) : raw.exShop
    return {
      catalog,
      windows: shopWindowsFromGame(exShop, catalog),
      canImportSkland: !raw.local,
      empty: ga.getUserDataAdapter().getFrozenEmptyCharacterStatus(),
    }
  }, [ga])

  const windowsBySkin = useMemo(() => {
    const merged = prts.data ? mergeWindows(game.windows, windowsFromPrts(prts.data)) : game.windows
    return groupWindows(merged.filter((w) => game.catalog.byId.has(w.skinId)))
  }, [game, prts.data])

  const periods = useMemo(() => periodsOf(windowsBySkin, now), [windowsBySkin, now])

  const states = useMemo(() => {
    const map = new Map<string, SkinState>()
    for (const skin of game.catalog.skins) {
      const windows = windowsBySkin.get(skin.id) ?? []
      const owned = Object.hasOwn(ownedSkins, skin.id)
      const character = ga.getCharacter(skin.charId)
      map.set(skin.id, {
        skin,
        owned,
        acquiredAt: owned ? ownedSkins[skin.id] : null,
        windows,
        available: availableWindows(windows, now).sort(byWay),
        voucher: canUseVoucher(skin, windows, owned, now),
        orphan:
          owned &&
          !!character &&
          ga.getUserDataAdapter().isAbsentCharacter(character, current[skin.charId] ?? game.empty),
      })
    }
    return map
  }, [ga, game, windowsBySkin, ownedSkins, current, now])

  return useMemo(() => {
    let owned = 0
    let voucherCount = 0
    let orphanCount = 0
    for (const s of states.values()) {
      if (s.owned) owned++
      if (s.voucher) voucherCount++
      if (s.orphan) orphanCount++
    }
    return {
      catalog: game.catalog,
      now,
      states,
      periods,
      owned,
      voucherCount,
      orphanCount,
      prts: { status: prts.status, retry: prts.retry },
      canImportSkland: game.canImportSkland,
    }
  }, [game, now, states, periods, prts.status, prts.retry])
}

/** 面板和大窗口共用的筛选：三档、两个开关、搜索，同时开时取交集 */
export function useSkinFilter(): (state: SkinState) => boolean {
  const ga = useArknights()
  const own = useAtomValue(skinOwnFilterAtom)
  const query = useAtomValue(skinQueryAtom)
  const voucherOnly = useAtomValue(skinVoucherOnlyAtom)
  const orphanOnly = useAtomValue(skinOrphanOnlyAtom)
  return useMemo(
    () => (s: SkinState) =>
      (own === 'all' || (own === 'owned') === s.owned) &&
      (!voucherOnly || s.voucher) &&
      (!orphanOnly || s.orphan) &&
      matchesQuery(s.skin, ga.getCharacter(s.skin.charId), query),
    [ga, own, query, voucherOnly, orphanOnly],
  )
}

/** 选中的一期；目录或档期变了、那一期不在了时是 null */
export function useSelectedPeriod(model: SkinModel): SkinPeriod | null {
  const key = useAtomValue(selectedPeriodAtom)
  return (key && model.periods.find((p) => p.key === key)) || null
}

let focusNonce = 0

/** 点一件时装：打开这名干员的档案，滚到「时装」一节，框出那一件 */
export function useShowSkin(): (skin: Skin) => void {
  const cpp = useCpp<Arknights>()
  const show = useShowCharacterDossier()
  return useEvent((skin: Skin) => {
    show(skin.charId)
    cpp.store.set(focusedSkinAtom, { skinId: skin.id, nonce: ++focusNonce })
  })
}

/** 标记中点一件：在已有和缺之间切换 */
export function useToggleSkinOwned(): (state: SkinState) => void {
  const cpp = useCpp<Arknights>()
  return useEvent((state: SkinState) => setSkinOwned(cpp, [state.skin.id], !state.owned))
}
