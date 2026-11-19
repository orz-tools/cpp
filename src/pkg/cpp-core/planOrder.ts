export type MoveTarget = { before: string } | { after: string }

export type MoveStep = 'first' | 'up' | 'down' | 'last'

/** 不用挪时返回传入的那个数组本身，调用方按引用判断要不要写数据 */
export function moveKey(order: readonly string[], key: string, target: MoveTarget): readonly string[] {
  const anchor = 'before' in target ? target.before : target.after
  if (key === anchor || !order.includes(key) || !order.includes(anchor)) return order
  const rest = order.filter((x) => x !== key)
  const at = rest.indexOf(anchor) + ('before' in target ? 0 : 1)
  const next = [...rest.slice(0, at), key, ...rest.slice(at)]
  return next.every((x, i) => x === order[i]) ? order : next
}

export function stepTarget(order: readonly string[], key: string, step: MoveStep): MoveTarget | undefined {
  const i = order.indexOf(key)
  if (i < 0) return undefined
  const last = order.length - 1
  switch (step) {
    case 'first':
      return i > 0 ? { before: order[0] } : undefined
    case 'up':
      return i > 0 ? { before: order[i - 1] } : undefined
    case 'down':
      return i < last ? { after: order[i + 1] } : undefined
    case 'last':
      return i < last ? { after: order[last] } : undefined
  }
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
