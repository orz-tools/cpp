import type { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import type { PrtsSkinsData } from './prtsSkins'

// The four regions are generated from one schema; containers stored before the worker published skins lack these
export type ExSkin = Pick<CppData_ArknightsKengxxiaoZhCn['exSkin'], 'buildinEvolveMap' | 'buildinPatchMap'> &
  Partial<Pick<CppData_ArknightsKengxxiaoZhCn['exSkin'], 'charSkins' | 'brandList'>>
export type ExShop = CppData_ArknightsKengxxiaoZhCn['exShop']

export const DAY = 86400_000

/** 对不上品牌的时装归到这一组，排在最后 */
export const OTHER_BRAND = '#other'

export type SkinChannel = PrtsSkinsData['skins']['']['windows'][0]['channel']
export type SkinWindowKind = 'first' | 'rerun' | 'retro'

export interface Skin {
  id: string
  charId: string
  /** 多形态干员（阿米娅）的时装属于哪个形态；属于基础形态时是 null */
  tmplId: string | null
  name: string
  groupId: string | null
  groupName: string
  brandId: string
  sortId: number
  /** 上线时间，毫秒 */
  releasedAt: number
  /** 途径含「采购中心」：按系列名的商店页签只算这些 */
  inStore: boolean
  /** 能用时装自选凭证兑换的那类时装：途径含「采购中心」，没有动态立绘，不是联动 */
  voucherType: boolean
}

export interface SkinBrand {
  id: string
  name: string
  capitalName: string | null
  sortId: number
  /** 按上线时间排 */
  skins: Skin[]
}

export interface SkinCatalog {
  /** 按品牌、再按上线时间排 */
  skins: Skin[]
  byId: ReadonlyMap<string, Skin>
  /** 按上线时间排 */
  byChar: ReadonlyMap<string, Skin[]>
  byGroupName: ReadonlyMap<string, Skin[]>
  brands: SkinBrand[]
}

const bySale = (a: Skin, b: Skin) => a.releasedAt - b.releasedAt || a.sortId - b.sortId

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

/**
 * base: zh_CN's table; local: the region's own, or null in zh_CN. The region's own lists the skins it has, in its
 * language. Whether a skin is the voucher kind is read from zh_CN by id, since the rule is written against its texts.
 */
export function buildSkinCatalog({ base, local }: { base: ExSkin; local: ExSkin | null }): SkinCatalog {
  const own = local ?? base
  const baseSkins = base.charSkins ?? {}
  const brandOfGroup = new Map<string, string>()
  const brands = Object.values(own.brandList ?? {})
    .sort((a, b) => a.sortId - b.sortId)
    .map((b): SkinBrand => {
      for (const g of b.groupList) brandOfGroup.set(g.skinGroupId, b.brandId)
      return { id: b.brandId, name: b.brandName, capitalName: b.brandCapitalName, sortId: b.sortId, skins: [] }
    })
  const other: SkinBrand = { id: OTHER_BRAND, name: '', capitalName: null, sortId: Infinity, skins: [] }

  const byId = new Map<string, Skin>()
  const byChar = new Map<string, Skin[]>()
  const byGroupName = new Map<string, Skin[]>()
  const brandById = new Map(brands.map((b) => [b.id, b]))
  for (const raw of Object.values(own.charSkins ?? {})) {
    const d = raw.displaySkin
    const zh = Object.hasOwn(baseSkins, raw.skinId) ? baseSkins[raw.skinId] : raw
    const approach = zh.displaySkin.obtainApproach ?? ''
    const inStore = approach.includes('采购中心')
    const brand = (d.skinGroupId && brandById.get(brandOfGroup.get(d.skinGroupId) ?? '')) || other
    const skin: Skin = {
      id: raw.skinId,
      charId: raw.charId,
      tmplId: raw.tmplId,
      name: d.skinName ?? raw.skinId,
      groupId: d.skinGroupId,
      groupName: d.skinGroupName ?? '',
      brandId: brand.id,
      sortId: d.sortId,
      releasedAt: d.getTime * 1000,
      inStore,
      voucherType: inStore && !zh.dynIllust && zh.displaySkin.displayTagId !== '联动获得',
    }
    byId.set(skin.id, skin)
    brand.skins.push(skin)
    push(byChar, skin.charId, skin)
    push(byGroupName, skin.groupName, skin)
  }

  const all = [...brands, other].filter((b) => b.skins.length > 0)
  for (const b of all) b.skins.sort(bySale)
  for (const list of byChar.values()) list.sort(bySale)
  return { skins: all.flatMap((b) => b.skins), byId, byChar, byGroupName, brands: all }
}

export interface DefaultSkin {
  id: string
  /** 精英化阶段的默认立绘；形态的默认立绘是 null */
  elite: number | null
  /** 多形态干员另一个形态的默认立绘 */
  tmplId: string | null
}

/** 精英零、（和精英零不同时的）精英一、精英二，再加上阿米娅另外几个形态的 */
export function defaultSkins(exSkin: ExSkin, charId: string): DefaultSkin[] {
  const result: DefaultSkin[] = []
  const seen = new Set<string>()
  const evolve = exSkin.buildinEvolveMap[charId] ?? {}
  for (const phase of Object.keys(evolve).sort()) {
    const id = evolve[phase]
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ id, elite: Number(phase), tmplId: null })
  }
  for (const [tmplId, id] of Object.entries(exSkin.buildinPatchMap[charId] ?? {})) {
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ id, elite: null, tmplId })
  }
  return result
}

