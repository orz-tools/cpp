import { Callout, Icon, Intent, MenuDivider, MenuItem } from '@blueprintjs/core'
import React, { memo, useMemo } from 'react'
import { Cpp, Level, useGameAdapter } from '../Cpp'
import { IGame, IItem } from '../pkg/cpp-basic'
import { TaskStatus } from '../pkg/cpp-core/Task'
import { generateIndirects } from '../pkg/cpp-core/UserData'
import type { FormulaUse } from './FarmList'
import { CachedImg } from './Icons'
import { ItemSynthesisPopover, buildItemList } from './ItemList'

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

export const SynthesisList = memo(
  ({ data, refresh }: { data: ReturnType<typeof planSynthesisList>; refresh: () => any }) => {
    const ga = useGameAdapter()
    const itemGroups = useMemo(() => buildItemList(ga), [ga])
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

    return (
      <>
        {hasAnySynthesis ? (
          <>
            <Callout title="现在可以合成的物品" />
            {itemGroups.map(([key, allItems]) => {
              const items = allItems!.filter((x) => {
                return synthesisTargets.has(x.key)
              })
              if (!items.length) return null

              return (
                <React.Fragment key={key}>
                  <MenuDivider title={categoryNames[key]} />
                  {items.map((x) => (
                    <SynthesisMenu
                      key={x.key}
                      refresh={refresh}
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
            <Callout intent={'warning'} title={'最好还是别合成的物品'} icon={null}>
              虽然现在确实可以合成下列材料来完成任务，但今后将消耗更多体力。还是去刷吧！
            </Callout>
            {itemGroups.map(([key, allItems]) => {
              const items = allItems!.filter((x) => {
                return unsatisfiedTargets.has(x.key)
              })
              if (!items.length) return null

              return (
                <React.Fragment key={key}>
                  <MenuDivider title={categoryNames[key]} />
                  {items.map((x) => (
                    <SynthesisMenu
                      key={x.key}
                      refresh={refresh}
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
  },
)

const SynthesisMenu = memo(
  ({
    item,
    target,
    intent,
    quantity,
    refresh,
  }: {
    item: IItem
    target: number
    intent?: Intent
    quantity: number
    refresh: () => any
  }) => {
    return (
      <MenuItem
        intent={intent}
        className="cpp-menu-nosubmenu"
        style={{ fontWeight: 'normal' }}
        popoverProps={{ interactionKind: 'click', usePortal: true }}
        icon={
          <CachedImg
            className="cpp-item-icon"
            src={item.icon}
            width={'20'}
            height={'20'}
            alt={item.key}
            title={item.key}
          />
        }
        text={
          <>
            <span>{item.name}</span>
            <span style={{ float: 'right' }}>
              <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
              {target}/{quantity}
            </span>
          </>
        }
        submenuProps={{ style: { minWidth: '300px' } }}
      >
        <ItemSynthesisPopover item={item} refresh={refresh} />
      </MenuItem>
    )
  },
)
