import {
  Alert,
  Alignment,
  Button,
  ButtonGroup,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NumericInput,
  Tag,
} from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { atom, useAtom, useAtomValue, useSetAtom, useStore, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { groupBy, intersection, map, pick, sum, uniq } from 'ramda'
import React, { SetStateAction, useEffect, useMemo, useState } from 'react'
import { useInject } from '../hooks/useContainer'
import { DataManager, Item, ITEM_VIRTUAL_EXP } from '../pkg/cpp-core/DataManager'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'
import { CachedImg } from './Icons'
import { ValueTag, ValueTagProgressBar } from './Value'

const formatter = (q: number) => q.toFixed(0)
const parser = (q: string) => Math.floor(parseFloat(q) || 0)
export function ItemQuantityEditor({ item, style }: { item: Item; style?: React.CSSProperties }) {
  const atoms = useInject(UserDataAtomHolder)
  const [quantity, setQuantity] = useAtom(atoms.itemQuantity(item.key))
  const [input, setInput] = useState(formatter(quantity))
  useEffect(() => setInput(formatter(quantity)), [quantity])

  if (item.key === ITEM_VIRTUAL_EXP) {
    return <NumericInput value={input} style={style} disabled={true} />
  }
  return (
    <NumericInput
      value={input}
      style={style}
      min={0}
      onValueChange={(_, valueAsString) => setInput(valueAsString)}
      onBlur={() => {
        if (input === formatter(quantity)) return
        setQuantity(parser(input))
        setInput(formatter(quantity))
      }}
      onButtonClick={(_, valueAsString) => {
        setQuantity(parser(valueAsString))
      }}
    />
  )
}

export function ItemSynthesisPopover({ item }: { item: Item }) {
  const dm = useInject(DataManager)
  const atoms = useInject(UserDataAtomHolder)
  const quantities = useAtomValue(atoms.itemQuantities)
  const setData = useSetAtom(atoms.dataAtom)
  const formula = useMemo(() => dm.data.formulas.find((x) => x.itemId == item.key), [dm, item.key])
  const quantity = useAtomValue(atoms.itemQuantity(item.key)) || 0
  const [times, setTimes] = useState(1)

  if (!formula)
    return (
      <>
        无法合成{item.raw.name}，<i>谁让你来的？</i>
      </>
    )

  const synTimes = [24, 12, 6, 3, 1]
  const maxTimes = Math.max(
    0,
    Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity))),
  )
  if (maxTimes > 0) {
    while (synTimes[0] > maxTimes) {
      synTimes.shift()
    }
    if (synTimes[0] !== maxTimes && ((formula.apCost && maxTimes < 24) || !formula.apCost)) {
      synTimes.unshift(maxTimes)
    }
  } else {
    synTimes.splice(0, synTimes.length - 1)
  }

  return (
    <Menu style={{ width: '300px' }}>
      <ButtonGroup minimal={true} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {formula.apCost ? (
          <>
            <span style={{ marginLeft: 10 }}>
              {'心情 '}
              {formula.apCost}
            </span>
            <div style={{ flex: 1 }} />
          </>
        ) : null}
        {synTimes.map((t) => {
          return (
            <Button
              key={t}
              disabled={t > maxTimes}
              text={
                <span>
                  <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5, margin: 0 }} />
                  {t}
                </span>
              }
              style={{ opacity: formula.apCost && t > 24 / formula.apCost ? 0.5 : 1 }}
              onMouseEnter={() => setTimes(t)}
              onMouseLeave={() => setTimes(1)}
              onClick={() => {
                setData('modify', (d) => {
                  d.items[item.key] = (d.items[item.key] || 0) + t * formula.quantity
                  formula.costs.forEach((cost) => {
                    d.items[cost.itemId] = (d.items[cost.itemId] || 0) - t * cost.quantity
                  })
                })
              }}
            />
          )
        })}
      </ButtonGroup>
      <MenuDivider />
      <MenuItem
        icon={<CachedImg src={item.icon} width={'20'} height={'20'} alt={item.key} title={item.key} />}
        text={
          <>
            <span>{item.raw.name}</span>
            <span style={{ float: 'right' }}>
              <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
              {times * formula.quantity}/{quantity}
            </span>
          </>
        }
      />
      <MenuDivider title={`制作 ${times} 次所需`} />
      {formula.costs.map((cost) => {
        const citem = dm.data.items[cost.itemId]
        return (
          <MenuItem
            key={cost.itemId}
            icon={<CachedImg src={citem.icon} width={'20'} height={'20'} alt={citem.key} title={citem.key} />}
            text={
              <>
                <span>{citem.raw.name}</span>
                <span style={{ float: 'right' }}>
                  {times * cost.quantity}/{quantities[cost.itemId] || 0}
                </span>
              </>
            }
          />
        )
      })}
    </Menu>
  )
}

