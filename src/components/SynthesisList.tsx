import { Callout, Icon, Intent, MenuDivider, MenuItem, NonIdealState } from '@blueprintjs/core'
import React, { memo } from 'react'
import { Cpp, Level, useGameAdapter, useGameDataMemo } from '../Cpp'
import { IGame, IItem } from '../pkg/cpp-basic'
import { TaskStatus } from '../pkg/cpp-core/Task'
import { generateIndirects } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import type { FormulaUse } from './FarmList'
import { ItemIcon } from './Icons'
import { buildItemList } from './ItemList'
import { PeekTrigger } from './Peek'

export function planSynthesisList(cpp: Cpp<IGame>, target: Level, formulaUses: FormulaUse[]) {
  const ga = cpp.gameAdapter
  const atoms = cpp.atoms.atoms
  const store = cpp.store
  const inputQuantities = store.get(atoms.itemQuantities)
  const forbiddenFormulaTags = store.get(atoms.forbiddenFormulaTagsAtom)
  const tasks = store.get(
    {
      [Level.Star]: atoms.starredTasksWithExtra,
      [Level.Goal]: atoms.goalTasksWithExtra,
      [Level.Finished]: atoms.finishedTasksWithExtra,
    }[target],
  )

  const requirements: Record<string, number> = {}
  tasks
    .filter((x) => [TaskStatus.Completable, TaskStatus.Synthesizable].includes(x[1].status))
    .forEach((x) =>
      x[0].requires.forEach((cost) => {
        requirements[cost.itemId] = (requirements[cost.itemId] || 0) + cost.quantity
      }),
    )
  const indirectDetails = generateIndirects(
    ga,
    requirements,
    inputQuantities,
    forbiddenFormulaTags,
    Object.fromEntries(formulaUses.map((x) => [x.formulaId, x.times])),
  )

  return { inputQuantities, indirectDetails }
}

export const SynthesisList = memo(({ data }: { data: ReturnType<typeof planSynthesisList> }) => {
  const ga = useGameAdapter()
  const itemGroups = useGameDataMemo(() => buildItemList(ga), [ga])
  const { indirectDetails, inputQuantities } = data
  const categoryNames = ga.getInventoryCategories()
  const expItems = ga.getExpItems()
  const synthesisTargets = new Map<string, number>()
  const unsatisfiedTargets = new Map<string, number>()
  for (const [, items] of itemGroups) {
    for (const item of items || []) {
      if (Object.prototype.hasOwnProperty.call(expItems, item.key)) continue
      const syn = indirectDetails.synthisisedRequirements[item.key] || 0
      const uns = indirectDetails.unsatisfiedRequirementsDueToFormulaUses![item.key] || 0
      if (syn !== 0) synthesisTargets.set(item.key, syn)
      if (uns !== 0) unsatisfiedTargets.set(item.key, uns)
    }
  }

  const hasAnySynthesis = synthesisTargets.size > 0
  const hasAnyUnsatisfied = unsatisfiedTargets.size > 0

  if (!hasAnySynthesis && !hasAnyUnsatisfied) {
    return (
      <li role="none" className="cpp-farm-synthesis-empty">
        <NonIdealState icon="build" title={gt.gettext('现在没有可以合成的道具')} />
      </li>
    )
  }

  return (
    <>
      {hasAnySynthesis ? (
        <>
          <Callout title={gt.gettext('现在可以合成的道具')} />
          {itemGroups.map(([key, allItems]) => {
            const items = allItems!.filter((x) => {
              return synthesisTargets.has(x.key)
            })
            if (!items.length) return null

            return (
              <React.Fragment key={key}>
                <MenuDivider title={categoryNames[key].toString()} />
                {items.map((x) => (
                  <SynthesisMenu
                    key={x.key}
                    item={x}
                    target={synthesisTargets.get(x.key)!}
                    quantity={inputQuantities[x.key] || 0}
                  />
                ))}
              </React.Fragment>
            )
          })}
        </>
      ) : null}

      {hasAnySynthesis && hasAnyUnsatisfied ? <MenuDivider /> : null}

      {hasAnyUnsatisfied ? (
        <>
          <Callout intent={'warning'} title={gt.gettext('最好还是别合成的道具')} icon={null}>
            {gt.gettext('虽然现在确实可以合成下列道具来完成任务，但今后将消耗更多体力。还是去刷吧！')}
          </Callout>
          {itemGroups.map(([key, allItems]) => {
            const items = allItems!.filter((x) => {
              return unsatisfiedTargets.has(x.key)
            })
            if (!items.length) return null

            return (
              <React.Fragment key={key}>
                <MenuDivider title={categoryNames[key].toString()} />
                {items.map((x) => (
                  <SynthesisMenu
                    key={x.key}
                    intent="warning"
                    item={x}
                    target={unsatisfiedTargets.get(x.key)!}
                    quantity={inputQuantities[x.key] || 0}
                  />
                ))}
              </React.Fragment>
            )
          })}
        </>
      ) : null}
    </>
  )
})

const SynthesisMenu = memo(
  ({ item, target, intent, quantity }: { item: IItem; target: number; intent?: Intent; quantity: number }) => (
    <PeekTrigger
      peek={{ kind: 'item', id: item.key }}
      renderTarget={(peek) => (
        <MenuItem
          {...peek}
          intent={intent}
          className={peek ? peek.className : 'cpp-menu-not-interactive'}
          style={{ fontWeight: 'normal' }}
          icon={<ItemIcon item={item} size={20} />}
          text={
            <>
              <span>{item.name}</span>
              <span style={{ float: 'right' }}>
                <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
                {target}/{quantity}
              </span>
            </>
          }
        />
      )}
    />
  ),
)
