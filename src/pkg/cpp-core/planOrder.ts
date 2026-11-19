export type MoveTarget = { before: string } | { after: string }

export type MoveStep = 'first' | 'up' | 'down' | 'last'

/**
 * 选中的几项按它们在 order 里的先后收拢成一串，插到锚点前后；不连着的也收拢。
 * 不用挪时返回传入的那个数组本身，调用方按引用判断要不要写数据
 */
export function moveKeys(order: readonly string[], keys: readonly string[], target: MoveTarget): readonly string[] {
  const moving = new Set(keys)
  const anchor = 'before' in target ? target.before : target.after
  if (moving.has(anchor) || !order.includes(anchor)) return order
  const picked = order.filter((x) => moving.has(x))
  if (picked.length === 0) return order
  const rest = order.filter((x) => !moving.has(x))
  const at = rest.indexOf(anchor) + ('before' in target ? 0 : 1)
  const next = [...rest.slice(0, at), ...picked, ...rest.slice(at)]
  return next.every((x, i) => x === order[i]) ? order : next
}

/** 上移、下移按收拢算：选中的一串挪到第一项前面（最后一项后面）那名没选中的旁边，和拖动同一个规矩 */
export function stepTarget(order: readonly string[], keys: readonly string[], step: MoveStep): MoveTarget | undefined {
  const moving = new Set(keys)
  const rest = order.filter((x) => !moving.has(x))
  if (rest.length === 0 || rest.length === order.length) return undefined
  const first: MoveTarget = { before: rest[0] }
  const last: MoveTarget = { after: rest[rest.length - 1] }
  const target = (() => {
    switch (step) {
      case 'first':
        return first
      case 'last':
        return last
      case 'up': {
        const i = order.findIndex((x) => moving.has(x))
        return i > 0 ? { before: order[i - 1] } : first
      }
      case 'down': {
        const i = order.findLastIndex((x) => moving.has(x))
        return i < order.length - 1 ? { after: order[i + 1] } : last
      }
    }
  })()
  return moveKeys(order, keys, target) === order ? undefined : target
}

/**
 * 只重排 order 里有的项，各自填回这些项原来占的那几格；其余的项留在原位，所以列表里多出来、还没刷新掉的行不会跳。
 * 结果和输入一样时返回输入本身
 */
export function followOrder<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  order: readonly string[],
): readonly T[] {
  const rank = new Map(order.map((x, i) => [x, i]))
  const ranked = items.filter((x) => rank.has(keyOf(x)))
  const sorted = [...ranked].sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!)
  if (sorted.every((x, i) => x === ranked[i])) return items
  let next = 0
  return items.map((x) => (rank.has(keyOf(x)) ? sorted[next++] : x))
}
