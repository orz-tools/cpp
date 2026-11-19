// A shell component on IUserDataAdapter's generic calls alone, so any game's editor and menus can carry it.
import { Button, MenuDivider, MenuItem } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { memo, useMemo } from 'react'
import { useAtoms, useStore } from '../Cpp'
import { IGame } from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'

export function useCharacterPlanActions(charId: string) {
  const atoms = useAtoms<IGame>()
  const store = useStore<IGame>()
  const hidden = useAtomValue(atoms.isCharacterFinished(charId))
  const canMax = !useAtomValue(atoms.goalMaxed(charId))
  // Re-renders only when this operator enters or leaves the plan, not on every other operator's goal change.
  const plannedAtom = useMemo(() => selectAtom(atoms.goalCharacters, (x) => charId in x), [atoms, charId])
  const canClear = useAtomValue(plannedAtom)
  return {
    hidden,
    canMax,
    canClear,
    max: () => store.set(atoms.maxGoals, [charId]),
    clear: () => store.set(atoms.clearGoals, [charId]),
  }
}

export const CharacterPlanMenuItems = memo(({ charId }: { charId: string }) => {
  const { hidden, canMax, canClear, max, clear } = useCharacterPlanActions(charId)
  if (hidden) return null
  return (
    <>
      <MenuItem icon="maximize" text={gt.pgettext('plan action', '拉满计划')} disabled={!canMax} onClick={max} />
      <MenuItem icon="eraser" text={gt.pgettext('plan action', '清空计划')} disabled={!canClear} onClick={clear} />
      <MenuDivider />
    </>
  )
})

export const CharacterPlanButtons = memo(({ charId, compact }: { charId: string; compact?: boolean }) => {
  const { hidden, canMax, canClear, max, clear } = useCharacterPlanActions(charId)
  if (hidden) return null
  const maxText = gt.pgettext('plan action', '拉满')
  const clearText = gt.pgettext('plan action', '清空')
  return (
    <div className="cpp-plan-buttons">
      <Button
        size="small"
        variant="minimal"
        icon="maximize"
        text={compact ? undefined : maxText}
        aria-label={compact ? maxText : undefined}
        title={gt.pgettext('plan action', '把培养目标拉满')}
        disabled={!canMax}
        onClick={max}
      />
      <Button
        size="small"
        variant="minimal"
        icon="eraser"
        text={compact ? undefined : clearText}
        aria-label={compact ? clearText : undefined}
        title={gt.pgettext('plan action', '清空计划：培养目标改回当前状态')}
        disabled={!canClear}
        onClick={clear}
      />
    </div>
  )
})