export function ItemTaskRequirements({ item }: { item: Item }) {
  const dm = useInject(DataManager)
  const formula = useMemo(() => dm.data.formulas.find((x) => x.itemId == item.key), [dm, item.key])
  const atoms = useInject(UserDataAtomHolder)
  const quantities = useAtomValue(atoms.itemQuantities)
  const quantity = useAtomValue(atoms.itemQuantity(item.key)) || 0
  const goal = useAtomValue(atoms.allGoalTaskRequirements)[item.key] || 0
  const finished = useAtomValue(atoms.allFinishedTaskRequirements)[item.key] || 0
  const goalIndirects = useAtomValue(atoms.allGoalIndirects)[item.key] || 0
  const finishedIndirects = useAtomValue(atoms.allFinishedIndirects)[item.key] || 0
  const itemListParam = useAtomValue(itemListParamAtom)
  const forbiddenFormulaTags = useAtomValue(atoms.forbiddenFormulaTagsAtom)

  const synableReal = formula
    ? Math.max(0, Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity)))) *
      formula.quantity
    : 0
  const canSyn = formula && intersection(forbiddenFormulaTags, formula.tags).length == 0
  const synable = canSyn ? synableReal : 0

  return (
    <>
      <div
        className="cpp-goal-counter"
        style={{ width: '6em', visibility: !formula || synable == 0 ? 'hidden' : undefined }}
        data-label="合成后"
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'goal'
                ? goal + goalIndirects - quantity - Math.min(synable, goal + goalIndirects) > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal + goalIndirects - quantity - Math.min(synable, goal + goalIndirects)}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'finished'
                ? finished + finishedIndirects - quantity - Math.min(synable, finished + finishedIndirects) > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished + finishedIndirects - quantity - Math.min(synable, finished + finishedIndirects)}</span>
        </div>
      </div>
      <a
        role="menuitem"
        tabIndex={0}
        className="bp4-menu-item cpp-item-menu"
        style={{ lineHeight: '21px', padding: 0, fontWeight: 'normal', visibility: !formula ? 'hidden' : undefined }}
      >
        <Popover2 content={<ItemSynthesisPopover item={item} />} usePortal={true} placement={'bottom-end'}>
          <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="可合成">
            <div
              style={{
                textAlign: 'right',
                opacity:
                  itemListParam.mode == 'all' || itemListParam.mode === 'goal'
                    ? canSyn && Math.min(synableReal, goal + goalIndirects) > 0
                      ? 1
                      : 0.4
                    : 0,
              }}
            >
              <span>{Math.min(synableReal, goal + goalIndirects)}</span>
            </div>
            <div
              style={{
                textAlign: 'right',
                opacity:
                  itemListParam.mode == 'all' || itemListParam.mode === 'finished'
                    ? canSyn && Math.min(synableReal, finished + finishedIndirects) > 0
                      ? 1
                      : 0.4
                    : 0,
              }}
            >
              <span>{Math.min(synableReal, finished + finishedIndirects)}</span>
            </div>
          </div>
        </Popover2>
      </a>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="还需">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'goal'
                ? goal + goalIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal + goalIndirects - quantity}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'finished'
                ? finished + finishedIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished + finishedIndirects - quantity}</span>
        </div>
      </div>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="直接需求">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'goal'
                ? goal > 0 && goal - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'finished'
                ? finished > 0 && finished - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished}</span>
        </div>
      </div>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="间接需求">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'goal'
                ? goalIndirects > 0 && goal + goalIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goalIndirects}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode == 'all' || itemListParam.mode === 'finished'
                ? finishedIndirects > 0 && finished + finishedIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finishedIndirects}</span>
        </div>
      </div>
    </>
  )
}

