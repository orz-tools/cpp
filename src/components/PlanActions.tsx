// A shell component on IUserDataAdapter's generic calls alone, so any game's editor and menus can carry it.
import { Button, MenuDivider, MenuItem } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { memo, useMemo } from 'react'
import { useAtoms, useStore } from '../Cpp'
import { IGame } from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'
import { AppToaster } from './Toaster'
import { requeryList, undoIfUnchanged } from './planBatch'

type Store = ReturnType<typeof useStore<IGame>>
type Atoms = ReturnType<typeof useAtoms<IGame>>

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
    max: () => {
      store.set(atoms.maxGoals, [charId])
      requeryList(store)
    },
    clear: () => {
      store.set(atoms.clearGoals, [charId])
      requeryList(store)
    },
  }
}

/**
 * The notice after a batch, with an undo. It goes away as soon as the user data changes again, so its 撤销 cannot take
 * back a later step; head is taken before the await, right after the write.
 */
function showPlanToast(store: Store, atoms: Pick<Atoms, 'dataAtom' | 'undoCounterAtom'>, message: string) {
  const head = store.get(atoms.dataAtom)
  void AppToaster.then((toaster) => {
    let unsub = () => {}
    const key = toaster.show({
      intent: 'success',
      icon: 'tick',
      message,
      action: {
        text: gt.gettext('撤销'),
        onClick: () => {
          if (undoIfUnchanged(store, atoms, head)) requeryList(store)
        },
      },
      onDismiss: () => unsub(),
    })
    const check = () => {
      if (store.get(atoms.dataAtom) !== head) toaster.dismiss(key)
    }
    unsub = store.sub(atoms.dataAtom, check)
    // The data may have changed while the toaster was awaited.
    check()
  })
}

/** charIds must keep its identity while it does not change: a new one makes a new atom. */
export function usePlanBatchActions(charIds: readonly string[]) {
  const atoms = useAtoms<IGame>()
  const store = useStore<IGame>()
  const targetsAtom = useMemo(() => atoms.planTargets(charIds), [atoms, charIds])
  const targets = useAtomValue(targetsAtom)
  return {
    hidden: targets.allFinished,
    canMax: targets.max.length > 0,
    canClear: targets.clear.length > 0,
    // Read again on the click: the targets drawn may be a render behind.
    max: () => {
      const { max } = store.get(targetsAtom)
      if (max.length === 0) return
      store.set(atoms.maxGoals, max)
      requeryList(store)
      showPlanToast(
        store,
        atoms,
        gt
          .ngettext('已拉满 %d 名干员的计划', '已拉满 %d 名干员的计划', max.length) /* I10N: %d: number */
          .replaceAll('%d', String(max.length)),
      )
    },
    clear: () => {
      const { clear } = store.get(targetsAtom)
      if (clear.length === 0) return
      store.set(atoms.clearGoals, clear)
      requeryList(store)
      showPlanToast(
        store,
        atoms,
        gt
          .ngettext('已清空 %d 名干员的计划', '已清空 %d 名干员的计划', clear.length) /* I10N: %d: number */
          .replaceAll('%d', String(clear.length)),
      )
    },
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

/** For a context menu on one of several selected operators: the items act on all of them. */
export const GroupPlanMenuItems = memo(({ charIds }: { charIds: readonly string[] }) => {
  const { hidden, canMax, canClear, max, clear } = usePlanBatchActions(charIds)
  if (hidden) return null
  const n = charIds.length
  return (
    <>
      <MenuItem
        icon="maximize"
        text={gt
          .ngettext('拉满 %d 名干员的计划', '拉满 %d 名干员的计划', n) /* I10N: %d: number */
          .replaceAll('%d', String(n))}
        disabled={!canMax}
        onClick={max}
      />
      <MenuItem
        icon="eraser"
        text={gt
          .ngettext('清空 %d 名干员的计划', '清空 %d 名干员的计划', n) /* I10N: %d: number */
          .replaceAll('%d', String(n))}
        disabled={!canClear}
        onClick={clear}
      />
      <MenuDivider />
    </>
  )
})

/** For a selection bar. Disabled rather than hidden when there is nothing to do: the bar keeps its layout. */
export const PlanBatchButtons = memo(({ charIds, compact }: { charIds: readonly string[]; compact?: boolean }) => {
  const { canMax, canClear, max, clear } = usePlanBatchActions(charIds)
  const maxText = gt.pgettext('plan action', '拉满计划')
  const clearText = gt.pgettext('plan action', '清空计划')
  return (
    <div className="cpp-plan-buttons">
      <Button
        size="small"
        variant="minimal"
        icon="maximize"
        text={compact ? undefined : maxText}
        aria-label={compact ? maxText : undefined}
        title={compact ? maxText : undefined}
        disabled={!canMax}
        onClick={max}
      />
      <Button
        size="small"
        variant="minimal"
        icon="eraser"
        text={compact ? undefined : clearText}
        aria-label={compact ? clearText : undefined}
        title={compact ? clearText : undefined}
        disabled={!canClear}
        onClick={clear}
      />
    </div>
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