export interface SkinWindow {
  skinId: string
  kind: SkinWindowKind
  /** 第几次复刻或风尚回顾；首发和不知道第几次的是 0 */
  n: number
  channel: SkinChannel
  /** 毫秒 */
  start: number
  /** 毫秒；常驻的是 null */
  end: number | null
  price: string | null
  unit: string | null
}

const sameWindow = (a: SkinWindow, b: SkinWindow) =>
  a.skinId === b.skinId && a.channel === b.channel && Math.abs(a.start - b.start) < DAY

/**
 * The skin store's sales the game data announces, often days before they open. A tab names its skins, or is titled
 * after the series it sells (its store-bought skins); a tab titled after a brand or 罗德岛风尚回顾 names no skins and
 * matches no series, so it counts for nothing.
 */
export function shopWindowsFromGame(exShop: ExShop, catalog: SkinCatalog): SkinWindow[] {
  const result: SkinWindow[] = []
  const bySkin = new Map<string, SkinWindow[]>()
  const add = (skinId: string, start: number, end: number, goodId: string | null) => {
    if (start <= 0 || end <= 0 || end < start) return
    const skin = catalog.byId.get(skinId)
    if (!skin) return
    const w: SkinWindow = {
      skinId,
      kind: 'first',
      n: 0,
      channel: 'shop',
      start: start * 1000,
      end: end * 1000,
      price: null,
      unit: null,
    }
    const rerun = goodId?.match(/_r(\d+)$/)
    if (rerun) {
      w.kind = 'rerun'
      w.n = Number(rerun[1])
    } else if (Math.abs(w.start - skin.releasedAt) >= DAY) {
      w.kind = 'rerun'
    }
    // A carousel slot repeats the tab selling the same skin
    if (bySkin.get(skinId)?.some((x) => sameWindow(x, w))) return
    push(bySkin, skinId, w)
    result.push(w)
  }
  for (const tab of exShop.recommendList) {
    if (tab.skins.length > 0) {
      for (const s of tab.skins) add(s.skinId, tab.startDatetime, tab.endDatetime, s.goodId)
    } else {
      for (const skin of catalog.byGroupName.get(tab.tagName) ?? []) {
        if (skin.inStore) add(skin.id, tab.startDatetime, tab.endDatetime, null)
      }
    }
  }
  for (const c of exShop.carousels) add(c.skinId, c.startTime, c.endTime, null)
  return result
}

export function windowsFromPrts(data: PrtsSkinsData): SkinWindow[] {
  return Object.entries(data.skins).flatMap(([skinId, s]) =>
    s.windows.map((w): SkinWindow => ({
      skinId,
      kind: w.kind,
      n: w.n,
      channel: w.channel,
      start: w.start * 1000,
      end: w.end == null ? null : w.end * 1000,
      price: w.price,
      unit: w.unit,
    })),
  )
}

/**
 * A PRTS window and a game one of the same skin and channel that open within a day are one sale. PRTS knows its kind
 * and price; the game data its exact times, PRTS rounding the end down to the minute.
 */
export function mergeWindows(game: readonly SkinWindow[], prts: readonly SkinWindow[]): SkinWindow[] {
  const gameBySkin = new Map<string, SkinWindow[]>()
  for (const g of game) push(gameBySkin, g.skinId, g)
  const used = new Set<SkinWindow>()
  const result: SkinWindow[] = []
  for (const p of prts) {
    const g = gameBySkin.get(p.skinId)?.find((x) => !used.has(x) && sameWindow(x, p))
    if (g) used.add(g)
    result.push(g ? { ...p, start: g.start, end: g.end } : p)
  }
  for (const g of game) if (!used.has(g)) result.push(g)
  return result.sort((a, b) => a.start - b.start)
}

