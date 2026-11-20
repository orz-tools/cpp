import type { Character } from '../../pkg/cpp-arknights'

export type ModuleSlot = Character['uniEquips'][number] | undefined

/** 精英化以后才能解锁的那些；初始模组不算 */
export function unlockedUniEquips(character: Pick<Character, 'uniEquips'>): Character['uniEquips'] {
  return character.uniEquips.filter((x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0')
}

/** 模组那几格，从左到右；undefined 是空着的一格 */
export function moduleSlots(character: Pick<Character, 'uniEquips'>): ModuleSlot[] {
  const uniEquips = unlockedUniEquips(character)
  const uniX = uniEquips.find((x) => x.equip.raw.typeName2?.toUpperCase() === 'X')
  const uniY = uniEquips.find((x) => x.equip.raw.typeName2?.toUpperCase() === 'Y')
  const rest = uniEquips.filter((x) => x !== uniX && x !== uniY)

  // X and Y keep their own columns so they line up across the list; every other branch (D, A, B, ...)
  // goes into a third, narrower column, and only borrows an empty X/Y slot when one column is not enough.
  const slots: ModuleSlot[] = [uniX, uniY]
  if (rest.length) slots.push(undefined)
  for (let i = slots.length - 1; i >= 0 && rest.length; i--) {
    if (!slots[i]) slots[i] = rest.pop()
  }
  slots.push(...rest)
  return slots
}