export function ItemMenu({ item }: { item: Item }) {
  return (
    <li role="none">
      <a
        role="menuitem"
        tabIndex={0}
        className="bp4-menu-item cpp-item-menu"
        style={{ flexShrink: 1, overflow: 'hidden' }}
      >
        <>
          <span className="bp4-menu-item-icon">
            <CachedImg src={item.icon} width={'100%'} height={'100%'} alt={item.key} title={item.key} />
          </span>
          <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp4-text-overflow-ellipsis" title={item.raw.name}>
              {item.raw.name}
            </div>
            <div className="bp4-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.75 }}>
              <ValueTag value={item.valueAsAp} minimal={true} single={true} />
            </div>
          </div>
        </>
      </a>
      <div style={{}}>
        <ItemQuantityEditor item={item} style={{ width: '6em', textAlign: 'right' }} />
      </div>
      <ItemTaskRequirements item={item} />
    </li>
  )
}

export enum Category {
  Gold = '0',
  Rarity4 = '1',
  Rarity3 = '2',
  Rarity2 = '3',
  Rarity1 = '4',
  Rarity0 = '5',
  ModSkill = '7',
  ChipsDual = '81',
  ChipsHard = '82',
  ChipsEasy = '83',
  Unknown = '9',
}

export const CategoryNames = {
  [Category.Gold]: '钱和经验',
  [Category.Rarity4]: '金材料',
  [Category.Rarity3]: '紫材料',
  [Category.Rarity2]: '蓝材料',
  [Category.Rarity1]: '绿材料',
  [Category.Rarity0]: '灰材料',
  [Category.ModSkill]: '技能、模组和胶水',
  [Category.ChipsDual]: '双芯片',
  [Category.ChipsHard]: '芯片组',
  [Category.ChipsEasy]: '芯片',
  [Category.Unknown]: '其他',
} satisfies Record<Category, string>

const myCategories = {
  '4001': Category.Gold, // 龙门币
  [ITEM_VIRTUAL_EXP]: Category.Gold,
  '2004': Category.Gold, // 高级作战记录
  '2003': Category.Gold, // 中级作战记录
  '2002': Category.Gold, // 初级作战记录
  '2001': Category.Gold, // 基础作战记录

  '3303': Category.ModSkill, // 技巧概要·卷3
  '3302': Category.ModSkill, // 技巧概要·卷2
  '3301': Category.ModSkill, // 技巧概要·卷1
  mod_unlock_token: Category.ModSkill, // 模组数据块
  mod_update_token_2: Category.ModSkill, // 数据增补仪
  mod_update_token_1: Category.ModSkill, // 数据增补条
  '4006': Category.Gold, // 采购凭证
  '32001': Category.ModSkill, // 芯片助剂

  '3213': Category.ChipsDual, // 先锋双芯片
  '3223': Category.ChipsDual, // 近卫双芯片
  '3233': Category.ChipsDual, // 重装双芯片
  '3243': Category.ChipsDual, // 狙击双芯片
  '3253': Category.ChipsDual, // 术师双芯片
  '3263': Category.ChipsDual, // 医疗双芯片
  '3273': Category.ChipsDual, // 辅助双芯片
  '3283': Category.ChipsDual, // 特种双芯片

  '3212': Category.ChipsHard, // 先锋芯片组
  '3222': Category.ChipsHard, // 近卫芯片组
  '3232': Category.ChipsHard, // 重装芯片组
  '3242': Category.ChipsHard, // 狙击芯片组
  '3252': Category.ChipsHard, // 术师芯片组
  '3262': Category.ChipsHard, // 医疗芯片组
  '3272': Category.ChipsHard, // 辅助芯片组
  '3282': Category.ChipsHard, // 特种芯片组

  '3211': Category.ChipsEasy, // 先锋芯片
  '3221': Category.ChipsEasy, // 近卫芯片
  '3231': Category.ChipsEasy, // 重装芯片
  '3241': Category.ChipsEasy, // 狙击芯片
  '3251': Category.ChipsEasy, // 术师芯片
  '3261': Category.ChipsEasy, // 医疗芯片
  '3271': Category.ChipsEasy, // 辅助芯片
  '3281': Category.ChipsEasy, // 特种芯片
} satisfies Record<string, Category>

