/** 高级资深干员：组合里有它，才会出 6★ */
export const TOP_OPERATOR_TAG = 11
/** 公招界面一次给出的词条数 */
export const RECRUIT_TAG_LIMIT = 5

export interface RecruitData {
  tags: { tagId: number; tagName: string }[]
  /** 按公招说明里的顺序 */
  pool: { charId: string; tags: number[] }[]
}

export type RecruitTagGroupName = 'qualification' | 'profession' | 'position' | 'ability'

// 这三组的词条 id 是游戏里定死的；其余的（以后新加的也是）都是能力
const fixedGroups: { group: RecruitTagGroupName; tags: number[] }[] = [
  { group: 'qualification', tags: [11, 14, 17, 28] },
  { group: 'profession', tags: [1, 2, 3, 4, 5, 6, 7, 8] },
  { group: 'position', tags: [9, 10] },
]
const fixedTags = new Set(fixedGroups.flatMap((x) => x.tags))

/** 选词区的分组，组内按顺序；数据里没有的词条不列，空组不列 */
export function recruitTagGroups(tags: RecruitData['tags']): { group: RecruitTagGroupName; tags: number[] }[] {
  const ids = new Set(tags.map((x) => x.tagId))
  const ability = [...ids].filter((id) => !fixedTags.has(id)).sort((a, b) => a - b)
  return [
    ...fixedGroups.map(({ group, tags }) => ({ group, tags: tags.filter((id) => ids.has(id)) })),
    { group: 'ability' as const, tags: ability },
  ].filter((x) => x.tags.length > 0)
}

/** 选词区里从头到尾的顺序，组合和标签上的词条都按它排 */
export function recruitTagOrder(tags: RecruitData['tags']): number[] {
  return recruitTagGroups(tags).flatMap((x) => x.tags)
}

export interface RecruitCombo {
  /** 按选词区的顺序 */
  tags: number[]
  /** 招募时限 9 小时的保底星级 */
  guarantee: number
  /** 星级从高到低，同星级按公招说明里的顺序 */
  charIds: string[]
}

/**
 * 所选词条每一种 1～3 个的组合能出的干员，没有干员的组合不列。保底高的在前，再是词条少的，再按选词区的顺序。
 * rarityOf 给 1–6，给 undefined 的干员跳过
 */
export function recruitCombos(
  selected: readonly number[],
  recruit: RecruitData,
  rarityOf: (charId: string) => number | undefined,
): RecruitCombo[] {
  const order = recruitTagOrder(recruit.tags)
  const rank = (id: number) => {
    const i = order.indexOf(id)
    return i < 0 ? order.length + id : i
  }
  const tags = [...new Set(selected)].sort((a, b) => rank(a) - rank(b))

  const subsets: number[][] = []
  const walk = (from: number, picked: number[]) => {
    if (picked.length > 0) subsets.push(picked)
    if (picked.length === 3) return
    for (let i = from; i < tags.length; i++) walk(i + 1, [...picked, tags[i]])
  }
  walk(0, [])

  const pool = recruit.pool.flatMap((x) => {
    const rarity = rarityOf(x.charId)
    return rarity === undefined ? [] : [{ ...x, rarity }]
  })

  const combos: RecruitCombo[] = []
  for (const subset of subsets) {
    const top = subset.includes(TOP_OPERATOR_TAG)
    // sort 是稳定的，同星级留在公招说明里的顺序
    const members = pool
      .filter((x) => (top || x.rarity < 6) && subset.every((id) => x.tags.includes(id)))
      .sort((a, b) => b.rarity - a.rarity)
    if (members.length === 0) continue
    const rarities = members.map((x) => x.rarity)
    const above2 = rarities.filter((x) => x >= 3)
    combos.push({
      tags: subset,
      guarantee: Math.min(...(above2.length > 0 ? above2 : rarities)),
      charIds: members.map((x) => x.charId),
    })
  }

  const byTags = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return rank(a[i]) - rank(b[i])
    return a.length - b.length
  }
  return combos.sort((a, b) => b.guarantee - a.guarantee || a.tags.length - b.tags.length || byTags(a.tags, b.tags))
}

const tagsByChar = new WeakMap<RecruitData, Map<string, number[]>>()

/** 这名干员在公招池里带着的词条；不在池里时是空的 */
export function recruitTagsOf(recruit: RecruitData, charId: string): number[] {
  let map = tagsByChar.get(recruit)
  if (!map) {
    map = new Map(recruit.pool.map((x) => [x.charId, x.tags]))
    tagsByChar.set(recruit, map)
  }
  return map.get(charId) ?? []
}
