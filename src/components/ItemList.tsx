import { Alignment, Button, Menu, MenuDivider, Navbar, NumericInput } from '@blueprintjs/core'
import { useAtom, useSetAtom } from 'jotai'
import { groupBy, pick, pickAll } from 'ramda'
import React, { useEffect, useMemo, useState } from 'react'
import { useInject } from '../hooks/useContainer'
import { DataManager, Item } from '../pkg/cpp-core/DataManager'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { CachedImg } from './Icons'

const formatter = (q: number) => q.toFixed(0)
const parser = (q: string) => Math.floor(parseFloat(q))
export function ItemQuantityEditor({ item, style }: { item: Item; style?: React.CSSProperties }) {
  const atoms = useInject(UserDataAtomHolder)
  const [quantity, setQuantity] = useAtom(atoms.itemQuantity(item.key))
  const [input, setInput] = useState(formatter(quantity))
  useEffect(() => setInput(formatter(quantity)), [quantity])
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

export function ItemMenu({ item }: { item: Item }) {
  return (
    <li role="none">
      <a
        role="menuitem"
        tabIndex={0}
        className="bp4-menu-item cpp-utem-menu"
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
              {`≈AP ${item.valueAsApString}`}
            </div>
          </div>
        </>
      </a>
      <div style={{}}>
        <ItemQuantityEditor item={item} style={{ width: '6em', textAlign: 'right' }} />
      </div>
    </li>
  )
}

enum Category {
  Gold = '0gold',
  Rarity4 = '1rarity4',
  Rarity3 = '2rarity3',
  Rarity2 = '3rarity2',
  Rarity1 = '4rarity1',
  Rarity0 = '5rarity0',
  ModSkill = '7modskill',
  ChipsDual = '81chips',
  ChipsHard = '82chips',
  ChipsEasy = '83chips',
  Unknown = '9unknown',
}

const myCategories = {
  '4001': Category.Gold, // 龙门币
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
  '4006': Category.ModSkill, // 采购凭证
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

function buildItemList(dm: DataManager) {
  return Object.entries(
    byCategory(
      Object.values(dm.data.items)
        .filter((x) => {
          if (!['MATERIAL', 'CARD_EXP', 'GOLD'].includes(x.raw.itemType)) return false
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
  const setData = useSetAtom(atoms.dataAtom)
  return (
    <Button
      icon={'import'}
      minimal={true}
      onClick={() => {
        try {
          const data = JSON.parse(prompt('Import MAA items') || '')
          const quans = Object.fromEntries(
            Object.entries(data).filter(([key, value]) => {
              return Object.hasOwn(dataManager.data.items, key) && typeof value === 'number'
            }),
          )
          setData('modify', (x) => {
            x.items = {
              ...quans,
              ...pickRetainableItems(x.items),
            }
          })
        } catch (e) {
          alert(e)
        }
      }}
    />
  )
}

export function ItemList() {
  const dataManager = useInject(DataManager)
  const itemGroups = useMemo(() => buildItemList(dataManager), [dataManager])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <ImportButton />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} className="cpp-item-menu-master">
        {itemGroups.map(([key, items]) => {
          return (
            <React.Fragment key={key}>
              <MenuDivider title={key} />
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