const byCategory = groupBy<Item, Category>((i) => {
  if (Object.hasOwn(myCategories, i.key)) return (myCategories as any)[i.key]
  if (i.raw.rarity === 4) return Category.Rarity4
  if (i.raw.rarity === 3) return Category.Rarity3
  if (i.raw.rarity === 2) return Category.Rarity2
  if (i.raw.rarity === 1) return Category.Rarity1
  if (i.raw.rarity === 0) return Category.Rarity0
  return Category.Unknown
})

export function buildItemList(dm: DataManager) {
  return Object.entries(
    byCategory(
      Object.values(dm.data.items)
        .filter((x) => {
          if (!['MATERIAL', 'CARD_EXP', 'GOLD', '##EXP_VIRTUAL'].includes(x.raw.itemType)) return false
          if (
            [
              '3105', // 龙骨
              '3401', // 家具零件
              '3133', // 高级加固建材
              '3132', // 进阶加固建材
              '3131', // 基础加固建材
              '3114', // 碳素组
              '3113', // 碳素
              '3112', // 碳
              'STORY_REVIEW_COIN', // 事相碎片
              '3141', // 源石碎片
              '3003', // 赤金
            ].includes(x.key)
          ) {
            return false
          }
          if (x.key.startsWith('act')) return false
          if (x.key.startsWith('tier')) return false
          if (x.key.startsWith('p_char')) return false
          return true
        })
        .sort((a, b) => {
          if (a.raw.sortId < b.raw.sortId) return -1
          if (a.raw.sortId > b.raw.sortId) return 1
          return 0
        }),
    ),
  ).sort(([a], [b]) => {
    return a > b ? 1 : a < b ? -1 : 0
  })
}

const pickRetainableItems = pick([
  '4001', // 龙门币
  '4006', // 采购凭证
])

function ImportButton() {
  const dataManager = useInject(DataManager)
  const atoms = useInject(UserDataAtomHolder)
  const store = useInject(Store).store
  const setData = useSetAtom(atoms.dataAtom)
  const [isOpen, setIsOpen] = useState(false)
  const [msg, setMsg] = useState('')
  return (
    <>
      <Button
        icon={'import'}
        minimal={true}
        onClick={() => {
          try {
            const input = prompt('Import from MAA: \nMAA 仓库识别 beta -> 导出至明日方舟工具箱 -> 下面粘贴') || ''
            if (!input) return
            const data = JSON.parse(input)
            if (!data) return
            const quans = Object.fromEntries(
              Object.entries(data).filter(([key, value]) => {
                return Object.hasOwn(dataManager.data.items, key) && key[0] !== '#' && typeof value === 'number'
              }),
            )
            const before = store.get(atoms.itemQuantities)
            setData('modify', (x) => {
              x.items = {
                ...quans,
                ...pickRetainableItems(x.items),
              }
            })
            const after = store.get(atoms.itemQuantities)
            {
              // FIXME: 挪走
              let msg = [] as string[]
              const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
              let count = 0
              for (const i of allKeys) {
                const item = dataManager.data.items[i]
                const b = before[i] || 0
                const a = after[i] || 0
                if (a - b === 0) continue
                const v = item.valueAsAp == null ? undefined : (a - b) * item.valueAsAp
                msg.push(
                  `${item.raw.name}\t${b} -> ${a}\t${a - b > 0 ? '+' : '-'}${Math.abs(a - b)}\tAP ${v?.toFixed(3)}`,
                )
                if (v != null) {
                  count += v
                }
              }
              msg.push(`Σ\t\t\tAP ${count.toFixed(3)}`)
              setMsg(msg.join('\n'))
              setIsOpen(true)
            }
          } catch (e) {
            alert(e)
          }
        }}
      />
      <Alert confirmButtonText="Okay" isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <pre style={{ tabSize: 16 }}>{msg}</pre>
      </Alert>
    </>
  )
}

function AllValue() {
  const dataManager = useInject(DataManager)
  const atoms = useInject(UserDataAtomHolder)
  const quantites = useAtomValue(atoms.itemQuantities)

  const a = sum(
    Object.entries(quantites).map(([k, v]) => {
      const value = dataManager.data.items[k].valueAsAp
      if (value == null) return 0
      return value * v
    }),
  )
  return <ValueTag value={a} minimal={true} />
}

