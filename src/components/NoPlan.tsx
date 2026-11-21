import { IconName, NonIdealState } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import React, { memo, useMemo } from 'react'
import { useAtoms } from '../Cpp'
import { gt } from '../pkg/gt'
import { useCoarsePointer } from './phoneLayout'

export function useHasPlan(): boolean {
  const atoms = useAtoms()
  return useAtomValue(useMemo(() => selectAtom(atoms.dataAtom, (data) => Object.keys(data.goal).length > 0), [atoms]))
}

/** Stands in for a list the plan fills while no operator has a goal, and says how to give one a goal */
export const NoPlanState = memo(({ icon, action }: { icon: IconName; action?: React.JSX.Element }) => {
  const coarse = useCoarsePointer()
  return (
    <NonIdealState
      className="cpp-no-plan"
      icon={icon}
      title={gt.gettext('还没有计划')}
      description={
        coarse
          ? gt.gettext('长按干员，选「拉满计划」；或者点开干员，在「练度」页设定培养目标。')
          : gt.gettext('右键点干员，选「拉满计划」；或者点开干员，在「练度」页设定培养目标。')
      }
      action={action}
    />
  )
})