export function groupWindows(windows: readonly SkinWindow[]): Map<string, SkinWindow[]> {
  const map = new Map<string, SkinWindow[]>()
  for (const w of windows) push(map, w.skinId, w)
  return map
}

export function isAvailable(w: SkinWindow, now: number) {
  return w.start <= now && (w.end == null || now <= w.end)
}

export function availableWindows(windows: readonly SkinWindow[], now: number) {
  return windows.filter((w) => isAvailable(w, now))
}

/** 时装自选凭证只能换当期时装商店在售的（风尚回顾也在时装商店卖），而且只换那一类 */
export function canUseVoucher(skin: Skin, windows: readonly SkinWindow[], owned: boolean, now: number) {
  return (
    !owned &&
    skin.voucherType &&
    windows.some((w) => (w.channel === 'shop' || w.channel === 'retro') && isAvailable(w, now))
  )
}

/** 档期图上的一行：新装、复刻、风尚回顾，其余有截止的都算活动 */
export type PeriodLane = 'first' | 'rerun' | 'retro' | 'event'

export interface SkinPeriod {
  /** channel:lane:start:end；常驻的是 channel:open */
  key: string
  channel: SkinChannel
  /** 常驻的是 null */
  lane: PeriodLane | null
  start: number
  end: number | null
  skinIds: string[]
  /** 每件在这一期的档期，读价格用 */
  windows: Map<string, SkinWindow>
}

export function periodLane(w: SkinWindow): PeriodLane | null {
  if (w.end == null) return null
  if (w.channel === 'shop') return w.kind === 'first' ? 'first' : 'rerun'
  if (w.channel === 'retro') return 'retro'
  return 'event'
}

/**
 * The windows of one channel and lane with the same start and end are one sale; each permanent channel is one group,
 * of the skins it already offers.
 */
export function periodsOf(windowsBySkin: ReadonlyMap<string, readonly SkinWindow[]>, now: number): SkinPeriod[] {
  const periods = new Map<string, SkinPeriod>()
  for (const [skinId, windows] of windowsBySkin) {
    for (const w of windows) {
      const lane = periodLane(w)
      if (lane == null && w.start > now) continue
      const key = lane == null ? `${w.channel}:open` : `${w.channel}:${lane}:${w.start}:${w.end}`
      let p = periods.get(key)
      if (!p)
        periods.set(
          key,
          (p = { key, channel: w.channel, lane, start: w.start, end: w.end, skinIds: [], windows: new Map() }),
        )
      if (p.windows.has(skinId)) continue
      p.start = Math.min(p.start, w.start)
      p.skinIds.push(skinId)
      p.windows.set(skinId, w)
    }
  }
  return [...periods.values()].sort((a, b) => a.start - b.start || b.skinIds.length - a.skinIds.length)
}

/** Greedy interval packing: each period goes into the first row whose last one ended more than gap before it starts */
export function packLanes<T extends { start: number; end: number }>(periods: readonly T[], gap = 0) {
  const rowEnds: number[] = []
  const placed = [...periods]
    .sort((a, b) => a.start - b.start)
    .map((period) => {
      let row = rowEnds.findIndex((end) => end + gap < period.start)
      if (row < 0) row = rowEnds.push(0) - 1
      rowEnds[row] = period.end
      return { period, row }
    })
  return { rows: rowEnds.length, placed }
}

export function matchesQuery(
  skin: Skin,
  character: { name: string; appellation: string } | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [skin.name, skin.groupName, character?.name, character?.appellation].some(
    (x) => x != null && x.toLowerCase().includes(q),
  )
}

/** 森空岛给的是这个账号的全部时装：整个换掉，手动标了、森空岛没有的也去掉 */
export function replaceSkins(draft: { skins?: Record<string, number> }, list: readonly { id: string; ts: number }[]) {
  const before = draft.skins ?? {}
  const next: Record<string, number> = {}
  for (const { id, ts } of list) if (id.includes('@')) next[id] = ts
  const added = Object.keys(next).filter((id) => !Object.hasOwn(before, id)).length
  const removed = Object.keys(before).filter((id) => !Object.hasOwn(next, id)).length
  draft.skins = next
  return { added, removed }
}

/** 标成已有时，已经有的保留获得时间，没有的记 0；取消就删掉 */
export function setSkinsOwned(draft: { skins: Record<string, number> }, ids: readonly string[], owned: boolean) {
  for (const id of ids) {
    if (owned) {
      if (!Object.hasOwn(draft.skins, id)) draft.skins[id] = 0
    } else {
      delete draft.skins[id]
    }
  }
}
