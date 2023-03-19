import { Alignment, Icon, Menu, MenuDivider, Navbar } from '@blueprintjs/core'
import { MenuItem2 } from '@blueprintjs/popover2'
import { useAtomValue } from 'jotai'
import React, { useMemo } from 'react'
import { useInject } from '../hooks/useContainer'
import { DataManager, Item, ITEM_VIRTUAL_EXP } from '../pkg/cpp-core/DataManager'
import { TaskStatus } from '../pkg/cpp-core/Task'
import { generateIndirects, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { CachedImg } from './Icons'
import { buildItemList, Category, CategoryNames, ItemSynthesisPopover } from './ItemList'

export function SynthesisList() {
  const atoms = useInject(UserDataAtomHolder)
  const dm = useInject(DataManager)
  const itemGroups = useMemo(() => buildItemList(dm), [dm])
  const tasks = useAtomValue(atoms.goalTasksWithExtra)
  const requirements = useMemo(() => {
    const requirements: Record<string, number> = {}
    tasks
      .filter((x) => [TaskStatus.Completable, TaskStatus.Synthesizable].includes(x[1].status))
      .forEach((x) =>
        x[0].requires.forEach((cost) => {
          requirements[cost.itemId] = (requirements[cost.itemId] || 0) + cost.quantity
        }),
      )
    return requirements
  }, [tasks])
  const itemQuantities = useAtomValue(atoms.itemQuantities)
  const forbiddenFormulaTags = useAtomValue(atoms.forbiddenFormulaTagsAtom)
  const indirectDetails = generateIndirects(dm, requirements, itemQuantities, forbiddenFormulaTags)

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>现在可以合成的物品</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        {itemGroups.map(([key, allItems]) => {
          const items = allItems.filter((x) => {
            if (x.key === ITEM_VIRTUAL_EXP) return false
            return (indirectDetails.synthisisedRequirements[x.key] || 0) > 0
          })
          if (!items.length) return null

          return (
            <React.Fragment key={key}>
              <MenuDivider title={CategoryNames[key as Category]} />
              {items.map((x) => (
                <SynthesisMenu key={x.key} item={x} target={indirectDetails.synthisisedRequirements[x.key] || 0} />
              ))}
            </React.Fragment>
          )
        })}
      </Menu>
    </>
  )
}

function SynthesisMenu({ item, target }: { item: Item; target: number }) {
  const atoms = useInject(UserDataAtomHolder)
  const quantity = useAtomValue(atoms.itemQuantity(item.key))
  return (
    <MenuItem2
      style={{ fontWeight: 'normal' }}
      popoverProps={{ interactionKind: 'click' }}
      icon={<CachedImg src={item.icon} width={'100%'} height={'100%'} alt={item.key} title={item.key} />}
      text={
        <>
          <span>{item.raw.name}</span>
          <span style={{ float: 'right' }}>
            <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
            {target}/{quantity}
          </span>
        </>
      }
    >
      <ItemSynthesisPopover item={item} />
    </MenuItem2>
  )
}
