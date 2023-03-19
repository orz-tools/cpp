import { Menu, Button, MenuItem } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { WritableAtom, atom, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { type, without } from 'ramda'
import React, { SetStateAction } from 'react'
import { FormulaTag } from '../pkg/cpp-core/DataManager'
import { SetValueOptionMenuItem } from './Value'

export enum ValueType {
  Ap = 'ap',
  Diamond = 'diamond',
  Yuan = 'yuan',
  Time = 'time',
}

export interface Preference {
  valueType: ValueType
  forbiddenFormulaTags: FormulaTag[]
}

const preferenceStorageAtom = atomWithStorage<Preference>('cpp_preference', undefined as any)
export const preferenceAtom: WritableAtom<Preference, [Preference | SetStateAction<Preference>], void> = atom<
  Preference,
  [Preference | SetStateAction<Preference>],
  void
>(
  (get) => {
    const value = Object.assign({}, get(preferenceStorageAtom) || {})
    if (value.valueType == null) value.valueType = ValueType.Ap
    if (value.forbiddenFormulaTags == null) value.forbiddenFormulaTags = []
    return value
  },
  (get, set, value: Preference | SetStateAction<Preference>) =>
    set(preferenceStorageAtom, typeof value === 'function' ? value(get(preferenceAtom)) : value),
)

export const valueTypeAtom = atom(
  (get) => get(preferenceAtom).valueType,
  (get, set, value: ValueType | SetStateAction<ValueType>) => {
    set(preferenceAtom, (r) => ({
      ...r,
      valueType: typeof value === 'function' ? value(get(preferenceAtom).valueType) : value,
    }))
  },
)

export const forbiddenFormulaTagsAtom = atom(
  (get) => get(preferenceAtom).forbiddenFormulaTags || [],
  (get, set, value: FormulaTag[] | SetStateAction<FormulaTag[]>) => {
    set(preferenceAtom, (r) => ({
      ...r,
      forbiddenFormulaTags: typeof value === 'function' ? value(get(preferenceAtom).forbiddenFormulaTags || []) : value,
    }))
  },
)

export function ForbiddenFormulaTag({ tag, text }: { tag: FormulaTag; text: React.ReactNode }) {
  const [tags, setTags] = useAtom(forbiddenFormulaTagsAtom)
  return (
    <MenuItem
      icon={tags.includes(tag) ? 'tick' : 'blank'}
      text={text}
      onClick={() =>
        setTags((t) => {
          if (t.includes(tag)) return without([tag], t)
          return [...t, tag]
        })
      }
    />
  )
}
export function ConfigButton() {
  return (
    <Popover2
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          <ForbiddenFormulaTag tag={FormulaTag.WorkshopRarity2} text="不从绿材料合成蓝材料" />
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={'properties'} minimal={true} rightIcon={'chevron-down'}>
        选项
      </Button>
    </Popover2>
  )
}