function AllGoalValue({ finished = false }: { finished?: boolean }) {
  const dataManager = useInject(DataManager)
  const atoms = useInject(UserDataAtomHolder)
  const quantites = useAtomValue(atoms.itemQuantities)
  const allGoals = useAtomValue(finished ? atoms.allFinishedTaskRequirements : atoms.allGoalTaskRequirements)
  const allGoalsIndirectsDetails = useAtomValue(
    finished ? atoms.allFinishedIndirectsDetails : atoms.allGoalIndirectsDetails,
  )
  const [param, setParam] = useAtom(itemListParamAtom)
  const targetMode = finished ? 'finished' : 'goal'

  const data = uniq([...Object.keys(allGoals), ...Object.keys(allGoalsIndirectsDetails.indirects)]).map((k) => {
    const total =
      (allGoals[k] || 0) +
      (allGoalsIndirectsDetails.indirects[k] || 0) -
      (allGoalsIndirectsDetails.synthisisedRequirements[k] || 0)
    const remaining = Math.max(0, total - (quantites[k] || 0))
    // console.log(finished, dataManager.data.items[k].raw.name, k, total, remaining)
    const value = dataManager.data.items[k].valueAsAp
    if (value == null) return [0, 0]
    return [value * total, value * remaining]
  })

  const total = sum(map((x) => x[0]!, data))
  const remaining = sum(map((x) => x[1]!, data))

  return (
    <Button
      minimal={true}
      text={finished ? `毕业` : `计划`}
      rightIcon={<ValueTagProgressBar value={remaining} maxValue={total} />}
      active={param.mode === targetMode}
      onClick={() => {
        setParam((p) => ({ ...p, mode: p.mode === targetMode ? 'all' : targetMode }))
      }}
    />
  )
}

function HideCompletedButton() {
  const [param, setParam] = useAtom(itemListParamAtom)
  return (
    <Button
      minimal={true}
      active={param.hideCompleted}
      icon={'eye-off'}
      onClick={() => {
        setParam((p) => {
          return { ...p, hideCompleted: !p.hideCompleted }
        })
      }}
    />
  )
}

interface ItemListParam {
  mode: 'all' | 'goal' | 'finished'
  hideCompleted: boolean
}

const itemListParamStorageAtom = atomWithStorage<ItemListParam>('cpp_item_param', undefined as any)
const itemListParamAtom: WritableAtom<ItemListParam, [ItemListParam | SetStateAction<ItemListParam>], void> = atom<
  ItemListParam,
  [ItemListParam | SetStateAction<ItemListParam>],
  void
>(
  (get) => {
    const value = Object.assign({}, get(itemListParamStorageAtom) || {})
    if (!value.mode) value.mode == 'all'
    if (value.hideCompleted == null) value.hideCompleted = false
    return value
  },
  (get, set, value: ItemListParam | SetStateAction<ItemListParam>) =>
    set(itemListParamStorageAtom, typeof value === 'function' ? value(get(itemListParamAtom)) : value),
)

export function ItemList() {
  const param = useAtomValue(itemListParamAtom)
  const dataManager = useInject(DataManager)
  const itemGroups = useMemo(() => buildItemList(dataManager), [dataManager])
  const atoms = useInject(UserDataAtomHolder)
  const store = useStore()
  const quantities = useAtomValue(atoms.itemQuantities)
  const goals = useAtomValue(atoms.allGoalTaskRequirements)
  const finished = useAtomValue(atoms.allFinishedTaskRequirements)
  const goalIndirects = useAtomValue(atoms.allGoalIndirects)
  const finishedIndirects = useAtomValue(atoms.allFinishedIndirects)

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          <AllValue />
          <ImportButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <HideCompletedButton />
          <AllGoalValue />
          <AllGoalValue finished={true} />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} className="cpp-item-menu-master">
        {itemGroups.map(([key, allItems]) => {
          const items = allItems.filter((x) => {
            if (!param.hideCompleted) return true
            switch (param.mode) {
              case 'goal':
                return store.get(atoms.itemQuantity(x.key)) < (goals[x.key] || 0) + (goalIndirects[x.key] || 0)
              case 'finished':
              case 'all':
                return store.get(atoms.itemQuantity(x.key)) < (finished[x.key] || 0) + (finishedIndirects[x.key] || 0)
            }
          })
          if (!items.length) return null

          return (
            <React.Fragment key={key}>
              <MenuDivider title={CategoryNames[key as Category]} />
              {items.map((x) => (
                <ItemMenu key={x.key} item={x} />
              ))}
            </React.Fragment>
          )
        })}
      </Menu>
    </>
  )
}
