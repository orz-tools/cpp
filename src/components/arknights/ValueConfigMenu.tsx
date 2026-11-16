import {
  Button,
  ButtonGroup,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  H4,
  HTMLSelect,
  HTMLTable,
  Intent,
  MenuItem,
  NumericInput,
  Popover,
  Radio,
  RadioGroup,
  Tag,
} from '@blueprintjs/core'
import deepEqual from 'deep-equal'
import { memo, useEffect, useState } from 'react'
import { WithGame, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, PreferenceKeys } from '../../pkg/cpp-arknights'
import { Category } from '../../pkg/cpp-arknights/GameAdapter'
import {
  BYPRODUCT_KINDS,
  ByproductKind,
  CHIP_PAIRS,
  ChipConversion,
  ChipPair,
  DEFAULT_ITEM_VALUE_CONFIG,
  EXP_COEFFICIENT_PRESETS,
  ItemValueConfig,
  RETIREMENT_PRESETS,
  StageScope,
  normalizeItemValueConfig,
} from '../../pkg/cpp-arknights/itemValue'
import { gt } from '../../pkg/gt'
import { StagePopover } from '../ConfigUi'
import { ItemIcon } from '../Icons'

// 用每对芯片中 T1 芯片的物品名称呼职业，跟随区服语言
const CHIP_ITEM_BY_PROFESSION: Record<string, string> = {
  PIONEER: '3211',
  WARRIOR: '3221',
  TANK: '3231',
  SNIPER: '3241',
  CASTER: '3251',
  MEDIC: '3261',
  SUPPORT: '3271',
  SPECIAL: '3281',
}

const MATERIAL_CATEGORIES: string[] = [
  Category.Rarity4,
  Category.Rarity3,
  Category.Rarity2,
  Category.Rarity1,
  Category.Rarity0,
]

function byproductKindName(kind: ByproductKind) {
  switch (kind) {
    case 'elite2':
      return gt.pgettext('value config', '精英材料 T1→T2')
    case 'elite3':
      return gt.pgettext('value config', '精英材料 T2→T3')
    case 'elite4':
      return gt.pgettext('value config', '精英材料 T3→T4')
    case 'elite5':
      return gt.pgettext('value config', '精英材料 T4→T5')
    case 'skill2':
      return gt.pgettext('value config', '技巧概要 卷1→卷2')
    case 'skill3':
      return gt.pgettext('value config', '技巧概要 卷2→卷3')
    case 'building':
      return gt.pgettext('value config', '基建材料')
    case 'chip':
      return gt.pgettext('value config', '芯片')
    case 'chipPack':
      return gt.pgettext('value config', '芯片组')
  }
}

function expPresetName(id: (typeof EXP_COEFFICIENT_PRESETS)[number]['id']) {
  switch (id) {
    case 'ls6':
      return gt.pgettext('value config', '按 LS-6 定价')
    case 'trading3':
      return gt.pgettext('value config', '无人机：3 级贸易站')
    case 'trading3Tequila2Proviso2':
      return gt.pgettext('value config', '无人机：3 级贸易站，精 2 龙舌兰、精 2 但书')
    case 'trading2Proviso2':
      return gt.pgettext('value config', '无人机：2 级贸易站，精 2 但书')
    case 'trading1Proviso2':
      return gt.pgettext('value config', '无人机：1 级贸易站，精 2 但书')
    case 'none':
      return gt.pgettext('value config', '不需要')
  }
}

const NumberField = memo(
  ({
    value,
    onChange,
    min,
    max,
    step,
    integer,
    width = 100,
  }: {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    integer?: boolean
    width?: number
  }) => {
    const [text, setText] = useState(String(value))
    useEffect(() => {
      setText((t) => (Number(t) === value ? t : String(value)))
    }, [value])
    const valid = (x: number) =>
      Number.isFinite(x) && (min == null || x >= min) && (max == null || x <= max) && (!integer || Number.isInteger(x))

    return (
      <NumericInput
        value={text}
        min={min}
        max={max}
        stepSize={step ?? 1}
        minorStepSize={integer ? null : 0.001}
        majorStepSize={step ? step * 10 : 10}
        allowNumericCharactersOnly={false}
        intent={valid(Number(text)) ? Intent.NONE : Intent.DANGER}
        style={{ width }}
        onValueChange={(n, s) => {
          setText(s)
          if (s.trim() !== '' && valid(n)) onChange(n)
        }}
      />
    )
  },
)

