import { IconName, NonIdealState } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import React, { memo, useMemo } from 'react'
import { useAtoms } from '../Cpp'
import { gt } from '../pkg/gt'

export function useHasPlan(): boolean {
  const atoms = useAtoms()
  return useAtomValue(useMemo(() => selectAtom(atoms.dataAtom, (data) => Object.keys(data.goal).length > 0), [atoms]))
}

/** Stands in for a list the plan fills while no operator has a goal, and says how to give one a goal */
export const NoPlanState = memo(({ icon, action }: { icon: IconName; action?: React.JSX.Element }) => (
  <NonIdealState
    className="cpp-no-plan"
    icon={icon}
    title={gt.gettext('还没有计划')}
    description={gt.gettext('点击干员设定培养目标')}
    action={action}
  />
))