const ValueConfigDialog = memo(({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const [saved, setSaved] = WithGame<Arknights>().useGamePreferenceAtom(PreferenceKeys.ItemValue)
  const [draft, setDraft] = useState<ItemValueConfig>(() => structuredClone(saved))
  const [newItemId, setNewItemId] = useState('')
  const [newItemValue, setNewItemValue] = useState(0)

  const update = (fn: (d: ItemValueConfig) => void) =>
    setDraft((d) => {
      const next = structuredClone(d)
      fn(next)
      return next
    })

  const stageInfos = ga.getStageInfos()
  const setStagesIncluded = (stageIds: string[], included: boolean) =>
    update((d) => {
      d.excludedStageIds = included
        ? d.excludedStageIds.filter((x) => !stageIds.includes(x))
        : [...d.excludedStageIds, ...stageIds.filter((x) => !d.excludedStageIds.includes(x))]
    })
  const excludedCount = draft.excludedStageIds.length

  const expPreset = EXP_COEFFICIENT_PRESETS.find((x) => x.value === draft.expCoefficient)
  const itemName = (itemId: string) => ga.getItem(itemId)?.name || itemId
  // 只列养成材料：同为稀有度类别的还有活动兑换券之类，它们不进入价值计算
  const materials = ga
    .getInventoryItems()
    .filter(
      (x) =>
        MATERIAL_CATEGORIES.includes(x.inventoryCategory) &&
        /^3\d{4}$/.test(x.key) &&
        !Object.hasOwn(draft.fixedValues, x.key),
    )
  const dirty = !deepEqual(normalizeItemValueConfig(draft), saved)

  const apply = () => {
    setSaved(normalizeItemValueConfig(draft))
    location.reload()
  }

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={gt.pgettext('value config', '价值计算设置')}
      icon="calculator"
      style={{ width: 640, maxWidth: '95vw' }}
    >
      <DialogBody>
        <H4>{gt.pgettext('value config', '定价关卡')}</H4>
        <RadioGroup
          label={gt.pgettext('value config', '定价范围')}
          inline={true}
          selectedValue={draft.stageScope}
          onChange={(e) => {
            const value = e.currentTarget.value as StageScope
            update((d) => void (d.stageScope = value))
          }}
        >
          <Radio value="mainline" label={gt.pgettext('value config', '主线')} />
          <Radio value="permanent" label={gt.pgettext('value config', '常驻')} />
          <Radio value="open" label={gt.pgettext('value config', '含开放活动')} />
        </RadioGroup>
        <FormGroup label={gt.pgettext('value config', '排除的关卡')} inline={true}>
          <Popover
            usePortal={true}
            minimal={true}
            position="bottom-left"
            content={
              <StagePopover
                stageIds={Object.keys(stageInfos)}
                isChecked={(stageId) => !draft.excludedStageIds.includes(stageId)}
                onSetChecked={setStagesIncluded}
              />
            }
          >
            <Button icon="layers" endIcon="chevron-down">
              {excludedCount > 0
                ? gt
                    .ngettext('已排除 %d 个关卡', '已排除 %d 个关卡', excludedCount) /* I10N: %d: number */
                    .replaceAll('%d', String(excludedCount))
                : gt.pgettext('value config', '无')}
            </Button>
          </Popover>
        </FormGroup>
        <FormGroup
          label={gt.pgettext('value config', '样本量阈值')}
          helperText={gt.pgettext('value config', '掉落样本少于此数的关卡不参与定价')}
          inline={true}
        >
          <NumberField
            value={draft.minSamples}
            min={0}
            step={100}
            integer
            onChange={(x) => update((d) => void (d.minSamples = x))}
          />
        </FormGroup>

        <H4>{gt.pgettext('value config', '龙门币与经验')}</H4>
        <FormGroup
          label={gt.pgettext('value config', '龙门币系数')}
          helperText={gt.pgettext('value config', '1 表示按 CE-6 的理智折算')}
          inline={true}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <NumberField
              value={draft.lmdCoefficient}
              min={0}
              max={1}
              step={0.1}
              onChange={(x) => update((d) => void (d.lmdCoefficient = x))}
            />
            <ButtonGroup>
              <Button
                active={draft.lmdCoefficient === 1}
                onClick={() => update((d) => void (d.lmdCoefficient = 1))}
                text={gt.pgettext('value config', '按 CE-6 定价（1）')}
              />
              <Button
                active={draft.lmdCoefficient === 0}
                onClick={() => update((d) => void (d.lmdCoefficient = 0))}
                text={gt.pgettext('value config', '不需要（0）')}
              />
            </ButtonGroup>
          </div>
        </FormGroup>
        <FormGroup label={gt.pgettext('value config', '经验系数')} inline={true}>
          <div style={{ display: 'flex', gap: 8 }}>
            <HTMLSelect
              value={expPreset?.id || ''}
              onChange={(e) => {
                const preset = EXP_COEFFICIENT_PRESETS.find((x) => x.id === e.currentTarget.value)
                if (preset) update((d) => void (d.expCoefficient = preset.value))
              }}
            >
              {expPreset ? null : <option value="">{gt.pgettext('value config', '自定义')}</option>}
              {EXP_COEFFICIENT_PRESETS.map((x) => (
                <option key={x.id} value={x.id}>
                  {expPresetName(x.id)}
                </option>
              ))}
            </HTMLSelect>
            <NumberField
              value={draft.expCoefficient}
              min={0}
              max={1}
              step={0.1}
              onChange={(x) => update((d) => void (d.expCoefficient = x))}
            />
          </div>
        </FormGroup>

        <H4>{gt.pgettext('value config', '加工站副产物提升量')}</H4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
          {BYPRODUCT_KINDS.map((kind) => (
            <FormGroup key={kind} label={byproductKindName(kind)}>
              <NumberField
                value={draft.byproductBoost[kind]}
                min={0}
                step={0.1}
                onChange={(x) => update((d) => void (d.byproductBoost[kind] = x))}
              />
            </FormGroup>
          ))}
        </div>

        <H4>{gt.pgettext('value config', '芯片')}</H4>
        {(Object.entries(CHIP_PAIRS) as [ChipPair, readonly [string, string]][]).map(([pair, [a, b]]) => {
          const nameA = itemName(CHIP_ITEM_BY_PROFESSION[a])
          const nameB = itemName(CHIP_ITEM_BY_PROFESSION[b])
          return (
            <RadioGroup
              key={pair}
              label={`${nameA} / ${nameB}`}
              inline={true}
              selectedValue={draft.chipConversion[pair]}
              onChange={(e) => {
                const value = e.currentTarget.value as ChipConversion
                update((d) => void (d.chipConversion[pair] = value))
              }}
            >
              <Radio value="split" label={gt.pgettext('value config', '均分')} />
              <Radio
                value={a}
                label={gt.pgettext('value config', '加工为 %s').replaceAll('%s', nameA) /* I10N: %s: chip name */}
              />
              <Radio value={b} label={gt.pgettext('value config', '加工为 %s').replaceAll('%s', nameB)} />
            </RadioGroup>
          )
        })}

        <H4>{gt.pgettext('value config', '固定价值')}</H4>
        <FormGroup
          label={gt.pgettext('value config', '材料退环境')}
          helperText={gt.pgettext('value config', '点亮后按按钮上的数值固定价值')}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {RETIREMENT_PRESETS.map((x) => {
              const item = ga.getItem(x.itemId)
              if (!item) return null
              const on = Object.hasOwn(draft.fixedValues, x.itemId)
              return (
                <Button
                  key={x.itemId}
                  active={on}
                  intent={on ? Intent.PRIMARY : Intent.NONE}
                  variant={on ? 'solid' : 'outlined'}
                  title={`${item.name}: ${x.value}`}
                  icon={<ItemIcon item={item} size={24} />}
                  onClick={() =>
                    update((d) => {
                      if (on) delete d.fixedValues[x.itemId]
                      else d.fixedValues[x.itemId] = x.value
                    })
                  }
                  text={x.value}
                />
              )
            })}
          </div>
        </FormGroup>
        <HTMLTable compact={true} style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{gt.pgettext('value config', '物品')}</th>
              <th>{gt.pgettext('value config', '价值')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {Object.entries(draft.fixedValues).map(([itemId, value]) => {
              const item = ga.getItem(itemId)
              return (
                <tr key={itemId}>
                  <td style={{ verticalAlign: 'middle' }}>
                    {item ? <ItemIcon item={item} size={20} /> : null} {itemName(itemId)}
                  </td>
                  <td>
                    <NumberField
                      value={value}
                      min={0}
                      step={0.1}
                      onChange={(x) => update((d) => void (d.fixedValues[itemId] = x))}
                    />
                  </td>
                  <td>
                    <Button
                      icon="trash"
                      variant="minimal"
                      title={gt.pgettext('value config', '删除')}
                      onClick={() => update((d) => void delete d.fixedValues[itemId])}
                    />
                  </td>
                </tr>
              )
            })}
            <tr>
              <td>
                <HTMLSelect value={newItemId} onChange={(e) => setNewItemId(e.currentTarget.value)}>
                  <option value="">{gt.pgettext('value config', '选择材料…')}</option>
                  {materials.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.name}
                    </option>
                  ))}
                </HTMLSelect>
              </td>
              <td>
                <NumberField value={newItemValue} min={0} step={0.1} onChange={setNewItemValue} />
              </td>
              <td>
                <Button
                  icon="add"
                  variant="minimal"
                  disabled={!newItemId}
                  title={gt.pgettext('value config', '新增')}
                  onClick={() => {
                    update((d) => void (d.fixedValues[newItemId] = newItemValue))
                    setNewItemId('')
                  }}
                />
              </td>
            </tr>
          </tbody>
        </HTMLTable>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              onClick={() => setDraft(structuredClone(DEFAULT_ITEM_VALUE_CONFIG) as ItemValueConfig)}
              text={gt.pgettext('value config', '恢复默认')}
            />
            <Button
              intent={Intent.PRIMARY}
              disabled={!dirty}
              onClick={apply}
              text={gt.pgettext('value config', '应用并刷新')}
            />
          </>
        }
      />
    </Dialog>
  )
})

export const ValueConfigMenu = memo(() => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const [open, setOpen] = useState(false)
  const result = ga.getItemValues()

  return (
    <>
      {result.status === 'ok' ? (
        <MenuItem
          className="cpp-menu-not-interactive"
          icon="tick-circle"
          text={gt
            .ngettext('已定价 %d 种物品', '已定价 %d 种物品', result.pricedCount) /* I10N: %d: number */
            .replaceAll('%d', String(result.pricedCount))}
        />
      ) : (
        <MenuItem
          className="cpp-menu-not-interactive"
          icon="error"
          intent={Intent.DANGER}
          text={gt.pgettext('value config', '价值计算失败')}
          labelElement={
            <Tag minimal intent={Intent.DANGER}>
              {result.reason}
            </Tag>
          }
        />
      )}
      {/* 弹出菜单关闭会卸载对话框，所以点击后保持菜单打开 */}
      <MenuItem
        icon="properties"
        text={gt.pgettext('value config', '设置…')}
        shouldDismissPopover={false}
        onClick={() => setOpen(true)}
      />
      {open ? <ValueConfigDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
})
